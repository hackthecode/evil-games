"""Строителство, ипотеки, банкови заеми и продажба на банката.

Миксин към :class:`~app.game.engine.GameEngine`.
"""
from __future__ import annotations

from typing import Any

from .errors import GameError
from .player import Player
from .properties import (
    bank_stock,
    can_build,
    can_sell_improvement,
    group_has_buildings,
    owns_full_group,
)
from .state import PendingDebt, Phase


class AssetsMixin:
    """Част от игровия двигател; вижте модулния низ."""

    # ------------------------------------------------------------------
    # Строителство, ипотеки
    # ------------------------------------------------------------------
    def _building_auction_targets(self, kind: str) -> dict[str, int]:
        """По един равномерно допустим имот за всеки желаещ участник."""
        targets: dict[str, int] = {}
        for candidate in self.state.active_players():
            options: list[int] = []
            for pos, prop in self.state.properties.items():
                if prop.owner != candidate.player_id:
                    continue
                ok, _ = can_build(
                    self.board, self.state.properties, candidate.player_id,
                    pos, check_stock=False,
                )
                if not ok:
                    continue
                target_level = prop.level + 1
                if (kind == "house" and target_level <= 4) or (
                    kind == "hotel" and target_level == 5
                ):
                    if candidate.cash >= self.current_build_cost(pos):
                        options.append(pos)
            if options:
                targets[candidate.player_id] = min(
                    options,
                    key=lambda pos: (
                        self.state.properties[pos].level,
                        self.current_build_cost(pos),
                        pos,
                    ),
                )
        return targets

    def build_improvement(self, player_id: str, position: int) -> list[dict[str, Any]]:
        """Строеж на следващо ниво подобрение върху имот."""
        self._require_phase(Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL)
        player = self._require_current(player_id)
        state = self.state
        ok, why = can_build(
            self.board, state.properties, player_id, position, check_stock=False
        )
        if not ok:
            raise GameError(why)
        space = self.board.space(position)
        cost = self.current_build_cost(position)
        # Проверката е по цената СЛЕД евентуалната отстъпка, но картата се
        # хаби чак при плащането — иначе се губи при търг за последна сграда.
        if player.cash < self._peek_held_percent(player, "build_discount", cost):
            raise GameError("Нямате достатъчно средства за подобрението.")
        prop = state.properties[position]
        kind = "hotel" if prop.level + 1 == 5 else "house"
        houses_free, hotels_free = bank_stock(state.properties)
        free = hotels_free if kind == "hotel" else houses_free
        if free <= 0:
            raise GameError(
                "В банката няма свободни хотели."
                if kind == "hotel" else "В банката няма свободни къщи."
            )
        targets = self._building_auction_targets(kind)
        if free == 1 and len(targets) > 1:
            targets[player_id] = position
            minimum = min(
                self.current_build_cost(pos)
                for pos in targets.values()
            )
            return self._start_auction(
                position, state.phase, kind=kind,
                participants=list(targets), targets=targets,
                minimum_bid=minimum,
            )
        # Държана карта за строеж — прилага се след глобалното събитие.
        build_notes: list[dict[str, Any]] = []
        discounted, card = self._apply_held_percent(player, "build_discount", cost)
        if card is not None:
            build_notes.append(self._log(
                f"Картата на {player.name} сваля строежа от {cost} € на {discounted} €.",
                "card",
            ))
            cost = discounted
        player.cash -= cost
        self._stat(player, "bank_paid", cost)
        self._bank_record(player, None, cost, f"Строеж в {space.name}")
        prop.level += 1
        level_name = self.board.improvement_levels[prop.level]
        return build_notes + [
            self._log(
                f'{player.name} развива „{space.name}" до „{level_name}" за {cost} €.',
                "build",
            ),
            {"type": "build", "player_id": player_id,
             "position": position, "level": prop.level},
            {"type": "payment", "from": player_id, "to": None, "amount": cost},
        ]

    def build_group(self, player_id: str, group: str) -> list[dict[str, Any]]:
        """Развива цялата цветова група с едно ниво (равномерно).

        Строи върху всеки имот от групата, започвайки от най-ниските нива, за
        да се спази правилото за равномерност. Спира, ако средствата или
        строителният фонд свършат, или ако започне търг за последна постройка.
        """
        self._require_phase(Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL)
        self._require_current(player_id)
        state = self.state
        positions = [
            pos for pos in self.board.group_positions(group)
            if self.board.space(pos).type == "property"
        ]
        if not positions:
            raise GameError("Няма имоти в тази група.")
        if not owns_full_group(self.board, state.properties, player_id, group):
            raise GameError("Нужна е пълна група без ипотеки.")

        start_levels = {pos: state.properties[pos].level for pos in positions}
        events: list[dict[str, Any]] = []
        built = 0
        # Всеки имот трябва да се вдигне най-много с едно ниво спрямо старта.
        while True:
            candidates = [
                pos for pos in positions
                if state.properties[pos].level < start_levels[pos] + 1
                and can_build(self.board, state.properties, player_id, pos)[0]
            ]
            if not candidates:
                break
            # Най-ниското ниво първо — това пази равномерността. При равни
            # нива се строи първо върху най-скъпия имот: ако парите свършат
            # по средата, къщите остават там, където носят най-висок наем,
            # вместо на най-евтината територия.
            target = min(candidates, key=lambda pos: (
                state.properties[pos].level,
                -int(self.board.space(pos).price or 0),
                -pos,
            ))
            try:
                result = self.build_improvement(player_id, target)
            except GameError:
                break
            for event in result:
                if event.get("type") in {"build", "payment"}:
                    event["fast"] = True
                    event["group_build"] = True
            events.extend(result)
            built += 1
            # Ако е започнал търг за последна постройка — спираме тук.
            if any(ev.get("type") == "auction_start" for ev in result):
                return events

        if built == 0:
            ok, why = can_build(self.board, state.properties, player_id, positions[0])
            raise GameError(why or "Строежът не е възможен в момента.")
        group_name = self.board.groups.get(group, {}).get("name", group)
        events.insert(0, self._log(
            f'{state.players[player_id].name} развива групата „{group_name}" '
            f"({built} подобрения).", "build",
        ))
        return events

    def sell_improvement(self, player_id: str, position: int) -> list[dict[str, Any]]:
        """Продажба на едно ниво подобрение (на половин цена)."""
        self._require_phase(
            Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL, Phase.AWAITING_PAYMENT
        )
        player = self._require_player(player_id)
        state = self.state
        if (
            state.phase == Phase.AWAITING_PAYMENT
            and (state.debt is None or state.debt.debtor != player_id)
        ):
            raise GameError("Само длъжникът може да набавя средства в тази фаза.")
        ok, why = can_sell_improvement(self.board, state.properties, player_id, position)
        if not ok:
            raise GameError(why)
        space = self.board.space(position)
        refund = space.data["improve_cost"] // 2
        prop = state.properties[position]
        sold_level = prop.level
        prop.level -= 1
        player.cash += refund
        self._stat(player, "cash_received", refund)
        self._track_cash(player)
        self._bank_record(None, player, refund, f"Продажба на постройка в {space.name}")
        return [
            self._log(
                f'{player.name} продава подобрение на „{space.name}" за {refund} €.',
                "build",
            ),
            {"type": "sell_improvement", "player_id": player_id,
             "position": position, "level": prop.level, "sold_level": sold_level},
            {"type": "payment", "from": None, "to": player_id, "amount": refund},
        ]

    def sell_group(self, player_id: str, group: str) -> list[dict[str, Any]]:
        """Продава по едно ниво подобрение от всеки имот в групата (равномерно).

        Продава от най-високите нива надолу, за да се пази равномерността.
        Работи и по време на набавяне на средства (фаза AWAITING_PAYMENT).
        """
        self._require_phase(
            Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL, Phase.AWAITING_PAYMENT
        )
        player = self._require_player(player_id)
        state = self.state
        if (
            state.phase == Phase.AWAITING_PAYMENT
            and (state.debt is None or state.debt.debtor != player_id)
        ):
            raise GameError("Само длъжникът може да набавя средства в тази фаза.")
        positions = [
            pos for pos in self.board.group_positions(group)
            if self.board.space(pos).type == "property"
        ]
        owned = [
            pos for pos in positions
            if (p := state.properties.get(pos)) is not None and p.owner == player_id
        ]
        if not owned:
            raise GameError("Не притежавате имоти в тази група.")

        start_levels = {pos: state.properties[pos].level for pos in owned}
        events: list[dict[str, Any]] = []
        sold = 0
        # Всеки имот пада най-много с едно ниво спрямо старта.
        while True:
            candidates = [
                pos for pos in owned
                if state.properties[pos].level > max(0, start_levels[pos] - 1)
                and can_sell_improvement(
                    self.board, state.properties, player_id, pos
                )[0]
            ]
            if not candidates:
                break
            # Най-високото ниво първо (пази равномерността).
            target = max(candidates, key=lambda pos: state.properties[pos].level)
            try:
                result = self.sell_improvement(player_id, target)
            except GameError:
                break
            for event in result:
                if event.get("type") in {"sell_improvement", "payment"}:
                    event["fast"] = True
                    event["group_sell"] = True
            events.extend(result)
            sold += 1

        if sold == 0:
            raise GameError("Няма подобрения за продажба в тази група.")
        group_name = self.board.groups.get(group, {}).get("name", group)
        events.insert(0, self._log(
            f'{player.name} продава подобрения от групата „{group_name}" '
            f"({sold} нива).", "build",
        ))
        return events

    def mortgage_property(self, player_id: str, position: int) -> list[dict[str, Any]]:
        """Ипотекиране на имот срещу половината от стойността му."""
        self._require_phase(
            Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL, Phase.AWAITING_PAYMENT
        )
        player = self._require_player(player_id)
        state = self.state
        if (
            state.phase == Phase.AWAITING_PAYMENT
            and (state.debt is None or state.debt.debtor != player_id)
        ):
            raise GameError("Само длъжникът може да набавя средства в тази фаза.")
        prop = state.properties.get(position)
        space = self.board.space(position)
        if prop is None or prop.owner != player_id:
            raise GameError("Не притежавате този имот.")
        if prop.mortgaged:
            raise GameError("Имотът вече е ипотекиран.")
        if space.type == "property" and group_has_buildings(
            self.board, state.properties, space.group
        ):
            raise GameError(
                "Първо продайте всички постройки в групата, за да ипотекирате."
            )
        value = space.data["mortgage"]
        prop.mortgaged = True
        player.cash += value
        self._stat(player, "cash_received", value)
        self._track_cash(player)
        self._bank_record(None, player, value, f"Ипотека на {space.name}")
        return [
            self._log(f'{player.name} ипотекира „{space.name}" за {value} €.', "mortgage"),
            {"type": "mortgage", "player_id": player_id, "position": position},
            {"type": "payment", "from": None, "to": player_id, "amount": value},
        ]

    def sell_property_to_bank(self, player_id: str, position: int) -> list[dict[str, Any]]:
        """Продажба на имот обратно на банката за дял от цената.

        По-разрушително от ипотеката — имотът се губи и отива свободен —
        затова съветникът при дълг го оставя за последна мярка. Ипотекиран
        имот първо се откупува: така не се налага да смятаме остатъчна
        стойност срещу главницата.
        """
        self._require_phase(
            Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL, Phase.AWAITING_PAYMENT
        )
        state = self.state
        player = self._require_player(player_id)
        if not state.settings.sell_to_bank_enabled:
            raise GameError("Обратното изкупуване е изключено в тази стая.")
        if state.auction is not None:
            raise GameError("Изчакайте края на търга.")
        if (
            state.phase == Phase.AWAITING_PAYMENT
            and (state.debt is None or state.debt.debtor != player_id)
        ):
            raise GameError("Само длъжникът може да набавя средства в тази фаза.")
        prop = state.properties.get(position)
        space = self.board.space(position)
        if prop is None or prop.owner != player_id:
            raise GameError("Не притежавате този имот.")
        if prop.level:
            raise GameError("Първо продайте постройките върху имота.")
        if space.type == "property" and group_has_buildings(
            self.board, state.properties, space.group
        ):
            raise GameError(
                "Първо продайте всички постройки в групата, за да продадете имота."
            )
        value = self.sell_to_bank_value(position)
        del state.properties[position]
        state.celebrated_monopolies = [
            key for key in state.celebrated_monopolies
            if not (space.group and key.endswith(f":{space.group}"))
        ]
        player.cash += value
        self._stat(player, "cash_received", value)
        self._track_cash(player)
        self._bank_record(None, player, value, f"Продажба на {space.name}")
        return [
            self._log(
                f'{player.name} продава „{space.name}" на банката за {value} € '
                f"({self.state.settings.sell_to_bank_percent}% от цената). "
                "Имотът отново е свободен.",
                "mortgage",
            ),
            {"type": "sell_property", "player_id": player_id, "position": position,
             "amount": value},
            {"type": "payment", "from": None, "to": player_id, "amount": value},
        ]

    # ------------------------------------------------------------------
    # Банков заем
    # ------------------------------------------------------------------
    def loan_capacity(self, player_id: str) -> int:
        """Колко още може да заеме играчът.

        Таванът е дял от стойността на незаложените имоти и сградите му и
        се проверява САМО при отпускане. След това лихвата може да изкачи
        остатъка над тавана — това е очаквано, не нарушение.
        Без имоти таванът е 0, тоест няма право на заем.
        """
        player = self._require_player(player_id)
        if not self.state.settings.loans_enabled:
            return 0
        assets = player.asset_value(self.board, self.state.properties)
        percent = int(self.state.settings.loan_max_percent)
        return max(0, assets * percent // 100 - player.loan)

    def take_loan(self, player_id: str, amount: int) -> list[dict[str, Any]]:
        """Тегли заем от банката срещу залог на портфейла."""
        self._require_phase(
            Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL, Phase.AWAITING_PURCHASE
        )
        player = self._require_player(player_id)
        if not self.state.settings.loans_enabled:
            raise GameError("Заемите са изключени в тази стая.")
        amount = int(amount)
        if amount <= 0:
            raise GameError("Сумата на заема трябва да е положителна.")
        capacity = self.loan_capacity(player_id)
        if capacity <= 0:
            raise GameError(
                "Банката не отпуска заем без незаложени имоти."
                if player.asset_value(self.board, self.state.properties) <= 0
                else "Достигнахте тавана на заема спрямо активите си."
            )
        if amount > capacity:
            raise GameError(f"Максималният заем сега е {capacity} €.")
        if player.loan <= 0:
            # Нов заем: броячът тръгва оттук, за да мине пълна обиколка
            # преди първата лихва. Оттук се мери и гратисът.
            player.loan_lap = int(player.stats.get("laps", 0))
            player.loan_taken_lap = player.loan_lap
        # При доливане към съществуващ заем гратисът НЕ се подновява —
        # иначе всяко ново теглене би отлагало разплащането безкрайно.
        player.loan += amount
        player.cash += amount
        self._stat(player, "cash_received", amount)
        self._track_cash(player)
        self._bank_record(None, player, amount, "Банков заем")
        return [
            self._log(
                f"{player.name} тегли заем от {amount} €. Лихва "
                f"{self.state.settings.loan_interest_percent}% в брой при "
                "всяка пълна обиколка на таблото.",
                "money",
            ),
            {"type": "loan_taken", "player_id": player_id, "amount": amount,
             "balance": player.loan},
            {"type": "payment", "from": None, "to": player_id, "amount": amount},
        ]

    def repay_loan(self, player_id: str, amount: int | None = None) -> list[dict[str, Any]]:
        """Погасяване на заема — изцяло или частично."""
        self._require_phase(Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL)
        player = self._require_player(player_id)
        if player.loan <= 0:
            raise GameError("Нямате заем за погасяване.")
        payment = player.loan if amount is None else int(amount)
        payment = min(payment, player.loan, player.cash)
        if payment <= 0:
            raise GameError("Нямате средства за погасяване.")
        player.loan -= payment
        player.cash -= payment
        self._stat(player, "bank_paid", payment)
        self._bank_record(player, None, payment, "Погасяване на заем")
        note = (
            "Заемът е погасен изцяло."
            if player.loan <= 0 else f"Остават {player.loan} €."
        )
        return [
            self._log(f"{player.name} погасява {payment} € по заема. {note}", "money"),
            {"type": "loan_repaid", "player_id": player_id, "amount": payment,
             "balance": player.loan},
            {"type": "payment", "from": player_id, "to": None, "amount": payment},
        ]

    def _accrue_loan_interest(self, player: Player) -> list[dict[str, Any]]:
        """Начислява лихвата за всяка изминала обиколка на длъжника.

        Лихвата се ПЛАЩА в брой, а не се трупа върху главницата — така
        заемът има постоянна цена, вместо да е безплатен до края на
        партията. Три изхода за всяка обиколка:

        * има пари → плаща се и заемът остава непроменен;
        * няма пари, но гратисът тече → лихвата се добавя към заема
          (следващата се смята върху новия размер);
        * няма пари и гратисът е изтекъл → минава по обичайния път за
          задължения: продай, ипотекирай или фалирай.

        Начислява се в НАЧАЛОТО на хода, затова плащането в брой не минава
        през ``_charge``: той мести фазата към MANAGEMENT и би отнел
        хвърлянето на играча. При недостиг фазата се сменя нарочно, а
        ``resume_phase`` връща играча към хвърлянето след уреждането.
        """
        state = self.state
        if player.loan <= 0 or player.bankrupt:
            return []
        laps = int(player.stats.get("laps", 0))
        pending = laps - player.loan_lap
        if pending <= 0:
            return []
        percent = int(state.settings.loan_interest_percent)
        if percent <= 0:
            player.loan_lap = laps
            return []

        grace = int(state.settings.loan_grace_laps)
        events: list[dict[str, Any]] = []
        # Броячът се вдига в края, а не тук: при прекъсване по средата
        # неизминатите обиколки трябва да останат за следващия път, вместо
        # да бъдат опростени.
        for done in range(pending):     # пропуснати обиколки не се губят
            interest = player.loan * percent // 100
            if interest <= 0:
                break
            if player.cash >= interest:
                self._transfer(player, None, interest, "bank", "Лихва по заем")
                events.extend([
                    self._log(
                        f"{player.name} плаща {interest} € лихва по заема "
                        f"({percent}%). Остатък по заема: {player.loan} €.",
                        "money",
                    ),
                    {"type": "payment", "from": player.player_id,
                     "to": None, "amount": interest},
                ])
                continue
            # Включително самата десета обиколка: гратисът е „10
            # обиколки от заема“, а не девет.
            if laps - player.loan_taken_lap <= grace:
                player.loan += interest
                events.extend([
                    self._log(
                        f"{player.name} няма средства за лихвата — {interest} € "
                        f"се добавят към заема. Остатък: {player.loan} €.",
                        "warning",
                    ),
                    {"type": "loan_interest", "player_id": player.player_id,
                     "amount": interest, "balance": player.loan},
                ])
                continue
            # Гратисът е изтекъл. Само едно задължение може да виси
            # наведнъж, затова спираме тук и оставяме останалите обиколки
            # за следващия път. Текущата се брои за приключена — сумата ѝ
            # се събира през задължението, а не наново на следващия ход.
            player.loan_lap += done + 1
            events.append(self._log(
                f"Гратисният период на {player.name} изтече — лихвата от "
                f"{interest} € трябва да се плати сега.", "warning",
            ))
            events.extend(self._demand(
                player, interest, "Лихва по заем", Phase.WAITING_FOR_ROLL,
            ))
            return events

        player.loan_lap = laps
        events.extend(self._check_loan_collateral(player))
        return events

    def _demand(
        self, player: Player, amount: int, reason: str, resume: Phase,
        *, clears_loan: bool = False,
    ) -> list[dict[str, Any]]:
        """Иска сума, която играчът няма — влиза във фаза на плащане.

        Отделно от ``_charge``: тук вече знаем, че парите не стигат, и ни
        трябва контрол над фазата, към която играта се връща след уреждане.
        """
        self._enter_payment_phase(PendingDebt(
            debtor=player.player_id, creditor=None, amount=amount,
            reason=reason, resume_phase=resume.value, clears_loan=clears_loan,
        ))
        return [{"type": "debt", "debt": self.state.debt.to_dict()}]

    def _check_loan_collateral(self, player: Player) -> list[dict[str, Any]]:
        """Прибира заема, ако обезпечението вече не го покрива.

        Твърд предпазител срещу дълг, който расте без таван: щом заемът
        надхвърли стойността на имотите, банката иска целия остатък.

        Мери се по ``collateral_value`` — там ипотекираните имоти СЕ броят.
        Иначе ипотекирането (първата стъпка при набавяне на пари) само по
        себе си би сринало обезпечението и би задействало прибирането
        точно докато играчът се спасява.

        Проверява се само на границата на обиколката. Реакция при всяка
        продажба би вкарала играча в нов дълг посред ликвидацията за
        стария.
        """
        state = self.state
        if player.loan <= 0 or player.bankrupt or state.debt is not None:
            return []
        collateral = player.collateral_value(self.board, state.properties)
        if player.loan <= collateral:
            return []
        due = player.loan
        events = [self._log(
            f"Заемът на {player.name} ({due} €) надхвърли стойността на "
            f"имотите му ({collateral} €). Банката иска целия остатък.",
            "warning",
        )]
        if player.cash >= due:
            self._transfer(player, None, due, "bank", "Прибиране на заема")
            player.loan = 0
            events.extend([
                self._log(f"{player.name} издължава заема изцяло.", "money"),
                {"type": "loan_repaid", "player_id": player.player_id,
                 "amount": due, "balance": 0},
            ])
            return events
        events.extend(self._demand(
            player, due, "Прибиране на заема", Phase.WAITING_FOR_ROLL,
            clears_loan=True,
        ))
        return events

    def sell_to_bank_value(self, position: int) -> int:
        """Колко плаща банката за имота.

        При ипотекиран имот се удържа главницата — тези пари вече са
        изплатени на собственика при ипотекирането. Без това правило
        продажбата е недостижима при дълг, защото съветникът първо
        ипотекира всичко.
        """
        space = self.board.space(position)
        percent = int(self.state.settings.sell_to_bank_percent)
        payout = int(space.price or 0) * percent // 100
        prop = self.state.properties.get(position)
        if prop is not None and prop.mortgaged:
            payout -= int(space.data.get("mortgage", 0))
        return max(0, payout)

    def unmortgage_property(self, player_id: str, position: int) -> list[dict[str, Any]]:
        """Освобождаване на ипотека: стойността плюс 10% лихва."""
        self._require_phase(Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL)
        player = self._require_player(player_id)
        state = self.state
        prop = state.properties.get(position)
        space = self.board.space(position)
        if prop is None or prop.owner != player_id:
            raise GameError("Не притежавате този имот.")
        if not prop.mortgaged:
            raise GameError("Имотът не е ипотекиран.")
        cost = space.data["mortgage"] + space.data["mortgage"] // 10
        if player.cash < cost:
            raise GameError(f"Нужни са {cost} € за освобождаване на ипотеката.")
        player.cash -= cost
        self._stat(player, "bank_paid", cost)
        self._bank_record(player, None, cost, f"Откупуване на {space.name}")
        prop.mortgaged = False
        return [
            self._log(
                f'{player.name} освобождава ипотеката на „{space.name}" за {cost} €.',
                "mortgage",
            ),
            {"type": "unmortgage", "player_id": player_id, "position": position},
            {"type": "payment", "from": player_id, "to": None, "amount": cost},
        ]
