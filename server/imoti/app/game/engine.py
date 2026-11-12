"""Авторитетен игрови двигател на „Имоти и Империи".

Всички правила се изпълняват тук, на сървъра. Клиентът само изпраща намерения
(действия), а двигателят ги валидира спрямо текущата фаза и състоянието.

Всяко публично действие връща списък от събития (речници), които сървърният
слой излъчва към клиентите за анимации и лог.
"""
from __future__ import annotations

import random
import time
from typing import Any

from .advisor import build_auto_mortgage_plan, build_debt_advice
from .board import Board
from .cards import Card, Deck, all_cards, card_tone, deck_of, jail_card_mode
from .dice_cheat import take_pending as _take_pending_dice
from .engine_assets import AssetsMixin
from .engine_auctions import AuctionMixin
from .engine_trades import TradesMixin
from .errors import GameError
from .missions import (
    MISSION_DEFINITIONS,
    assign_missing_secret_missions,
    assign_secret_missions,
    mission_progress,
)
from .player import Player
from .properties import (
    PropertyState,
    calculate_rent,
    owns_full_group,
)
from .rules import GameSettings
from .state import (
    GameState, PendingCardChoice, PendingDebt, PendingMortgageTransfer, Phase,
)
from .world_events import choose_global_event

# ``GameError`` живее в ``errors``, за да го достигат и миксините. Името се
# преизнася тук, защото целият проект го внася от ``engine``.
__all__ = ["GameEngine", "GameError"]


