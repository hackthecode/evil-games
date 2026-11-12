"""Сериализация на пълното игрово състояние (за запис в SQLite и за клиента).

Форматът има версия (``SAVE_FORMAT_VERSION``), за да може бъдещи промени да
бъдат разпознати и повредени/несъвместими записи да бъдат отхвърлени.
"""
from __future__ import annotations

import time
from typing import Any

from .board import Board
from .advisor import build_debt_advice
from .cards import JAIL_FREE_CARD_IDS, Deck, deck_of
from .missions import mission_for_client
from .player import Player
from .properties import PropertyState
from .rules import GameSettings
from .state import (
    AuctionState, GameState, PendingCardChoice, PendingDebt,
    PendingMortgageTransfer, Phase, TradeOffer,
)

SAVE_FORMAT_VERSION = 6


class SaveFormatError(Exception):
    """Повреден или несъвместим запис на игра."""


def _reconcile_jail_cards(state: GameState) -> None:
    """Привежда картите „освобождаване от проверка" в съгласувано състояние.

    Всяка от тях съществува в точно едно копие: или в нечия ръка, или в едно
    от тестетата. Записите отпреди формат 6 пазеха само брой, а по-старата
    грешка в ``use_jail_card`` можеше да остави копие едновременно в ръка и в
    тесте. Тук раздаваме идентичност еднозначно и връщаме в тестетата всичко,
    което никой не държи.
    """
    taken: set[str] = set()
    for pid in state.turn_order:
        player = state.players.get(pid)
        if player is None:
            continue
        kept: list[str] = []
        for card_id in player.jail_card_ids:
            if card_id in taken:
                # Дубликат: даваме свободна карта, ако още има такава.
                free = next(
                    (cid for cid in JAIL_FREE_CARD_IDS if cid not in taken), None
                )
                if free is None:
                    continue
                card_id = free
            taken.add(card_id)
            kept.append(card_id)
        player.jail_card_ids = kept

    for card_id in JAIL_FREE_CARD_IDS:
        deck = state.decks.get(deck_of(card_id))
        if deck is None:
            continue
        if card_id in taken:
            # Държи се от играч — не бива да стои и в тестето.
            deck.draw_pile = [cid for cid in deck.draw_pile if cid != card_id]
            deck.discard_pile = [cid for cid in deck.discard_pile if cid != card_id]
        elif card_id not in deck.draw_pile and card_id not in deck.discard_pile:
            deck.discard(card_id)


def state_to_dict(state: GameState) -> dict[str, Any]:
    """Пълна сериализация на състоянието за траен запис."""
    return {
        "format_version": SAVE_FORMAT_VERSION,
        "players": {pid: p.to_dict() for pid, p in state.players.items()},
        "turn_order": list(state.turn_order),
        "current_index": state.current_index,
        "phase": state.phase.value,
        "properties": {str(pos): p.to_dict() for pos, p in state.properties.items()},
        "decks": {did: d.to_dict() for did, d in state.decks.items()},
        "settings": state.settings.to_dict(),
        "auction": state.auction.to_dict() if state.auction else None,
        "auction_queue": list(state.auction_queue),
        "debt": state.debt.to_dict() if state.debt else None,
        "pending_card_choice": (
            state.pending_card_choice.to_dict()
            if state.pending_card_choice else None
        ),
        "pending_mortgage_transfer": (
            state.pending_mortgage_transfer.to_dict()
            if state.pending_mortgage_transfer else None
        ),
        "trades": {tid: t.to_dict() for tid, t in state.trades.items()},
        "last_roll": list(state.last_roll) if state.last_roll else None,
        "doubles_count": state.doubles_count,
        "round_number": state.round_number,
        "winner": state.winner,
        "paused": state.paused,
        "paused_at": state.paused_at,
        "paused_by": state.paused_by,
        "paused_turn_remaining": state.paused_turn_remaining,
        "paused_auction_remaining": state.paused_auction_remaining,
        "turn_deadline": state.turn_deadline,
        "log": list(state.log[-100:]),
        "started_at": state.started_at,
        "bank_pot": state.bank_pot,
        "wealth_history": list(state.wealth_history[-250:]),
        "bank_transactions": list(state.bank_transactions[-80:]),
        "event_history": list(state.event_history[-500:]),
        "active_global_event": (
            dict(state.active_global_event) if state.active_global_event else None
        ),
        "next_global_event_round": state.next_global_event_round,
        "last_global_event_id": state.last_global_event_id,
        "celebrated_monopolies": list(state.celebrated_monopolies),
        "property_income": {str(pos): inc for pos, inc in state.property_income.items()},
        "bankruptcy_order": list(state.bankruptcy_order),
    }


