"""Централно състояние на една игра и фазите на хода (state machine)."""
from __future__ import annotations

import enum
import time
from dataclasses import dataclass, field
from typing import Any

from .cards import Deck
from .player import Player
from .properties import PropertyState
from .rules import GameSettings


class Phase(str, enum.Enum):
    """Фази на хода. Сървърът отхвърля действия извън правилната фаза."""

    WAITING_FOR_ROLL = "WAITING_FOR_ROLL"
    ROLLING = "ROLLING"
    MOVING = "MOVING"
    RESOLVING_SPACE = "RESOLVING_SPACE"
    AWAITING_PURCHASE = "AWAITING_PURCHASE"
    AWAITING_AUCTION = "AWAITING_AUCTION"
    AWAITING_PAYMENT = "AWAITING_PAYMENT"
    AWAITING_MORTGAGE_DECISION = "AWAITING_MORTGAGE_DECISION"
    # Изтеглена е карта с избор: играчът избира сигурния вариант или залога.
    AWAITING_CARD_CHOICE = "AWAITING_CARD_CHOICE"
    MANAGEMENT = "MANAGEMENT"
    END_TURN = "END_TURN"
    GAME_OVER = "GAME_OVER"


@dataclass
class AuctionState:
    """Текущ търг за имот или последна банкова постройка."""

    position: int
    highest_bid: int = 0
    highest_bidder: str | None = None
    ends_at: float = 0.0
    participants: list[str] = field(default_factory=list)
    withdrawn: list[str] = field(default_factory=list)
    kind: str = "property"  # property | house | hotel
    minimum_bid: int = 0
    targets: dict[str, int] = field(default_factory=dict)
    bid_history: list[dict[str, Any]] = field(default_factory=list)
    # Собственик, пуснал имота на търг (парите отиват при него, не в банката).
    seller: str | None = None
    # Фазата, към която играта се връща след края на търга.
    resume_phase: str = "MANAGEMENT"

    def to_dict(self) -> dict[str, Any]:
        return {
            "position": self.position,
            "highest_bid": self.highest_bid,
            "highest_bidder": self.highest_bidder,
            "ends_at": self.ends_at,
            "participants": list(self.participants),
            "withdrawn": list(self.withdrawn),
            "kind": self.kind,
            "minimum_bid": self.minimum_bid,
            "targets": dict(self.targets),
            "bid_history": [dict(bid) for bid in self.bid_history],
            "seller": self.seller,
            "resume_phase": self.resume_phase,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AuctionState":
        return cls(
            position=data["position"],
            highest_bid=data.get("highest_bid", 0),
            highest_bidder=data.get("highest_bidder"),
            ends_at=float(data.get("ends_at", 0.0)),
            participants=list(data.get("participants", [])),
            withdrawn=list(data.get("withdrawn", [])),
            kind=data.get("kind", "property"),
            minimum_bid=int(data.get("minimum_bid", 0)),
            targets={str(pid): int(pos) for pid, pos in data.get("targets", {}).items()},
            bid_history=[dict(bid) for bid in data.get("bid_history", [])],
            seller=data.get("seller"),
            resume_phase=data.get("resume_phase", "MANAGEMENT"),
        )


@dataclass
class PendingMortgageTransfer:
    """Избор на кредитора за ипотекирани имоти, получени при фалит."""

    player_id: str
    positions: list[int] = field(default_factory=list)
    interest_paid: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "player_id": self.player_id,
            "positions": list(self.positions),
            "interest_paid": self.interest_paid,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PendingMortgageTransfer":
        return cls(
            player_id=data["player_id"],
            positions=[int(pos) for pos in data.get("positions", [])],
            interest_paid=int(data.get("interest_paid", 0)),
        )


@dataclass
class PendingCardChoice:
    """Изтеглена карта с избор между сигурен вариант и залог.

    Текстовете се копират тук при теглене, вместо да се държи препратка към
    картата: така състоянието е самодостатъчно за показване и картата се
    връща в тестето веднага, без да чака решението.

    Сумите са със знак: положително = получаване, отрицателно = плащане.
    """

    player_id: str
    card_text: str = ""
    deck: str = "community"
    icon: str = "🎲"
    safe_label: str = ""
    safe_amount: int = 0
    risky_label: str = ""
    risky_note: str = ""
    risky_win: int = 0
    risky_lose: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "player_id": self.player_id,
            "card_text": self.card_text,
            "deck": self.deck,
            "icon": self.icon,
            "safe_label": self.safe_label,
            "safe_amount": self.safe_amount,
            "risky_label": self.risky_label,
            "risky_note": self.risky_note,
            "risky_win": self.risky_win,
            "risky_lose": self.risky_lose,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PendingCardChoice":
        return cls(
            player_id=data["player_id"],
            card_text=str(data.get("card_text", "")),
            deck=str(data.get("deck", "community")),
            icon=str(data.get("icon", "🎲")),
            safe_label=str(data.get("safe_label", "")),
            safe_amount=int(data.get("safe_amount", 0)),
            risky_label=str(data.get("risky_label", "")),
            risky_note=str(data.get("risky_note", "")),
            risky_win=int(data.get("risky_win", 0)),
            risky_lose=int(data.get("risky_lose", 0)),
        )


@dataclass
class PendingDebt:
    """Неплатено задължение — играчът трябва да набави средства или да фалира."""

    debtor: str
    creditor: str | None  # None = банката
    amount: int
    reason: str
    # Фазата, към която играта се връща след уреждане. По подразбиране е
    # MANAGEMENT (дългът е възникнал по време на хода), но лихвата по заем
    # се начислява ПРЕДИ хвърлянето — там връщането трябва да е към
    # WAITING_FOR_ROLL, иначе уреждането изяжда хвърлянето на длъжника.
    resume_phase: str = "MANAGEMENT"
    # Задължението Е самата главница по заема (банката го прибира заради
    # изчерпано обезпечение). Без този флаг уреждането събира парите, но
    # оставя заема да виси — играчът плаща два пъти за едно и също.
    clears_loan: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "debtor": self.debtor,
            "creditor": self.creditor,
            "amount": self.amount,
            "reason": self.reason,
            "resume_phase": self.resume_phase,
            "clears_loan": self.clears_loan,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PendingDebt":
        return cls(
            debtor=data["debtor"],
            creditor=data.get("creditor"),
            amount=data["amount"],
            reason=data.get("reason", ""),
            resume_phase=data.get("resume_phase", "MANAGEMENT"),
            clears_loan=bool(data.get("clears_loan", False)),
        )


@dataclass
class TradeOffer:
    """Оферта за сделка между двама играчи."""

    trade_id: str
    from_player: str
    to_player: str
    offer_cash: int = 0
    offer_properties: list[int] = field(default_factory=list)
    offer_jail_cards: int = 0
    request_cash: int = 0
    request_properties: list[int] = field(default_factory=list)
    request_jail_cards: int = 0
    status: str = "pending"  # pending | accepted | declined | countered | cancelled
    counter_of: str | None = None  # trade_id на офертата, на която това е контра
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "trade_id": self.trade_id,
            "from_player": self.from_player,
            "to_player": self.to_player,
            "offer_cash": self.offer_cash,
            "offer_properties": list(self.offer_properties),
            "offer_jail_cards": self.offer_jail_cards,
            "request_cash": self.request_cash,
            "request_properties": list(self.request_properties),
            "request_jail_cards": self.request_jail_cards,
            "status": self.status,
            "counter_of": self.counter_of,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TradeOffer":
        return cls(
            trade_id=data["trade_id"],
            from_player=data["from_player"],
            to_player=data["to_player"],
            offer_cash=data.get("offer_cash", 0),
            offer_properties=list(data.get("offer_properties", [])),
            offer_jail_cards=data.get("offer_jail_cards", 0),
            request_cash=data.get("request_cash", 0),
            request_properties=list(data.get("request_properties", [])),
            request_jail_cards=data.get("request_jail_cards", 0),
            status=data.get("status", "pending"),
            counter_of=data.get("counter_of"),
            created_at=float(data.get("created_at", time.time())),
        )


@dataclass
class GameState:
    """Пълното динамично състояние на една игра."""

    players: dict[str, Player] = field(default_factory=dict)
    turn_order: list[str] = field(default_factory=list)
    current_index: int = 0
    phase: Phase = Phase.WAITING_FOR_ROLL
    properties: dict[int, PropertyState] = field(default_factory=dict)
    decks: dict[str, Deck] = field(default_factory=dict)
    settings: GameSettings = field(default_factory=GameSettings)
    auction: AuctionState | None = None
    # Опашка от позиции за търг (напр. активи на фалирал към банката).
    auction_queue: list[int] = field(default_factory=list)
    debt: PendingDebt | None = None
    pending_mortgage_transfer: PendingMortgageTransfer | None = None
    pending_card_choice: PendingCardChoice | None = None
    trades: dict[str, TradeOffer] = field(default_factory=dict)
    last_roll: tuple[int, int] | None = None
    doubles_count: int = 0
    round_number: int = 1
    winner: str | None = None
    # Пауза от домакина. Оставащите времена се пазят отделно, за да не
    # продължават да текат и след запис/рестарт на сървъра.
    paused: bool = False
    paused_at: float = 0.0
    paused_by: str | None = None
    paused_turn_remaining: float = -1.0
    paused_auction_remaining: float = -1.0
    # Краен срок на текущия ход (unix time; 0 = без лимит).
    turn_deadline: float = 0.0
    log: list[dict[str, Any]] = field(default_factory=list)
    started_at: float = field(default_factory=time.time)
    bank_pot: int = 0
    wealth_history: list[dict[str, Any]] = field(default_factory=list)
    bank_transactions: list[dict[str, Any]] = field(default_factory=list)
    event_history: list[dict[str, Any]] = field(default_factory=list)
    # Глобалните събития започват през три рунда и действат два рунда.
    active_global_event: dict[str, Any] | None = None
    next_global_event_round: int = 4
    last_global_event_id: str | None = None
    # Вече отпразнувани комбинации „играч:група“.
    celebrated_monopolies: list[str] = field(default_factory=list)
    # Натрупан наем по позиция (за „най-печеливш имот").
    property_income: dict[int, int] = field(default_factory=dict)
    # Редът, в който играчите отпадат: първият фалирал е пръв в списъка.
    # Финалната класация го чете наобратно — който е издържал най-дълго,
    # застава най-високо след победителя.
    bankruptcy_order: list[str] = field(default_factory=list)

    @property
    def current_player_id(self) -> str | None:
        """Идентификатор на играча на ход."""
        if not self.turn_order:
            return None
        return self.turn_order[self.current_index % len(self.turn_order)]

    @property
    def current_player(self) -> Player | None:
        """Играчът на ход."""
        pid = self.current_player_id
        return self.players.get(pid) if pid else None

    def active_players(self) -> list[Player]:
        """Всички нефалирали играчи (без зрители)."""
        return [
            self.players[pid]
            for pid in self.turn_order
            if pid in self.players and not self.players[pid].bankrupt
        ]

    def add_log(self, text: str, kind: str = "info", **extra: Any) -> dict[str, Any]:
        """Добавя запис в игровия лог и го връща (за излъчване към клиентите)."""
        entry: dict[str, Any] = {"text": text, "kind": kind, "ts": time.time(), **extra}
        self.log.append(entry)
        if len(self.log) > 300:
            self.log = self.log[-300:]
        return entry