class GameEngine(AuctionMixin, AssetsMixin, TradesMixin):
    """Двигателят на една игра: фази, действия, плащания, фалити, победа.

    Гръбнакът на хода (хвърляне → движение → поле → плащане → фалит → победа)
    стои тук, защото стъпките му се викат една друга и разделянето им само
    би разпръснало една и съща верига по няколко файла. Периферните области
    са изнесени като миксини: :mod:`engine_auctions`, :mod:`engine_assets`
    и :mod:`engine_trades`.
    """

    def __init__(
        self,
        board: Board,
        settings: GameSettings,
        rng: random.Random | None = None,
    ) -> None:
        self.board = board
        self.state = GameState(settings=settings)
        self.rng = rng or random.Random()

    # ------------------------------------------------------------------
    # Настройка на играта
    # ------------------------------------------------------------------
    def start_game(self, players: list[Player]) -> list[dict[str, Any]]:
        """Инициализира играта и определя реда с начален хвърлей."""
        if not 2 <= len(players) <= 10:
            raise GameError("Играта изисква от 2 до 10 играчи.")
        state = self.state
        ordered_players, order_rolls = self._roll_starting_order(players)
        for order, player in enumerate(ordered_players):
            player.cash = state.settings.starting_cash
            player.stats["max_cash"] = player.cash
            player.position = 0
            player.order = order
            state.players[player.player_id] = player
            state.turn_order.append(player.player_id)
        state.decks["community"] = Deck.build("community", self.rng)
        state.decks["business"] = Deck.build("business", self.rng)
        social_rng = random.Random(
            f"{state.started_at}:{'|'.join(player.player_id for player in ordered_players)}"
        )
        assign_secret_missions(ordered_players, social_rng)
        state.phase = Phase.WAITING_FOR_ROLL
        self._record_wealth()
        self.touch_turn_clock()
        order_names = ", ".join(player.name for player in ordered_players)
        events = [
            self._log(
                f"Началният ред след хвърлянето е: {order_names}. "
                f"Пръв е {ordered_players[0].name}.",
                "system",
            ),
            {
                "type": "starting_order",
                "rolls": order_rolls,
                "order": list(state.turn_order),
            },
        ]
        return events

    def _roll_starting_order(
        self, players: list[Player],
    ) -> tuple[list[Player], list[dict[str, Any]]]:
        """Хвърля по два зара; равенствата се решават с нов хвърлей."""
        scores: dict[str, list[int]] = {p.player_id: [] for p in players}
        rolls: list[dict[str, Any]] = []
        tied_groups: list[list[Player]] = [list(players)]
        roll_round = 1
        while tied_groups and roll_round <= 25:
            next_ties: list[list[Player]] = []
            for group in tied_groups:
                by_total: dict[int, list[Player]] = {}
                for player in group:
                    dice = (self.rng.randint(1, 6), self.rng.randint(1, 6))
                    total = sum(dice)
                    scores[player.player_id].append(total)
                    rolls.append({
                        "player_id": player.player_id,
                        "dice": list(dice),
                        "total": total,
                        "round": roll_round,
                        "tiebreak": roll_round > 1,
                    })
                    by_total.setdefault(total, []).append(player)
                next_ties.extend(group for group in by_total.values() if len(group) > 1)
            tied_groups = next_ties
            roll_round += 1
        # Сортирането е стабилно: при невероятно дълго равенство остава
        # първоначалният ред, вместо стартът да блокира безкрайно.
        ordered = sorted(
            players,
            key=lambda player: tuple(scores[player.player_id]),
            reverse=True,
        )
        return ordered, rolls

    def touch_turn_clock(self) -> None:
        """Рестартира таймера на текущия ход според настройката за лимит."""
        limit = self.state.settings.turn_time_limit
        self.state.turn_deadline = time.time() + limit if limit > 0 else 0.0

    def _enter_payment_phase(self, debt: PendingDebt) -> None:
        """Влизане във фаза на плащане с пълен нов срок.

        Уреждането на задължение е отделна задача, а не остатък от хода:
        длъжникът трябва да продаде постройки и да ипотекира имоти, всяко с
        отделно потвърждение. Без рестарт му остава каквото е останало от
        хода — понякога няколко секунди — и таймерът изтича, преди да е
        успял да направи ръчно това, което после се случва автоматично.
        """
        self.state.debt = debt
        self.state.phase = Phase.AWAITING_PAYMENT
        self.touch_turn_clock()

    def pause_game(self, player_id: str) -> list[dict[str, Any]]:
        """Замразява игровите срокове до изрично възобновяване."""
        state = self.state
        if state.phase == Phase.GAME_OVER:
            raise GameError("Приключила игра не може да бъде поставена на пауза.")
        if state.paused:
            raise GameError("Играта вече е поставена на пауза.")
        player = state.players.get(player_id)
        if player is None:
            raise GameError("Играчът не участва в тази игра.")
        now = time.time()
        state.paused = True
        state.paused_at = now
        state.paused_by = player_id
        state.paused_turn_remaining = (
            max(0.0, state.turn_deadline - now) if state.turn_deadline else -1.0
        )
        state.paused_auction_remaining = (
            max(0.0, state.auction.ends_at - now)
            if state.auction is not None and state.auction.ends_at else -1.0
        )
        return [
            self._log(f"{player.name} постави партията на пауза.", "system"),
            {"type": "game_paused", "player_id": player_id},
        ]

    def resume_game(self, player_id: str) -> list[dict[str, Any]]:
        """Възстановява сроковете с оставащото при поставянето на пауза време."""
        state = self.state
        if not state.paused:
            raise GameError("Играта не е на пауза.")
        player = state.players.get(player_id)
        if player is None:
            raise GameError("Играчът не участва в тази игра.")
        now = time.time()
        if state.paused_turn_remaining >= 0:
            state.turn_deadline = now + state.paused_turn_remaining
        if state.auction is not None and state.paused_auction_remaining >= 0:
            state.auction.ends_at = now + state.paused_auction_remaining
        paused_seconds = max(0.0, now - state.paused_at)
        state.paused = False
        state.paused_at = 0.0
        state.paused_by = None
        state.paused_turn_remaining = -1.0
        state.paused_auction_remaining = -1.0
        return [
            self._log(f"{player.name} възобнови партията.", "system"),
            {
                "type": "game_resumed",
                "player_id": player_id,
                "paused_seconds": paused_seconds,
            },
        ]

    def ensure_secret_missions(self) -> None:
        """Допълва липсващи мисии в игри, записани с по-стара версия."""
        players = [
            self.state.players[pid] for pid in self.state.turn_order
            if pid in self.state.players and not self.state.players[pid].is_spectator
        ]
        social_rng = random.Random(
            f"{self.state.started_at}:{'|'.join(player.player_id for player in players)}"
        )
        assign_missing_secret_missions(players, social_rng)

    # ------------------------------------------------------------------
    # Помощни
    # ------------------------------------------------------------------
    def _log(self, text: str, kind: str = "info", **extra: Any) -> dict[str, Any]:
        entry = self.state.add_log(text, kind, **extra)
        return {"type": "log", **entry}

    def _require_phase(self, *phases: Phase) -> None:
        if self.state.phase not in phases:
            raise GameError("Действието не е позволено в момента.")

    def _require_current(self, player_id: str) -> Player:
        player = self.state.players.get(player_id)
        if player is None:
            raise GameError("Играчът не участва в тази игра.")
        if player.bankrupt:
            raise GameError("Фалирал играч не може да действа.")
        if self.state.current_player_id != player_id:
            raise GameError("Не е вашият ход.")
        return player

    def _require_player(self, player_id: str) -> Player:
        player = self.state.players.get(player_id)
        if player is None or player.bankrupt or player.is_spectator:
            raise GameError("Играчът не е активен в тази игра.")
        return player

    def _stat(self, player: Player, key: str, amount: int = 1) -> None:
        player.stats[key] = player.stats.get(key, 0) + amount

    def _track_cash(self, player: Player) -> None:
        player.stats["max_cash"] = max(player.stats.get("max_cash", 0), player.cash)

    def _event_percent(self, modifier: str) -> int:
        active = self.state.active_global_event
        if not active:
            return 100
        return int(active.get("modifiers", {}).get(modifier, 100))

    def _scale_for_event(self, amount: int, modifier: str) -> int:
        """Прилага активен процент и закръгля до най-близкото цяло евро."""
        percent = self._event_percent(modifier)
        return max(0, (int(amount) * percent + 50) // 100)

    def current_build_cost(self, position: int) -> int:
        """Действителна цена на строежа с текущото глобално събитие."""
        base = int(self.board.space(position).data.get("improve_cost", 0))
        return self._scale_for_event(base, "build_cost_percent")

    # ------------------------------------------------------------------
    # Държани карти — прилагат се сами при подходящото действие
    # ------------------------------------------------------------------
    def _find_held(self, player: Player, power: str) -> tuple[str, Card] | None:
        """Първата държана карта с дадена сила, ако играчът има такава."""
        catalogue = all_cards()
        for card_id in player.held_cards:
            card = catalogue.get(card_id)
            if card and card.effect.get("power") == power:
                return card_id, card
        return None

    def _consume_held(self, player: Player, power: str) -> Card | None:
        """Използва държана карта с дадена сила и я маха от ръката.

        Картите с няколко приложения (напр. „три нива строеж") пазят
        остатъка в ``modifiers`` и напускат ръката чак когато свърши.
        """
        found = self._find_held(player, power)
        if found is None:
            return None
        card_id, card = found
        uses_key = f"held_uses::{card_id}"
        total = int(card.effect.get("uses", 1))
        remaining = player.modifiers.get(uses_key, total)
        remaining -= 1
        if remaining > 0:
            player.modifiers[uses_key] = remaining
        else:
            player.modifiers.pop(uses_key, None)
            player.held_cards.remove(card_id)
            # Картата се връща в тестето си чак след като бъде изчерпана.
            deck = self.state.decks.get(card.deck)
            if deck is not None:
                deck.discard(card_id)
        return card

    def _peek_held_percent(self, player: Player, power: str, amount: int) -> int:
        """Каква ще е сумата с държаната карта, БЕЗ да я използва.

        Нужно е за проверките за наличност: играч с отстъпка трябва да мине
        проверката по намалената цена, а картата да се хаби едва при
        реалното плащане.
        """
        found = self._find_held(player, power)
        if found is None:
            return amount
        percent = int(found[1].effect.get("percent", 100))
        return max(0, amount * percent // 100)

    def _apply_held_percent(self, player: Player, power: str, amount: int) -> tuple[int, Card | None]:
        """Прилага процента на държана карта върху сума. Връща (нова сума, карта)."""
        card = self._consume_held(player, power)
        if card is None:
            return amount, None
        percent = int(card.effect.get("percent", 100))
        return max(0, amount * percent // 100), card

    def collect_social_events(self) -> list[dict[str, Any]]:
        """Открива нови пълни групи и изпълнени лични мисии."""
        state = self.state
        events: list[dict[str, Any]] = []
        celebrated = set(state.celebrated_monopolies)
        for player in state.active_players():
            for group, group_data in self.board.groups.items():
                key = f"{player.player_id}:{group}"
                if key in celebrated or not owns_full_group(
                    self.board, state.properties, player.player_id, group
                ):
                    continue
                celebrated.add(key)
                state.celebrated_monopolies.append(key)
                group_name = group_data.get("name", group)
                events.extend([
                    self._log(
                        f"{player.name} завърши цялата група „{group_name}“!",
                        "monopoly",
                    ),
                    {
                        "type": "group_completed",
                        "player_id": player.player_id,
                        "group": group,
                        "group_name": group_name,
                        "color": group_data.get("color", "#e6c36b"),
                    },
                ])

            mission_id = player.secret_mission
            definition = MISSION_DEFINITIONS.get(mission_id or "")
            if player.mission_completed or definition is None:
                continue
            current, target = mission_progress(mission_id, player, state, self.board)
            if current < target:
                continue
            bonus = int(definition["bonus"])
            player.mission_completed = True
            player.cash += bonus
            self._stat(player, "missions_completed")
            self._stat(player, "cash_received", bonus)
            self._track_cash(player)
            self._bank_record(None, player, bonus, "Бонус за тайна мисия")
            events.extend([
                self._log(
                    f"{player.name} изпълни тайната мисия „{definition['title']}“ "
                    f"и получава {bonus} €!",
                    "mission",
                ),
                {
                    "type": "mission_completed",
                    "player_id": player.player_id,
                    "mission_id": mission_id,
                    "title": definition["title"],
                    "bonus": bonus,
                },
                {
                    "type": "payment", "from": None,
                    "to": player.player_id, "amount": bonus,
                },
            ])
        return events

    def _update_global_events(self) -> list[dict[str, Any]]:
        """Приключва изтекло събитие и при нужда започва следващото."""
        state = self.state
        events: list[dict[str, Any]] = []
        active = state.active_global_event
        if active and state.round_number >= int(active.get("ends_round", 0)):
            events.extend([
                self._log(
                    f"Глобалното събитие „{active['title']}“ приключи.",
                    "global_event",
                ),
                {"type": "global_event_end", "event": dict(active)},
            ])
            state.active_global_event = None
        if state.round_number >= state.next_global_event_round:
            event_rng = random.Random(
                f"{state.started_at}:{state.round_number}:"
                f"{'|'.join(state.turn_order)}"
            )
            event = choose_global_event(
                event_rng, state.last_global_event_id, state.round_number
            )
            state.active_global_event = event
            state.last_global_event_id = event["id"]
            state.next_global_event_round = state.round_number + 3
            events.extend([
                self._log(
                    f"{event['icon']} Глобално събитие: {event['title']} — "
                    f"{event['description']}",
                    "global_event",
                ),
                {"type": "global_event_start", "event": dict(event)},
            ])
        return events

    def _bank_record(
        self, payer: Player | None, payee: Player | None,
        amount: int, reason: str,
    ) -> None:
        if amount <= 0:
            return
        self.state.bank_transactions.append({
            "from": payer.player_id if payer else None,
            "to": payee.player_id if payee else None,
            "amount": amount,
            "reason": reason,
            "ts": time.time(),
        })
        if len(self.state.bank_transactions) > 80:
            self.state.bank_transactions = self.state.bank_transactions[-80:]

    def _record_wealth(self) -> None:
        self.state.wealth_history.append({
            "round": self.state.round_number,
            "values": {
                pid: player.net_worth(self.board, self.state.properties)
                for pid, player in self.state.players.items()
                if not player.is_spectator
            },
        })
        if len(self.state.wealth_history) > 250:
            self.state.wealth_history = self.state.wealth_history[-250:]

    def _transfer(
        self, payer: Player | None, payee: Player | None, amount: int,
        kind: str = "bank", reason: str = "Банкова операция",
    ) -> None:
        """Прехвърля пари; None означава банката."""
        if payer is not None:
            payer.cash -= amount
            self._stat(payer, "rent_paid" if kind == "rent" else "bank_paid", amount)
        if payee is not None:
            payee.cash += amount
            self._stat(payee, "rent_collected" if kind == "rent" else "cash_received", amount)
            self._track_cash(payee)
        elif payer is not None and self.state.settings.free_parking_jackpot:
            self.state.bank_pot += amount
        self._bank_record(payer, payee, amount, reason)

    # ------------------------------------------------------------------
    # Хвърляне на зарове и движение
    # ------------------------------------------------------------------
    def roll_dice(self, player_id: str) -> list[dict[str, Any]]:
        """Основно действие: хвърляне на два зара и придвижване."""
        self._require_phase(Phase.WAITING_FOR_ROLL)
        player = self._require_current(player_id)
        state = self.state

        # Хвърлянето доказва, че играчът е активен — прекъсва поредицата
        # от пропуснати по таймер ходове още тук, а не чак при „Приключи".
        player.stats["consecutive_timeouts"] = 0

        forced = None if player.is_bot else _take_pending_dice()
        if forced is not None:
            die1, die2 = forced
        else:
            die1 = self.rng.randint(1, 6)
            die2 = self.rng.randint(1, 6)
        total = die1 + die2
        is_double = die1 == die2
        state.last_roll = (die1, die2)

        # Статистика на заровете (за „късмет" в края на играта).
        self._stat(player, "dice_rolls")
        self._stat(player, "dice_pips", total)
        if is_double:
            self._stat(player, "doubles")

        events: list[dict[str, Any]] = [
            {"type": "dice", "player_id": player_id, "dice": [die1, die2]},
            self._log(f"{player.name} хвърля {die1} и {die2}.", "dice"),
        ]

        # Административна проверка: опит за излизане с еднакви зарове.
        if player.in_jail:
            if is_double:
                player.in_jail = False
                player.jail_turns = 0
                events.append(self._log(
                    f"{player.name} хвърля еднакви зарове и преминава проверката!", "jail"
                ))
                state.doubles_count = 0  # излизането не дава втори ход
                events.extend(self._move_player(player, total))
                return events
            player.jail_turns += 1
            if player.jail_turns >= state.settings.jail_max_turns:
                fee = state.settings.jail_fee
                events.append(self._log(
                    f"{player.name} плаща задължителната такса от {fee} € и е освободен.",
                    "jail",
                ))
                player.in_jail = False
                player.jail_turns = 0
                if player.cash >= fee:
                    self._transfer(player, None, fee, reason="Административна такса")
                    events.append({"type": "payment", "from": player.player_id,
                                   "to": None, "amount": fee})
                    events.extend(self._move_player(player, total))
                else:
                    self._enter_payment_phase(PendingDebt(
                        debtor=player_id, creditor=None, amount=fee,
                        reason="Административна такса",
                    ))
                    events.append({"type": "debt", "debt": state.debt.to_dict()})
                return events
            events.append(self._log(
                f"{player.name} не успя да премине проверката (опит {player.jail_turns}).",
                "jail",
            ))
            state.phase = Phase.MANAGEMENT
            return events

        # Три поредни двойни хвърляния → административна проверка.
        if is_double:
            state.doubles_count += 1
            if state.doubles_count >= state.settings.doubles_to_jail:
                state.doubles_count = 0
                events.append(self._log(
                    f"{player.name} хвърли {state.settings.doubles_to_jail} поредни "
                    "чифта и е изпратен на административна проверка!", "jail",
                ))
                events.extend(self._send_to_jail(player))
                return events
        else:
            state.doubles_count = 0

        events.extend(self._move_player(player, total))
        return events

    def _move_player(
        self, player: Player, steps: int, collect_start: bool = True,
        resolve: bool = True,
    ) -> list[dict[str, Any]]:
        """Придвижва играча и урежда полето, на което стъпва.

        ``resolve=False`` мести, без да задейства полето. Ползва се от
        легендарните карти, които местят всички наведнъж: там уреждането на
        чуждо поле би отворило покупка или дълг за играч, който изобщо не е
        на ход.
        """
        state = self.state
        old_pos = player.position
        new_pos = (old_pos + steps) % self.board.size
        passed_start = steps > 0 and (old_pos + steps) >= self.board.size

        player.position = new_pos
        events: list[dict[str, Any]] = [{
            "type": "move",
            "player_id": player.player_id,
            "from": old_pos,
            "to": new_pos,
            "steps": steps,
        }]

        if passed_start and collect_start:
            income = self._scale_for_event(
                state.settings.start_income, "start_income_percent"
            )
            if player.modifiers.pop("start_bonus", 0):
                income *= 2
                events.append(self._log(
                    f"{player.name} получава двоен доход: {income} €!", "money"
                ))
            else:
                events.append(self._log(
                    f"{player.name} преминава през Начален площад и получава {income} €.",
                    "money",
                ))
            player.cash += income
            self._stat(player, "cash_received", income)
            self._stat(player, "laps")
            self._bank_record(None, player, income, "Доход от Начален площад")
            events.append({"type": "payment", "from": None,
                           "to": player.player_id, "amount": income})

            if (
                state.settings.eu_subsidies_enabled
                and state.settings.eu_subsidy_amount > 0
            ):
                subsidy = state.settings.eu_subsidy_amount
                player.cash += subsidy
                self._stat(player, "cash_received", subsidy)
                self._bank_record(None, player, subsidy, "Европейска субсидия")
                events.extend([
                    self._log(
                        f"{player.name} получава европейска субсидия от {subsidy} €.",
                        "money",
                    ),
                    {"type": "payment", "from": None,
                     "to": player.player_id, "amount": subsidy},
                ])
            self._track_cash(player)

        if resolve:
            events.extend(self._resolve_space(player))
        return events

    def _resolve_space(self, player: Player) -> list[dict[str, Any]]:
        """Урежда ефекта на полето, на което играчът е стъпил."""
        state = self.state
        space = self.board.space(player.position)
        events: list[dict[str, Any]] = [{
            "type": "land", "player_id": player.player_id, "position": player.position,
        }]

        if space.is_ownable:
            prop = state.properties.get(space.position)
            special_transport = player.modifiers.pop("double_transport_rent", 0)
            special_utility = player.modifiers.pop("utility_special_rent", 0)
            if prop is None or prop.owner is None:
                # Свободен имот — предложение за покупка.
                state.phase = Phase.AWAITING_PURCHASE
                events.append(self._log(
                    f'{player.name} стъпва на „{space.name}" — свободен имот за {space.price} €.',
                    "land",
                ))
                return events
            if prop.owner == player.player_id or prop.mortgaged:
                state.phase = Phase.MANAGEMENT
                events.append(self._log(f'{player.name} стъпва на „{space.name}".', "land"))
                return events
            # Дължи се наем.
            dice_total = sum(state.last_roll) if state.last_roll else 7
            rent = calculate_rent(self.board, state.properties, space.position, dice_total)
            if space.type == "transport" and special_transport:
                rent *= 2
                events.append(self._log(
                    f"Специалната карта удвоява транспортния наем на {rent} €.",
                    "rent",
                ))
            if space.type == "utility" and special_utility:
                die1 = self.rng.randint(1, 6)
                die2 = self.rng.randint(1, 6)
                special_roll = die1 + die2
                rent = special_roll * 10
                events.extend([
                    {"type": "dice", "player_id": player.player_id,
                     "dice": [die1, die2], "special": True},
                    self._log(
                        f"{player.name} хвърля {die1} и {die2}: специалният наем "
                        f"е {special_roll} × 10 = {rent} €.", "rent",
                    ),
                ])
            rent_before_event = rent
            rent = self._scale_for_event(rent, "rent_percent")
            if space.type == "transport":
                rent = self._scale_for_event(rent, "transport_rent_percent")
            elif space.type == "utility":
                rent = self._scale_for_event(rent, "utility_rent_percent")
            if rent != rent_before_event and state.active_global_event:
                events.append(self._log(
                    f"„{state.active_global_event['title']}“ променя наема на {rent} €.",
                    "global_event",
                ))
            if player.modifiers.pop("rent_discount", 0):
                rent //= 2
                events.append(self._log(
                    f"Отстъпката на {player.name} намалява наема наполовина!", "money"
                ))
            owner = state.players[prop.owner]
            # Държани карти при наем. ВНИМАНИЕ: щитът е на ПЛАТЕЦА, а
            # повишението и замразяването — на СОБСТВЕНИКА. Едно събитие
            # докосва ръцете на двама различни играчи.
            shielded, shield_card = self._apply_held_percent(player, "rent_shield", rent)
            if shield_card is not None:
                events.append(self._log(
                    f"Картата на {player.name} сваля наема от {rent} € на {shielded} €.",
                    "card",
                ))
                rent = shielded
            for power in ("rent_boost", "rent_penalty"):
                adjusted, owner_card = self._apply_held_percent(owner, power, rent)
                if owner_card is not None:
                    events.append(self._log(
                        f"Картата на {owner.name} променя наема от {rent} € "
                        f"на {adjusted} €.", "card",
                    ))
                    rent = adjusted
            if rent > 0:
                state.property_income[space.position] = (
                    state.property_income.get(space.position, 0) + rent
                )
            events.append(self._log(
                f'{player.name} стъпва на „{space.name}" и дължи {rent} € наем на {owner.name}.',
                "rent",
            ))
            return events + self._charge(player, owner, rent, f'Наем за „{space.name}"')

        if space.type == "tax":
            amount = self._scale_for_event(space.data["amount"], "tax_percent")
            if amount == 0:
                state.phase = Phase.MANAGEMENT
                events.append(self._log(
                    f"{player.name} не плаща {space.name.lower()} заради "
                    "данъчната амнистия!",
                    "global_event",
                ))
                events.append({
                    "type": "tax_amnesty", "player_id": player.player_id,
                    "position": space.position,
                })
                return events
            events.append(self._log(
                f"{player.name} плаща {space.name.lower()} от {amount} €.", "tax"
            ))
            return events + self._charge(player, None, amount, space.name)

        if space.type == "card":
            deck_id = space.data["deck"]
            return events + self._draw_card(player, deck_id)

        if space.type == "corner":
            subtype = space.data.get("subtype")
            if subtype == "goto_jail":
                events.append(self._log(
                    f"{player.name} е изпратен на административна проверка!", "jail"
                ))
                events.extend(self._send_to_jail(player))
                return events
            if subtype == "start":
                events.append(self._log(f"{player.name} спира на Начален площад.", "land"))
            elif subtype == "free_parking":
                if state.settings.free_parking_jackpot and state.bank_pot:
                    prize = state.bank_pot
                    state.bank_pot = 0
                    player.cash += prize
                    self._stat(player, "cash_received", prize)
                    self._track_cash(player)
                    self._bank_record(None, player, prize, "Фонд Свободен престой")
                    events.append(self._log(
                        f"{player.name} получава банковия фонд от {prize} €!", "money"
                    ))
                    events.append({"type": "payment", "from": None,
                                   "to": player.player_id, "amount": prize})
                else:
                    events.append(self._log(f"{player.name} си почива на Свободен престой.", "land"))
            elif subtype == "jail":
                events.append(self._log(
                    f"{player.name} е само на посещение при проверяващите.", "land"
                ))
            state.phase = Phase.MANAGEMENT
            return events

        state.phase = Phase.MANAGEMENT
        return events

    def _send_to_jail(self, player: Player) -> list[dict[str, Any]]:
        # Адвокатската карта се задейства сама и отменя проверката. Играчът
        # остава там, където е — включително на самото поле, което го е
        # изпратило. Това е и слабостта ѝ: харчи се при първото пращане,
        # дори когато в късна игра проверката би му била изгодна.
        shield = next(
            (cid for cid in player.jail_card_ids if jail_card_mode(cid) == "shield"),
            None,
        )
        if shield is not None:
            player.jail_card_ids.remove(shield)
            self._return_jail_card(shield)
            self.state.doubles_count = 0
            self.state.phase = Phase.MANAGEMENT
            return [
                self._log(
                    f"Адвокатската карта на {player.name} се задейства — "
                    "проверката отпада.", "card",
                ),
                {"type": "jail_shield", "player_id": player.player_id},
            ]

        jail_pos = self.board.find_corner("jail")
        player.position = jail_pos if jail_pos is not None else 0
        player.in_jail = True
        player.jail_turns = 0
        self.state.doubles_count = 0
        self.state.phase = Phase.MANAGEMENT
        return [{"type": "jail", "player_id": player.player_id, "position": player.position}]

    # ------------------------------------------------------------------
    # Плащания и фалит
    # ------------------------------------------------------------------
    def _charge(
        self, payer: Player, payee: Player | None, amount: int, reason: str
    ) -> list[dict[str, Any]]:
        """Опитва плащане; при недостиг влиза във фаза AWAITING_PAYMENT."""
        state = self.state
        if amount <= 0:
            state.phase = Phase.MANAGEMENT
            return []
        if payer.cash >= amount:
            kind = "rent" if reason.startswith("Наем") else "bank"
            self._transfer(payer, payee, amount, kind, reason)
            state.phase = Phase.MANAGEMENT
            return [{
                "type": "payment",
                "from": payer.player_id,
                "to": payee.player_id if payee else None,
                "amount": amount,
            }]
        # Недостиг — първо ипотекираме автоматично допустимите имоти.
        self._enter_payment_phase(PendingDebt(
            debtor=payer.player_id,
            creditor=payee.player_id if payee else None,
            amount=amount,
            reason=reason,
        ))
        events: list[dict[str, Any]] = [
            self._log(
                f"{payer.name} няма достатъчно средства ({amount} €) — "
                "проверяват се допустимите автоматични ипотеки.",
                "warning",
            ),
            {"type": "debt", "debt": state.debt.to_dict()},
        ]
        mortgage_events = self._auto_mortgage_for_debt(payer.player_id)
        events.extend(mortgage_events)
        if payer.cash >= amount:
            events.extend(self.settle_debt(payer.player_id))
            return events
        events.append(self._log(
            f"Допустимите ипотеки не покриват задължението на {payer.name}. "
            "Нужни са допълнителни действия или обявяване на фалит.",
            "warning",
        ))
        return events

    def settle_debt(self, player_id: str) -> list[dict[str, Any]]:
        """Играчът потвърждава плащане на задължението (след набавяне на средства)."""
        self._require_phase(Phase.AWAITING_PAYMENT)
        state = self.state
        debt = state.debt
        if debt is None or debt.debtor != player_id:
            raise GameError("Нямате чакащо задължение.")
        player = state.players[player_id]
        if player.cash < debt.amount:
            raise GameError("Все още нямате достатъчно средства.")
        payee = state.players.get(debt.creditor) if debt.creditor else None
        kind = "rent" if debt.reason.startswith("Наем") else "bank"
        self._transfer(player, payee, debt.amount, kind, debt.reason)
        events = [
            self._log(f"{player.name} изплаща задължението си от {debt.amount} €.", "money"),
            {"type": "payment", "from": player_id,
             "to": debt.creditor, "amount": debt.amount},
        ]
        if debt.clears_loan:
            # Платената сума Е главницата: без това играчът дава парите и
            # пак дължи заема, а следващата обиколка го иска наново.
            player.loan = max(0, player.loan - debt.amount)
            events.extend([
                self._log(f"Заемът на {player.name} е закрит.", "money"),
                {"type": "loan_repaid", "player_id": player_id,
                 "amount": debt.amount, "balance": player.loan},
            ])
        resume = Phase(debt.resume_phase)
        state.debt = None
        # Ипотечното решение има предимство; иначе се връщаме там, откъдето
        # е дошъл дългът. Лихвата по заем се начислява ПРЕДИ хвърлянето и
        # затова носи WAITING_FOR_ROLL — без това уреждането ѝ изяждаше
        # хода на длъжника.
        state.phase = (
            Phase.AWAITING_MORTGAGE_DECISION
            if state.pending_mortgage_transfer
            and state.pending_mortgage_transfer.player_id == player_id
            else resume
        )
        return events

    def settle_debt_with_plan(self, player_id: str) -> list[dict[str, Any]]:
        """Изпълнява целия препоръчан план и плаща задължението наведнъж.

        Важи и за дълг към банката: планът се показваше и там, но нямаше
        как да бъде изпълнен с едно действие.
        """
        self._require_phase(Phase.AWAITING_PAYMENT)
        state = self.state
        debt = state.debt
        if debt is None or debt.debtor != player_id:
            raise GameError("Нямате чакащо задължение.")

        advice = build_debt_advice(state, self.board)
        if advice is None or not advice["covers"] or not advice["actions"]:
            raise GameError("Предложеният план не може да покрие целия дълг.")

        events = self._auto_liquidate_for_debt(player_id)
        if state.players[player_id].cash < debt.amount:
            raise GameError("Предложеният план не осигури достатъчно средства.")
        payment_events = self.settle_debt(player_id)
        for event in payment_events:
            if event.get("type") != "log":
                event["instant"] = True
                event["automatic"] = True
        events.extend(payment_events)
        return events

    def _auto_mortgage_for_debt(self, player_id: str) -> list[dict[str, Any]]:
        """Ипотекира допустими имоти само докато текущият дълг бъде покрит."""
        state = self.state
        debt = state.debt
        if debt is None or debt.debtor != player_id:
            return []
        plan = build_auto_mortgage_plan(state, self.board)
        # Не ипотекираме активи напразно, когато всички допустими ипотеки
        # заедно пак не могат да покрият текущото задължение.
        if plan is None or not plan["covers"]:
            return []
        events: list[dict[str, Any]] = []
        for action in plan["actions"]:
            if state.debt is None or state.players[player_id].cash >= debt.amount:
                break
            action_events = self.mortgage_property(
                player_id, int(action["position"])
            )
            for event in action_events:
                if event.get("type") != "log":
                    event["instant"] = True
                    event["automatic"] = True
            events.extend(action_events)
        return events

    def raise_funds(self, player_id: str) -> list[dict[str, Any]]:
        """Изпълнява целия план, дори когато той не покрива дълга.

        Само по изрично искане на играча. Задължението остава открито и
        фазата не се променя — оттук нататък му трябва сделка или фалит.
        Смисълът е да не щрака през десет отделни потвърждения, за да
        стигне до същото състояние.
        """
        self._require_phase(Phase.AWAITING_PAYMENT)
        state = self.state
        debt = state.debt
        if debt is None or debt.debtor != player_id:
            raise GameError("Нямате чакащо задължение.")

        advice = build_debt_advice(state, self.board)
        if advice is None or not advice["actions"]:
            raise GameError("Няма останали действия за набавяне на средства.")

        player = state.players[player_id]
        before = player.cash
        events = self._auto_liquidate_for_debt(player_id, require_cover=False)
        raised = player.cash - before
        events.insert(0, self._log(
            f"{player.name} набавя средства наведнъж: +{raised} €.", "money",
        ))
        if player.cash >= debt.amount:
            # Планът все пак стигна — плащаме веднага, за да не се налага
            # още едно щракане.
            events.extend(self.settle_debt(player_id))
        else:
            events.append(self._log(
                f"Остават {debt.amount - player.cash} € до покриване на "
                f"задължението на {player.name}.", "warning",
            ))
        return events

    def _auto_liquidate_for_debt(
        self, player_id: str, require_cover: bool = True
    ) -> list[dict[str, Any]]:
        """Продава подобрения и ипотекира активи до покриване на дълга.

        ``require_cover`` пази активите при автоматично задействане: не
        разпродаваме частично, ако и цялата ликвидация няма да стигне.
        При изрично искане от играча (``raise_funds``) проверката отпада.
        """
        state = self.state
        debt = state.debt
        if debt is None or debt.debtor != player_id:
            return []

        advice = build_debt_advice(state, self.board)
        if advice is None:
            return []
        if require_cover and not advice["covers"]:
            return []

        events: list[dict[str, Any]] = []
        for action in advice["actions"]:
            # Планът се симулира предварително, но правилата се проверяват
            # наново при всяко действие (равномерна продажба, свободни къщи
            # в банката). Ако някоя стъпка отпадне, спираме дотук вместо да
            # изсипем грешка върху вече променени активи.
            try:
                if action["type"] == "sell":
                    action_events = self.sell_improvement(
                        player_id, action["position"]
                    )
                elif action["type"] == "sell_property":
                    action_events = self.sell_property_to_bank(
                        player_id, action["position"]
                    )
                else:
                    action_events = self.mortgage_property(
                        player_id, action["position"]
                    )
            except GameError:
                break
            for event in action_events:
                if event.get("type") != "log":
                    event["instant"] = True
                    event["automatic"] = True
            events.extend(action_events)
        return events

    def declare_bankruptcy(self, player_id: str) -> list[dict[str, Any]]:
        """Играчът обявява фалит; активите преминават към кредитора или банката."""
        state = self.state
        player = self._require_player(player_id)
        if state.phase != Phase.AWAITING_PAYMENT or state.debt is None \
                or state.debt.debtor != player_id:
            raise GameError("Може да обявите фалит само при неплатимо задължение.")

        creditor = state.players.get(state.debt.creditor) if state.debt.creditor else None
        if (
            state.pending_mortgage_transfer
            and state.pending_mortgage_transfer.player_id == player_id
        ):
            state.pending_mortgage_transfer = None
        events: list[dict[str, Any]] = [
            self._log(f"{player.name} обявява фалит!", "bankrupt"),
            {"type": "bankrupt", "player_id": player_id},
        ]

        # Постройките се ликвидират на половин цена преди прехвърлянето.
        building_refund = 0
        for prop in state.properties.values():
            if prop.owner == player_id and prop.level:
                space = self.board.space(prop.position)
                building_refund += prop.level * space.data.get("improve_cost", 0) // 2
                prop.level = 0
        player.cash += building_refund
        if building_refund:
            self._bank_record(None, player, building_refund, "Ликвидация на постройки")
        if building_refund:
            events.append(self._log(
                f"Банката изкупува постройките на {player.name} за {building_refund} €.",
                "bankrupt",
            ))
            events.append({"type": "payment", "from": None,
                           "to": player_id, "amount": building_refund})

        # Прехвърляне на активи.
        mortgage_positions: list[int] = []
        transferred_positions: list[int] = []
        if creditor is not None:
            creditor.cash += max(player.cash, 0)
            if player.cash > 0:
                self._bank_record(player, creditor, player.cash, "Прехвърляне при фалит")
                events.append({"type": "payment", "from": player_id,
                               "to": creditor.player_id, "amount": player.cash})
            self._track_cash(creditor)
            creditor.jail_card_ids.extend(player.jail_card_ids)
            for prop in state.properties.values():
                if prop.owner == player_id:
                    prop.owner = creditor.player_id
                    transferred_positions.append(prop.position)
                    if prop.mortgaged:
                        mortgage_positions.append(prop.position)
            events.append(self._log(
                f"Активите на {player.name} преминават към {creditor.name}.", "bankrupt"
            ))
            if transferred_positions:
                events.append({
                    "type": "ownership_transfer", "from": player_id,
                    "to": creditor.player_id, "positions": transferred_positions,
                    "reason": "bankruptcy",
                })
        else:
            reclaimed: list[int] = []
            for prop in state.properties.values():
                if prop.owner == player_id:
                    prop.owner = None
                    prop.level = 0
                    prop.mortgaged = False
                    reclaimed.append(prop.position)
            if reclaimed:
                events.append({
                    "type": "ownership_transfer", "from": player_id,
                    "to": None, "positions": reclaimed, "reason": "bankruptcy",
                })
            if state.settings.auctions_enabled and reclaimed:
                state.auction_queue.extend(sorted(reclaimed))
                events.append(self._log(
                    f"Активите на {player.name} отиват на търг.", "bankrupt"
                ))
            else:
                events.append(self._log(
                    f"Активите на {player.name} се връщат на банката.", "bankrupt"
                ))

        player.cash = 0
        if creditor is None:
            # Без наследник картите се връщат в тестетата, вместо да изчезнат
            # от играта заедно с фалиралия.
            for card_id in player.jail_card_ids:
                self._return_jail_card(card_id)
        player.jail_card_ids.clear()
        self._mark_bankrupt(player)
        state.debt = None

        if creditor is not None and mortgage_positions:
            # Ако фалитът решава играта, победителят не урежда лихви и
            # ипотечни решения — обявяваме победата веднага. Иначе играта
            # увисва в AWAITING_MORTGAGE_DECISION без победен екран.
            victory = self._check_victory()
            if victory:
                events.extend(victory)
                return events
            interest = sum(
                self.board.space(pos).data["mortgage"] // 10
                for pos in mortgage_positions
            )
            state.pending_mortgage_transfer = PendingMortgageTransfer(
                player_id=creditor.player_id,
                positions=mortgage_positions,
                interest_paid=interest,
            )
            events.append(self._log(
                f"{creditor.name} дължи {interest} € лихва за получените "
                "ипотекирани имоти.", "mortgage",
            ))
            if creditor.cash >= interest:
                creditor.cash -= interest
                self._stat(creditor, "bank_paid", interest)
                self._bank_record(
                    creditor, None, interest,
                    "Лихва за придобити ипотекирани имоти",
                )
                events.append({"type": "payment", "from": creditor.player_id,
                               "to": None, "amount": interest})
                state.phase = Phase.AWAITING_MORTGAGE_DECISION
            else:
                self._enter_payment_phase(PendingDebt(
                    debtor=creditor.player_id, creditor=None, amount=interest,
                    reason="Лихва за придобити ипотекирани имоти",
                ))
                events.append({"type": "debt", "debt": state.debt.to_dict()})
            events.append({
                "type": "mortgage_transfer",
                "transfer": state.pending_mortgage_transfer.to_dict(),
            })
            return events

        events.extend(self._check_victory())
        if state.phase != Phase.GAME_OVER:
            if state.current_player and state.current_player.bankrupt:
                events.extend(self._advance_turn())
            else:
                state.phase = Phase.MANAGEMENT
            events.extend(self._maybe_start_queued_auction())
        return events

    def end_game_early(self) -> list[dict[str, Any]]:
        """Приключва партията предсрочно: печели най-богатият в момента.

        Домакинска мярка за случаите, когато играта се проточи и всички се
        разберат да я спрат. Класирането после е същото като при нормален
        край — по реда на отпадане.
        """
        state = self.state
        if state.phase == Phase.GAME_OVER:
            raise GameError("Играта вече е приключила.")
        active = state.active_players()
        if not active:
            raise GameError("Няма активни играчи.")
        richest = max(active, key=lambda p: p.net_worth(self.board, state.properties))
        state.winner = richest.player_id
        state.phase = Phase.GAME_OVER
        state.auction = None
        state.debt = None
        state.pending_mortgage_transfer = None
        self._record_wealth()
        return [
            self._log(
                f"Домакинът приключва партията предсрочно. "
                f"{richest.name} печели с най-голямо състояние!", "victory",
            ),
            {"type": "game_over", "winner": richest.player_id},
        ]

    def _mark_bankrupt(self, player: Player) -> None:
        """Отбелязва отпадането и запомня поредността му.

        Единствената точка, през която се вдига ``bankrupt`` — и при фалит
        от дълг, и при напускане/премахване. Иначе класацията в края би
        пропуснала част от играчите и би ги подредила погрешно.
        """
        if player.bankrupt:
            return
        player.bankrupt = True
        if player.player_id not in self.state.bankruptcy_order:
            self.state.bankruptcy_order.append(player.player_id)

    def _check_victory(self) -> list[dict[str, Any]]:
        state = self.state
        active = state.active_players()
        if len(active) == 1:
            winner = active[0]
            state.winner = winner.player_id
            state.phase = Phase.GAME_OVER
            self._record_wealth()
            return [
                self._log(f"{winner.name} печели играта!", "victory"),
                {"type": "game_over", "winner": winner.player_id},
            ]
        if (
            state.settings.victory_condition == "round_limit"
            and state.round_number > state.settings.victory_rounds
            and active
        ):
            richest = max(
                active,
                key=lambda p: p.net_worth(self.board, state.properties),
            )
            state.winner = richest.player_id
            state.phase = Phase.GAME_OVER
            self._record_wealth()
            return [
                self._log(
                    f"Лимитът от {state.settings.victory_rounds} рунда е достигнат. "
                    f"{richest.name} печели с най-голямо състояние!", "victory",
                ),
                {"type": "game_over", "winner": richest.player_id},
            ]
        return []

    # ------------------------------------------------------------------
    # Покупка
    # ------------------------------------------------------------------
    def buy_property(self, player_id: str) -> list[dict[str, Any]]:
        """Купуване на свободния имот, на който играчът е стъпил."""
        self._require_phase(Phase.AWAITING_PURCHASE)
        player = self._require_current(player_id)
        state = self.state
        space = self.board.space(player.position)
        if not space.is_ownable:
            raise GameError("Това поле не може да бъде купено.")
        prop = state.properties.get(space.position)
        if prop is not None and prop.owner is not None:
            raise GameError("Имотът вече има собственик.")
        price = space.price or 0
        # Първо проверяваме по крайната цена, БЕЗ да хабим картите — иначе
        # неуспешна покупка би ги изгорила напразно.
        expected = price
        for power in ("purchase_discount", "purchase_surcharge"):
            expected = self._peek_held_percent(player, power, expected)
        if player.cash < expected:
            raise GameError("Нямате достатъчно средства за покупката.")
        # Сега вече ги използваме: първо отстъпката, после надценката.
        card_notes: list[dict[str, Any]] = []
        for power in ("purchase_discount", "purchase_surcharge"):
            new_price, card = self._apply_held_percent(player, power, price)
            if card is not None:
                card_notes.append(self._log(
                    f"Картата на {player.name} променя цената на "
                    f"„{space.name}“ от {price} € на {new_price} €.", "card",
                ))
                price = new_price
        player.cash -= price
        self._stat(player, "bank_paid", price)
        self._stat(player, "properties_bought")
        self._bank_record(player, None, price, f"Покупка на {space.name}")
        state.properties[space.position] = PropertyState(
            position=space.position, owner=player_id
        )
        state.phase = Phase.MANAGEMENT
        return card_notes + [
            self._log(f'{player.name} купува „{space.name}" за {price} €.', "buy"),
            {"type": "purchase", "player_id": player_id,
             "position": space.position, "price": price},
            {"type": "payment", "from": player_id, "to": None, "amount": price},
        ]

    def decline_purchase(self, player_id: str) -> list[dict[str, Any]]:
        """Отказ от покупка: търг (ако е включен) или имотът остава свободен."""
        self._require_phase(Phase.AWAITING_PURCHASE)
        player = self._require_current(player_id)
        state = self.state
        space = self.board.space(player.position)

        if not state.settings.auctions_enabled:
            state.phase = Phase.MANAGEMENT
            return [self._log(
                f'{player.name} се отказва от „{space.name}" — имотът остава свободен.',
                "info",
            )]

        events = [self._log(f'{player.name} се отказва от „{space.name}".', "info")]
        events.extend(self._start_auction(space.position, Phase.MANAGEMENT))
        return events

    # ------------------------------------------------------------------
    # Карти
    # ------------------------------------------------------------------
    def _resolve_card_text(self, card: Card, player: Player) -> str:
        """Вмъква име на друг играч в шаблоните на картата.

        Шегата хваща, когато е за конкретния човек на масата. Съседът се
        избира през ``self.rng``, за да остане партията възпроизводима при
        един и същ seed.

        Шаблоните нарочно се ползват само в карти с незабавен ефект: текстът
        на държаните карти („keep", „jail_free") пътува към клиента направо
        от дефиницията (``Player.held_cards_client``) и там няма кой да
        замести имената.
        """
        text = card.text
        if "{съсед}" not in text:
            return text
        others = [
            p for p in self.state.active_players()
            if p.player_id != player.player_id
        ]
        # Сам на масата (или всички останали са фалирали) — картата пак
        # трябва да звучи смислено.
        name = self.rng.choice(others).name if others else "съседът отсреща"
        return text.replace("{съсед}", name)

    def _draw_card(self, player: Player, deck_id: str) -> list[dict[str, Any]]:
        """Тегли карта и прилага ефекта ѝ."""
        state = self.state
        deck = state.decks[deck_id]
        card = deck.draw(self.rng)
        text = self._resolve_card_text(card, player)
        deck_name = "Обществено събитие" if deck_id == "community" else "Бизнес възможност"
        events: list[dict[str, Any]] = [
            {"type": "card", "player_id": player.player_id,
             "deck": deck_id, "card_id": card.card_id, "text": text,
             "icon": card.icon, "tone": card_tone(card),
             "legendary": card.legendary},
            self._log(
                f'{player.name} тегли „{deck_name}": {text}',
                "legendary" if card.legendary else "card",
            ),
        ]
        events.extend(self._apply_card(player, card, deck, text))
        return events

    def _apply_card(
        self, player: Player, card: Card, deck: Deck, text: str | None = None
    ) -> list[dict[str, Any]]:
        """Прилага ефекта. ``text`` е вече резолвнатият текст на картата —
        в него имената на играчите са заместени и точно той трябва да стигне
        до логовете и до чакащия избор."""
        state = self.state
        effect = card.effect
        etype = effect["type"]
        text = text if text is not None else card.text
        events: list[dict[str, Any]] = []

        if etype == "gain":
            player.cash += effect["amount"]
            self._stat(player, "cash_received", effect["amount"])
            self._track_cash(player)
            self._bank_record(None, player, effect["amount"], "Приход от карта")
            events.append({"type": "payment", "from": None,
                           "to": player.player_id, "amount": effect["amount"]})
            state.phase = Phase.MANAGEMENT
        elif etype == "pay":
            events.extend(self._charge(player, None, effect["amount"], text))
        elif etype in ("nearest_transport", "nearest_utility"):
            deck.discard(card.card_id)
            target_type = "transport" if etype == "nearest_transport" else "utility"
            candidates = [
                space.position for space in self.board.spaces
                if space.type == target_type
            ]
            target = min(
                candidates,
                key=lambda pos: (pos - player.position) % self.board.size or self.board.size,
            )
            steps = (target - player.position) % self.board.size or self.board.size
            if etype == "nearest_transport":
                player.modifiers["double_transport_rent"] = 1
            else:
                player.modifiers["utility_special_rent"] = 1
            events.extend(self._move_player(player, steps))
            return events
        elif etype == "move_to":
            deck.discard(card.card_id)
            steps = (effect["position"] - player.position) % self.board.size
            if steps == 0:
                steps = self.board.size
            events.extend(self._move_player(player, steps))
            return events
        elif etype == "move_by":
            deck.discard(card.card_id)
            steps = effect["steps"]
            events.extend(self._move_player(player, steps, collect_start=steps > 0))
            return events
        elif etype == "repair":
            per_level = effect["per_level"]
            total_levels = sum(
                prop.level for prop in state.properties.values()
                if prop.owner == player.player_id
            )
            cost = per_level * total_levels
            if cost > 0:
                events.append(self._log(
                    f"{player.name} дължи {cost} € за поддръжка "
                    f"({total_levels} нива × {per_level} €).", "money",
                ))
                events.extend(self._charge(player, None, cost, "Поддръжка на обектите"))
            else:
                state.phase = Phase.MANAGEMENT
        elif etype == "pay_each":
            amount = effect["amount"]
            others = [p for p in state.active_players() if p.player_id != player.player_id]
            total = amount * len(others)
            if player.cash >= total:
                for other in others:
                    self._transfer(player, other, amount, "card", "Плащане по карта")
                    events.append({"type": "payment", "from": player.player_id,
                                   "to": other.player_id, "amount": amount})
                state.phase = Phase.MANAGEMENT
            else:
                # Опростяване: задължението отива към банката, а получателите
                # се компенсират от нея веднага.
                for other in others:
                    other.cash += amount
                    self._bank_record(None, other, amount, "Компенсация по карта")
                    events.append({"type": "payment", "from": None,
                                   "to": other.player_id, "amount": amount})
                events.extend(self._charge(player, None, total, text))
        elif etype == "collect_each":
            amount = effect["amount"]
            for other in state.active_players():
                if other.player_id == player.player_id:
                    continue
                paid = min(amount, max(other.cash, 0))
                other.cash -= paid
                player.cash += paid
                self._bank_record(other, player, paid, "Плащане по карта")
                events.append({"type": "payment", "from": other.player_id,
                               "to": player.player_id, "amount": paid})
            state.phase = Phase.MANAGEMENT
        elif etype == "jail_free":
            player.jail_card_ids.append(card.card_id)
            state.phase = Phase.MANAGEMENT
            # Картата не се връща в тестето, докато не бъде използвана.
            return events
        elif etype == "keep":
            player.held_cards.append(card.card_id)
            state.phase = Phase.MANAGEMENT
            # Остава в ръката; връща се в тестето при изчерпване.
            return events
        elif etype == "goto_jail":
            deck.discard(card.card_id)
            events.extend(self._send_to_jail(player))
            return events
        elif etype == "all_move_by":
            # Легендарно: цялата маса се мести. Тегленето на карта от новото
            # поле е изключено — иначе една карта може да задейства верига
            # от карти и ходът да се разплете непредвидимо.
            deck.discard(card.card_id)
            steps = int(effect["steps"])
            for other in list(state.active_players()):
                events.extend(self._move_player(
                    other, steps, collect_start=steps > 0, resolve=False,
                ))
            state.phase = Phase.MANAGEMENT
            return events
        elif etype == "all_cash":
            # Сумата е със знак. При отрицателна всеки плаща колкото има —
            # съзнателно опростяване: системата за задължения работи с един
            # длъжник, а тук всички биха станали длъжници едновременно.
            deck.discard(card.card_id)
            amount = int(effect["amount"])
            for other in state.active_players():
                if amount >= 0:
                    other.cash += amount
                    self._stat(other, "cash_received", amount)
                    self._track_cash(other)
                    self._bank_record(None, other, amount, "Легендарна карта")
                    events.append({"type": "payment", "from": None,
                                   "to": other.player_id, "amount": amount})
                else:
                    paid = min(-amount, max(other.cash, 0))
                    if paid <= 0:
                        continue
                    other.cash -= paid
                    self._stat(other, "bank_paid", paid)
                    self._bank_record(other, None, paid, "Легендарна карта")
                    events.append({"type": "payment", "from": other.player_id,
                                   "to": None, "amount": paid})
            state.phase = Phase.MANAGEMENT
            return events
        elif etype == "choice":
            # Картата се връща в тестето веднага: чакащото състояние носи
            # всичко нужно за показване и решаване, така че няма причина да
            # държим лист извън тестето, докато играчът мисли.
            deck.discard(card.card_id)
            safe = effect.get("safe", {})
            risky = effect.get("risky", {})
            state.pending_card_choice = PendingCardChoice(
                player_id=player.player_id,
                card_text=text,
                deck=card.deck,
                icon=card.icon or "🎲",
                safe_label=str(safe.get("label", "Сигурният вариант")),
                safe_amount=int(safe.get("amount", 0)),
                risky_label=str(risky.get("label", "Рискът")),
                risky_note=str(risky.get("note", "")),
                risky_win=int(risky.get("win", 0)),
                risky_lose=int(risky.get("lose", 0)),
            )
            state.phase = Phase.AWAITING_CARD_CHOICE
            events.append({
                "type": "card_choice",
                "choice": state.pending_card_choice.to_dict(),
            })
            return events
        elif etype == "extra_turn":
            player.modifiers["extra_turn"] = 1
            state.phase = Phase.MANAGEMENT
        elif etype == "rent_discount":
            player.modifiers["rent_discount"] = 1
            state.phase = Phase.MANAGEMENT
        elif etype == "start_bonus":
            player.modifiers["start_bonus"] = 1
            state.phase = Phase.MANAGEMENT
        else:
            state.phase = Phase.MANAGEMENT

        deck.discard(card.card_id)
        return events

    # ------------------------------------------------------------------
    # Карта с избор: сигурен вариант или залог на зара
    # ------------------------------------------------------------------
    def _settle_choice_amount(
        self, player: Player, amount: int, reason: str
    ) -> list[dict[str, Any]]:
        """Прилага сума със знак: положителна печели, отрицателна плаща."""
        state = self.state
        if amount > 0:
            player.cash += amount
            self._stat(player, "cash_received", amount)
            self._track_cash(player)
            self._bank_record(None, player, amount, reason)
            state.phase = Phase.MANAGEMENT
            return [{"type": "payment", "from": None,
                     "to": player.player_id, "amount": amount}]
        if amount < 0:
            # _charge сам влиза в AWAITING_PAYMENT, ако парите не стигат.
            return self._charge(player, None, -amount, reason)
        state.phase = Phase.MANAGEMENT
        return []

    def resolve_card_choice(
        self, player_id: str, option: str
    ) -> list[dict[str, Any]]:
        """Изпълнява избора по изтеглената карта: ``safe`` или ``risky``."""
        self._require_phase(Phase.AWAITING_CARD_CHOICE)
        state = self.state
        pending = state.pending_card_choice
        if pending is None or pending.player_id != player_id:
            raise GameError("Нямате чакащ избор по карта.")
        if option not in ("safe", "risky"):
            raise GameError("Невалиден избор.")
        player = self._require_player(player_id)
        # Изчистваме чакащото състояние преди прилагането: иначе при недостиг
        # на средства фазата става AWAITING_PAYMENT, а изборът виси наполовина.
        state.pending_card_choice = None
        events: list[dict[str, Any]] = []

        if option == "safe":
            events.append(self._log(
                f"{player.name} избира сигурния вариант: {pending.safe_label}.",
                "card",
            ))
            events.extend(self._settle_choice_amount(
                player, pending.safe_amount, "Избор по карта",
            ))
            return events

        roll = self.rng.randint(1, 6)
        won = roll % 2 == 0
        amount = pending.risky_win if won else pending.risky_lose
        events.append(self._log(
            f"{player.name} рискува: {pending.risky_label}. Зарът показва {roll} — "
            f"{'късмет' if won else 'няма късмет'}!", "card",
        ))
        events.append({
            "type": "choice_roll", "player_id": player_id,
            "roll": roll, "won": won, "amount": amount,
        })
        events.extend(self._settle_choice_amount(
            player, amount, "Залог по карта",
        ))
        return events

    # ------------------------------------------------------------------
    # Административна проверка — платено/картово излизане
    # ------------------------------------------------------------------
    def pay_jail_fee(self, player_id: str) -> list[dict[str, Any]]:
        """Плащане на административната такса за незабавно освобождаване."""
        self._require_phase(Phase.WAITING_FOR_ROLL)
        player = self._require_current(player_id)
        if not player.in_jail:
            raise GameError("Не сте на административна проверка.")
        fee = self.state.settings.jail_fee
        if player.cash < fee:
            raise GameError("Нямате достатъчно средства за таксата.")
        self._transfer(player, None, fee, reason="Административна такса")
        player.in_jail = False
        player.jail_turns = 0
        return [
            self._log(f"{player.name} плаща {fee} € и преминава проверката.", "jail"),
            {"type": "payment", "from": player.player_id, "to": None, "amount": fee},
        ]

    def _return_jail_card(self, card_id: str) -> None:
        """Връща конкретна карта „освобождаване" на дъното на своето тесте."""
        deck = self.state.decks.get(deck_of(card_id))
        if deck is None or card_id in deck.draw_pile or card_id in deck.discard_pile:
            return
        deck.discard(card_id)

    def use_jail_card(self, player_id: str) -> list[dict[str, Any]]:
        """Използване на карта „освобождаване от проверка"."""
        self._require_phase(Phase.WAITING_FOR_ROLL)
        player = self._require_current(player_id)
        if not player.in_jail:
            raise GameError("Не сте на административна проверка.")
        # Само чиновническата карта освобождава по избор. Адвокатската
        # действа предварително и не помага, щом вече сте вътре.
        card_id = next(
            (cid for cid in player.jail_card_ids if jail_card_mode(cid) == "release"),
            None,
        )
        if card_id is None:
            raise GameError("Нямате карта, с която да излезете от проверката.")
        player.jail_card_ids.remove(card_id)
        player.in_jail = False
        player.jail_turns = 0
        # Връща се точно изиграната карта, и то в своето тесте.
        self._return_jail_card(card_id)
        return [self._log(
            f"{player.name} използва карта и преминава проверката.", "jail"
        )]

    # ------------------------------------------------------------------
    # Край на хода
    # ------------------------------------------------------------------
    def end_turn(self, player_id: str) -> list[dict[str, Any]]:
        """Приключване на хода; двойните зарове и extra_turn дават нов ход."""
        self._require_phase(Phase.MANAGEMENT)
        player = self._require_current(player_id)
        state = self.state

        if state.debt is not None:
            raise GameError("Първо уредете задължението си.")

        # Нормално приключен ход прекъсва поредицата от неактивни ходове.
        player.stats["consecutive_timeouts"] = 0

        events: list[dict[str, Any]] = []

        # Допълнителен ход от карта.
        if player.modifiers.pop("extra_turn", 0):
            state.phase = Phase.WAITING_FOR_ROLL
            self.touch_turn_clock()
            events.append(self._log(f"{player.name} играе допълнителен ход!", "info"))
            events.append({"type": "turn", "player_id": player_id, "extra": True})
            return events

        # Двойни зарове (ако не е в проверка) → нов ход за същия играч.
        if (
            state.last_roll
            and state.last_roll[0] == state.last_roll[1]
            and not player.in_jail
            and state.doubles_count > 0
        ):
            state.phase = Phase.WAITING_FOR_ROLL
            self.touch_turn_clock()
            events.append(self._log(
                f"{player.name} хвърли чифт и играе отново.", "info"
            ))
            events.append({"type": "turn", "player_id": player_id, "extra": True})
            return events

        events.extend(self._advance_turn())
        return events

    def _advance_turn(self) -> list[dict[str, Any]]:
        """Предава хода на следващия активен играч."""
        state = self.state
        state.doubles_count = 0
        state.last_roll = None
        total = len(state.turn_order)
        if total == 0:
            return []
        round_events: list[dict[str, Any]] = []
        for _ in range(total):
            state.current_index = (state.current_index + 1) % total
            if state.current_index == 0:
                state.round_number += 1
                self._record_wealth()
                round_events.extend(self._update_global_events())
            candidate = state.players.get(state.current_player_id or "")
            if candidate and not candidate.bankrupt:
                break
        # Мисионният бонус участва в богатството преди проверка за победа.
        events = round_events + self.collect_social_events() + self._check_victory()
        if state.phase == Phase.GAME_OVER:
            return events
        state.phase = Phase.WAITING_FOR_ROLL
        self.touch_turn_clock()
        current = state.current_player
        if current:
            events.append(self._log(f"Ред е на {current.name}.", "turn"))
            events.append({"type": "turn", "player_id": current.player_id, "extra": False})
            # Лихвата се проверява в началото на хода, но се начислява само
            # ако е завършена нова обиколка — единствената точка на начисляване.
            events.extend(self._accrue_loan_interest(current))
        return events

    def auto_end_turn(self, player_id: str) -> list[dict[str, Any]]:
        """Изтекло време СЛЕД изигран ход: приключва го като нормален край.

        Играч, който е хвърлил и действал, но не е натиснал „Приключи хода",
        не бива да се брои за неактивен — end_turn() нулира брояча.
        """
        state = self.state
        if state.current_player_id != player_id:
            raise GameError("Играчът не е на ход.")
        self._require_phase(Phase.MANAGEMENT)
        if state.debt is not None:
            raise GameError("Има неуредено задължение.")
        player = state.players.get(player_id)
        events: list[dict[str, Any]] = []
        if player:
            events.append(self._log(
                f"Времето на {player.name} изтече — ходът приключва автоматично.",
                "warning",
            ))
        events.extend(self.end_turn(player_id))
        return events

    def force_skip_turn(
        self, player_id: str, timed_out: bool = False
    ) -> list[dict[str, Any]]:
        """Пропускане на хода: от домакина или автоматично при изтекло време."""
        state = self.state
        if state.current_player_id != player_id:
            raise GameError("Играчът не е на ход.")
        if state.phase == Phase.GAME_OVER:
            raise GameError("Играта е приключила.")
        if state.phase == Phase.AWAITING_AUCTION:
            raise GameError("Изчакайте края на търга.")
        player = state.players.get(player_id)
        events: list[dict[str, Any]] = []
        if player:
            if timed_out:
                timeouts = player.stats.get("consecutive_timeouts", 0) + 1
                player.stats["consecutive_timeouts"] = timeouts
            message = (
                f"Времето на {player.name} изтече — ходът се пропуска."
                if timed_out else f"Ходът на {player.name} е пропуснат."
            )
            events.append(self._log(message, "warning"))
            if timed_out and timeouts >= 2:
                events.append(self._log(
                    f"{player.name} е неактивен за {timeouts} поредни хода — "
                    "домакинът вече може да премахне играча.",
                    "warning",
                ))
        # Изчистване на междинни състояния.
        if (
            state.phase == Phase.AWAITING_CARD_CHOICE
            and state.pending_card_choice is not None
            and state.pending_card_choice.player_id == player_id
        ):
            # Неотговорилият получава сигурния вариант — залогът е решение,
            # което не бива да се взема вместо играча. Ако плащането го вкара
            # в дълг, блокът за AWAITING_PAYMENT по-долу поема оттам.
            events.extend(self.resolve_card_choice(player_id, "safe"))
        if state.phase == Phase.AWAITING_PURCHASE:
            pass  # имотът просто остава свободен
        if state.phase == Phase.AWAITING_PAYMENT and state.debt is not None:
            debt = state.debt
            # При изтекло време първо се продават нужните подобрения и се
            # използват допустимите ипотеки. Фалит има само ако и след тази
            # ликвидация сумата остава непосилна. Важи и за дълг към банката
            # (данък, такса, лихва): кредиторът не променя факта, че играчът
            # има активи, с които може да плати.
            if timed_out and debt.debtor == player_id:
                events.extend(self._auto_liquidate_for_debt(player_id))
                if player is not None and player.cash >= debt.amount:
                    payment_events = self.settle_debt(player_id)
                    for event in payment_events:
                        if event.get("type") != "log":
                            event["instant"] = True
                            event["automatic"] = True
                    events.extend(payment_events)
                    # Пропускането на хода е самата цел тук: предаваме реда
                    # независимо дали дългът е дошъл преди хвърлянето
                    # (WAITING_FOR_ROLL) или по време на хода (MANAGEMENT).
                    if state.phase in (Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL):
                        events.extend(self._advance_turn())
                    return events
            return events + self.declare_bankruptcy(player_id)
        state.phase = Phase.MANAGEMENT
        state.debt = None
        events.extend(self._advance_turn())
        return events

    def remove_player(self, player_id: str) -> list[dict[str, Any]]:
        """Премахва играч (напускане/изгонване); активите се връщат на банката."""
        state = self.state
        player = state.players.get(player_id)
        if player is None or player.bankrupt:
            return []
        events: list[dict[str, Any]] = [
            self._log(f"{player.name} напуска играта.", "warning"),
        ]
        for prop in state.properties.values():
            if prop.owner == player_id:
                prop.owner = None
                prop.level = 0
                prop.mortgaged = False
        self._mark_bankrupt(player)
        player.cash = 0
        state.debt = None if (state.debt and state.debt.debtor == player_id) else state.debt

        events.extend(self._check_victory())
        if state.phase != Phase.GAME_OVER and state.current_player_id == player_id:
            state.phase = Phase.MANAGEMENT
            events.extend(self._advance_turn())
        return events