def state_from_dict(data: dict[str, Any]) -> GameState:
    """Възстановява състояние от запис; хвърля SaveFormatError при проблем."""
    if not isinstance(data, dict):
        raise SaveFormatError("Записът не е валиден обект.")
    version = data.get("format_version")
    if version not in (1, 2, 3, 4, 5, SAVE_FORMAT_VERSION):
        raise SaveFormatError(f"Несъвместима версия на записа: {version}.")
    try:
        state = GameState(
            players={
                pid: Player.from_dict(p) for pid, p in data["players"].items()
            },
            turn_order=list(data["turn_order"]),
            current_index=int(data["current_index"]),
            phase=Phase(data["phase"]),
            properties={
                int(pos): PropertyState.from_dict(p)
                for pos, p in data["properties"].items()
            },
            decks={did: Deck.from_dict(d) for did, d in data["decks"].items()},
            settings=GameSettings.from_dict(data["settings"]),
            auction=AuctionState.from_dict(data["auction"]) if data.get("auction") else None,
            auction_queue=[int(p) for p in data.get("auction_queue", [])],
            debt=PendingDebt.from_dict(data["debt"]) if data.get("debt") else None,
            pending_card_choice=(
                PendingCardChoice.from_dict(data["pending_card_choice"])
                if data.get("pending_card_choice") else None
            ),
            pending_mortgage_transfer=(
                PendingMortgageTransfer.from_dict(data["pending_mortgage_transfer"])
                if data.get("pending_mortgage_transfer") else None
            ),
            trades={
                tid: TradeOffer.from_dict(t)
                for tid, t in data.get("trades", {}).items()
            },
            last_roll=tuple(data["last_roll"]) if data.get("last_roll") else None,
            doubles_count=int(data.get("doubles_count", 0)),
            round_number=int(data.get("round_number", 1)),
            winner=data.get("winner"),
            paused=bool(data.get("paused", False)),
            paused_at=float(data.get("paused_at", 0.0)),
            paused_by=data.get("paused_by"),
            paused_turn_remaining=float(data.get("paused_turn_remaining", -1.0)),
            paused_auction_remaining=float(data.get("paused_auction_remaining", -1.0)),
            turn_deadline=float(data.get("turn_deadline", 0.0)),
            log=list(data.get("log", [])),
            started_at=float(data.get("started_at", 0.0)),
            bank_pot=int(data.get("bank_pot", 0)),
            wealth_history=list(data.get("wealth_history", [])),
            bank_transactions=list(data.get("bank_transactions", [])),
            event_history=list(data.get("event_history", [])),
            active_global_event=(
                dict(data["active_global_event"])
                if data.get("active_global_event") else None
            ),
            next_global_event_round=int(data.get("next_global_event_round", 4)),
            last_global_event_id=data.get("last_global_event_id"),
            celebrated_monopolies=list(data.get("celebrated_monopolies", [])),
            property_income={
                int(pos): int(inc)
                for pos, inc in (data.get("property_income") or {}).items()
            },
            # Записите отпреди въвеждането на полето нямат ред на отпадане —
            # тогава класацията пада към подреждане по богатство.
            bankruptcy_order=list(data.get("bankruptcy_order") or []),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise SaveFormatError(f"Повреден запис: {exc}") from exc

    # Базова валидация на съгласуваността.
    for pid in state.turn_order:
        if pid not in state.players:
            raise SaveFormatError("Записът съдържа непознат играч в реда на игра.")
    _reconcile_jail_cards(state)
    return state


# Видове събития, които центърът за известия показва. Само те пътуват при
# всяко обновяване; пълният протокол се тегли по заявка.
NOTABLE_EVENT_TYPES = frozenset({
    "global_event_start", "global_event_end", "auction_end", "group_completed",
    "mission_completed", "bankrupt", "player_disconnected", "player_reconnected",
    "game_paused", "game_resumed",
})
# Плащане под тази сума не е новина.
NOTABLE_PAYMENT = 100


# Полетата, които центърът за известия чете. Останалото (кръг, поле, ниво,
# белези за анимация) е нужно само на подробния протокол и не бива да
# пътува при всяко обновяване.
_NOTABLE_FIELDS = (
    "type", "ts", "amount", "from", "to", "player_id", "name",
    "group", "group_name", "bonus", "winner", "price", "event",
    "description", "reason",
)


def notable_history(state: GameState, limit: int = 40) -> list[dict[str, Any]]:
    """Извадка от протокола за известията.

    Филтърът е САМО по вид и сума. Кой да види дадено плащане решава
    клиентът — там се знае дали гледащият е зрител, а тази проверка няма
    чист сървърен еквивалент и пренесена насам би изяла известията на
    зрителите.
    """
    picked = [
        entry for entry in state.event_history
        if entry.get("type") in NOTABLE_EVENT_TYPES
        or (entry.get("type") == "payment"
            and int(entry.get("amount") or 0) >= NOTABLE_PAYMENT)
    ]
    return [
        {key: entry[key] for key in _NOTABLE_FIELDS if key in entry}
        for entry in picked[-limit:]
    ]


def state_to_client(
    state: GameState, board: Board, viewer_id: str | None = None,
    full: bool = False,
) -> dict[str, Any]:
    """Проекция на състоянието за клиентите (без тайни данни като тестетата).

    Подробният протокол (``event_history``) НЕ влиза тук: той тежеше 21 KB
    от общо 33 KB на всяко обновяване, а се чете само когато играчът отвори
    прозореца с историята. Тегли се по заявка (``request_history``), а за
    известията пътува малката извадка ``notable_history``.

    ``full`` добавя игровия лог. Той е нужен само при влизане и връщане —
    оттам нататък клиентът си го гради от самите събития, а пълният му
    препис тежеше близо 6 KB при всяко обновяване.
    """
    data = {
        "players": {pid: p.to_client() for pid, p in state.players.items()},
        "turn_order": list(state.turn_order),
        "current_player": state.current_player_id,
        "phase": state.phase.value,
        "properties": {str(pos): p.to_dict() for pos, p in state.properties.items()},
        "auction": state.auction.to_dict() if state.auction else None,
        "auction_queue": list(state.auction_queue),
        "debt": state.debt.to_dict() if state.debt else None,
        "pending_card_choice": (
            state.pending_card_choice.to_dict()
            if state.pending_card_choice else None
        ),
        "pending_mortgage_transfer": (
            state.pending_mortgage_transfer.to_dict()
            if state.pending_mortgage_transfer else None
        ),
        "trades": {
            tid: {
                **t.to_dict(),
                **(
                    {"counter_original": state.trades[t.counter_of].to_dict()}
                    if t.counter_of and t.counter_of in state.trades else {}
                ),
            }
            for tid, t in state.trades.items()
            if t.status == "pending"
        },
        "last_roll": list(state.last_roll) if state.last_roll else None,
        "round_number": state.round_number,
        "winner": state.winner,
        "paused": state.paused,
        "paused_at": state.paused_at,
        "paused_by": state.paused_by,
        "paused_turn_remaining": state.paused_turn_remaining,
        "paused_auction_remaining": state.paused_auction_remaining,
        # Клиентите използват сървърния часовник за всички крайни срокове.
        # Така различно настроени часовници на устройствата не разминават
        # визуалното обратно броене.
        "server_time": time.time(),
        "turn_deadline": state.turn_deadline,
        "settings": state.settings.to_client(),
        "bank_pot": state.bank_pot,
        "property_income": {str(pos): inc for pos, inc in state.property_income.items()},
        "wealth_history": list(state.wealth_history[-100:]),
        "bank_transactions": list(state.bank_transactions[-30:]),
        "notable_history": notable_history(state),
        "active_global_event": (
            dict(state.active_global_event) if state.active_global_event else None
        ),
        "next_global_event_round": state.next_global_event_round,
        "my_mission": (
            mission_for_client(state.players[viewer_id], state, board)
            if viewer_id in state.players and not state.players[viewer_id].is_spectator
            else None
        ),
        # Само БРОЯТ карти, не съдържанието: играчът трябва да вижда кога
        # тестето ще се разбърка, но не и коя карта следва. Тегленията и
        # държаните карти и без това са публични.
        "deck_counts": {
            deck_id: {
                "draw": len(deck.draw_pile),
                "discard": len(deck.discard_pile),
            }
            for deck_id, deck in state.decks.items()
        },
        "debt_advice": build_debt_advice(state, board),
        "final_report": _final_report(state, board) if state.winner else None,
    }
    if full:
        data["log"] = list(state.log[-60:])
    return data


def _final_report(state: GameState, board: Board) -> list[dict[str, Any]]:
    """Класация и статистика за финалния екран."""
    report = []
    for player in state.players.values():
        if player.is_spectator:
            continue
        owned = [
            pos for pos, prop in state.properties.items()
            if prop.owner == player.player_id
        ]
        # Най-печеливш имот = притежаван имот с най-много събран наем.
        best_property = None
        best_property_income = 0
        owned_with_income = [
            (pos, state.property_income.get(pos, 0)) for pos in owned
        ]
        if owned_with_income:
            best, best_property_income = max(owned_with_income, key=lambda item: item[1])
            if best_property_income > 0:
                best_property = board.space(best).name
            else:
                best_property = board.space(min(owned)).name
        rolls = player.stats.get("dice_rolls", 0)
        avg_roll = round(player.stats.get("dice_pips", 0) / rolls, 1) if rolls else 0
        report.append({
            "player_id": player.player_id,
            "name": player.name,
            "token": player.token,
            "gender": player.gender,
            "skin": player.skin,
            "hair": player.hair,
            "hairstyle": player.hairstyle,
            "cash": player.cash,
            "net_worth": player.net_worth(board, state.properties),
            "properties": len(owned),
            "best_property": best_property,
            "best_property_income": best_property_income,
            "avg_roll": avg_roll,
            "bankrupt": player.bankrupt,
            "stats": dict(player.stats),
        })
    # Подреждане: победителят е пръв, следват оцелелите по богатство, а
    # накрая отпадналите — в обратен ред на изгаряне. Който е издържал
    # най-дълго, стои най-високо; първият фалирал е най-отдолу.
    order = {pid: index for index, pid in enumerate(state.bankruptcy_order)}

    def rank(row: dict[str, Any]) -> tuple[int, int, int]:
        if row["player_id"] == state.winner:
            return (0, 0, 0)
        if not row["bankrupt"]:
            # Оцелели без победа (напр. при лимит на рундовете) — по богатство.
            return (1, -row["net_worth"], 0)
        # Липсващите в списъка са от стари записи: най-отдолу, по богатство.
        position = order.get(row["player_id"])
        if position is None:
            return (3, -row["net_worth"], 0)
        return (2, -position, 0)

    return sorted(report, key=rank)
