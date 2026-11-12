"""Регресионни тестове за реалистичните търгове, банката и картите."""
from __future__ import annotations

import random
import time
from types import SimpleNamespace

import pytest

from app.game.advisor import build_debt_advice
from app.game.bots import choose_bot, play_bot_step
from app.game.cards import all_cards
from app.game.engine import GameEngine, GameError
from app.game.properties import PropertyState, bank_stock
from app.game.rules import GameSettings
from app.game.serialization import state_from_dict, state_to_dict
from app.game.state import PendingDebt, Phase
from app.socket_server import _record_event_history

from conftest import force_roll, make_players


def _engine(board, count: int = 3) -> GameEngine:
    engine = GameEngine(
        board,
        GameSettings(auctions_enabled=True),
        rng=random.Random(19),
    )
    engine.start_game(make_players(count))
    return engine


def _own_group(engine: GameEngine, player_id: str, positions: tuple[int, ...], level: int = 0) -> None:
    for position in positions:
        engine.state.properties[position] = PropertyState(
            position=position,
            owner=player_id,
            level=level,
        )


class TestTimedAuction:
    def test_withdrawals_finish_when_one_participant_remains(self, board) -> None:
        engine = _engine(board)
        first, second, third = engine.state.turn_order
        force_roll(engine, 1, 2)
        engine.roll_dice(first)
        engine.decline_purchase(first)

        assert engine.state.auction is not None
        assert engine.state.auction.ends_at > time.time()
        first_deadline = engine.state.auction.ends_at
        engine.place_bid(second, 50)
        assert engine.state.auction.ends_at >= first_deadline
        assert engine.state.auction.bid_history[-1]["amount"] == 50
        engine.withdraw_auction(first)
        with pytest.raises(GameError, match="Не участвате"):
            engine.place_bid(first, 60)
        engine.withdraw_auction(third)

        assert engine.state.auction is None
        assert engine.state.properties[3].owner == second
        assert engine.state.phase == Phase.MANAGEMENT

    def test_last_participant_gets_automatic_minimum_bid(self, board) -> None:
        engine = _engine(board)
        first, second, third = engine.state.turn_order
        force_roll(engine, 1, 2)
        engine.roll_dice(first)
        engine.decline_purchase(first)

        engine.withdraw_auction(first)
        engine.withdraw_auction(second)

        assert engine.state.auction is None
        assert engine.state.properties[3].owner == third
        assert engine.state.players[third].cash == 1490

    def test_leading_bidder_cannot_withdraw(self, board) -> None:
        engine = _engine(board)
        first, second, _ = engine.state.turn_order
        force_roll(engine, 1, 2)
        engine.roll_dice(first)
        engine.decline_purchase(first)
        engine.place_bid(second, 50)

        with pytest.raises(GameError, match="Водещият"):
            engine.withdraw_auction(second)


class TestBuildingAuctions:
    def test_last_house_is_sold_by_auction(self, board) -> None:
        engine = _engine(board)
        first, second, _ = engine.state.turn_order
        engine.state.phase = Phase.MANAGEMENT
        _own_group(engine, first, (1, 3))
        _own_group(engine, second, (37, 39))
        for position in (6, 8, 9, 11, 13, 14, 16):
            engine.state.properties[position] = PropertyState(position, owner="stock", level=4)
        engine.state.properties[18] = PropertyState(18, owner="stock", level=3)
        assert bank_stock(engine.state.properties)[0] == 1

        engine.build_improvement(first, 1)

        assert engine.state.auction is not None
        assert engine.state.auction.kind == "house"
        assert set(engine.state.auction.participants) == {first, second}
        engine.place_bid(first, 50, 1)
        engine.withdraw_auction(second)
        assert engine.state.properties[1].level == 1
        assert bank_stock(engine.state.properties)[0] == 0

    def test_last_hotel_is_sold_by_auction(self, board) -> None:
        engine = _engine(board)
        first, second, _ = engine.state.turn_order
        engine.state.phase = Phase.MANAGEMENT
        _own_group(engine, first, (1, 3), level=4)
        _own_group(engine, second, (37, 39), level=4)
        hotel_positions = (6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23)
        for position in hotel_positions:
            engine.state.properties[position] = PropertyState(position, owner="stock", level=5)
        assert bank_stock(engine.state.properties)[1] == 1

        engine.build_improvement(first, 1)

        assert engine.state.auction is not None
        assert engine.state.auction.kind == "hotel"
        engine.place_bid(first, 50, 1)
        engine.withdraw_auction(second)
        assert engine.state.properties[1].level == 5
        assert bank_stock(engine.state.properties)[1] == 0


class TestBankruptcyMortgages:
    def test_receiver_pays_interest_and_can_unmortgage_immediately(self, board) -> None:
        engine = _engine(board)
        debtor, receiver, _ = engine.state.turn_order
        engine.state.properties[1] = PropertyState(1, owner=debtor, mortgaged=True)
        receiver_cash = engine.state.players[receiver].cash
        engine.state.players[debtor].cash = 0
        engine.state.debt = PendingDebt(debtor, receiver, 9999, "Наем")
        engine.state.phase = Phase.AWAITING_PAYMENT

        engine.declare_bankruptcy(debtor)

        assert engine.state.phase == Phase.AWAITING_MORTGAGE_DECISION
        assert engine.state.players[receiver].cash == receiver_cash - 3
        assert engine.state.pending_mortgage_transfer is not None
        engine.resolve_mortgage_transfer(receiver, [1])
        assert engine.state.players[receiver].cash == receiver_cash - 33
        assert not engine.state.properties[1].mortgaged
        assert engine.state.current_player_id == receiver
        assert engine.state.phase == Phase.WAITING_FOR_ROLL

    def test_non_current_receiver_can_raise_interest(self, board) -> None:
        engine = _engine(board)
        debtor, receiver, _ = engine.state.turn_order
        engine.state.properties[1] = PropertyState(1, owner=debtor, mortgaged=True)
        engine.state.properties[5] = PropertyState(5, owner=receiver)
        engine.state.players[debtor].cash = 0
        engine.state.players[receiver].cash = 0
        engine.state.debt = PendingDebt(debtor, receiver, 9999, "Наем")
        engine.state.phase = Phase.AWAITING_PAYMENT

        engine.declare_bankruptcy(debtor)
        assert engine.state.debt is not None
        assert engine.state.debt.debtor == receiver
        engine.mortgage_property(receiver, 5)
        engine.settle_debt(receiver)
        assert engine.state.phase == Phase.AWAITING_MORTGAGE_DECISION
        engine.resolve_mortgage_transfer(receiver, [])
        assert engine.state.properties[1].mortgaged
        assert engine.state.current_player_id == receiver

    def test_non_current_bot_receiver_resolves_interest_debt(self, board) -> None:
        engine = _engine(board)
        debtor, receiver, _ = engine.state.turn_order
        engine.state.players[receiver].is_bot = True
        engine.state.properties[1] = PropertyState(1, owner=debtor, mortgaged=True)
        engine.state.properties[5] = PropertyState(5, owner=receiver)
        engine.state.players[debtor].cash = 0
        engine.state.players[receiver].cash = 0
        engine.state.debt = PendingDebt(debtor, receiver, 9999, "Наем")
        engine.state.phase = Phase.AWAITING_PAYMENT

        engine.declare_bankruptcy(debtor)
        assert choose_bot(engine) == receiver
        play_bot_step(engine, receiver)
        assert engine.state.properties[5].mortgaged
        play_bot_step(engine, receiver)
        assert engine.state.phase == Phase.AWAITING_MORTGAGE_DECISION
        play_bot_step(engine, receiver)
        assert engine.state.pending_mortgage_transfer is None


class TestSpecialCards:
    def test_nearest_transport_charges_double_rent(self, board) -> None:
        engine = _engine(board)
        player_id, owner_id, _ = engine.state.turn_order
        player = engine.state.players[player_id]
        owner = engine.state.players[owner_id]
        player.position = 7
        engine.state.properties[15] = PropertyState(15, owner=owner_id)

        engine._apply_card(
            player,
            all_cards()["biz_07"],
            engine.state.decks["business"],
        )

        assert player.position == 15
        assert player.cash == 1450
        assert owner.cash == 1550

    def test_nearest_utility_uses_new_dice_at_ten_times(self, board) -> None:
        engine = _engine(board)
        player_id, owner_id, _ = engine.state.turn_order
        player = engine.state.players[player_id]
        owner = engine.state.players[owner_id]
        player.position = 22
        engine.state.properties[28] = PropertyState(28, owner=owner_id)
        force_roll(engine, 3, 4)

        events = engine._apply_card(
            player,
            all_cards()["biz_08"],
            engine.state.decks["business"],
        )

        assert player.position == 28
        assert player.cash == 1430
        assert owner.cash == 1570
        assert any(event.get("special") is True for event in events)

    def test_nearest_unowned_utility_does_not_roll_rent_dice(self, board) -> None:
        engine = _engine(board)
        player = engine.state.current_player
        player.position = 22

        events = engine._apply_card(
            player,
            all_cards()["biz_08"],
            engine.state.decks["business"],
        )

        assert player.position == 28
        assert engine.state.phase == Phase.AWAITING_PURCHASE
        assert not any(event.get("special") is True for event in events)

    def test_special_utility_roll_does_not_change_double_turn(self, board) -> None:
        engine = _engine(board)
        player_id, owner_id, _ = engine.state.turn_order
        player = engine.state.players[player_id]
        player.position = 22
        engine.state.properties[28] = PropertyState(28, owner=owner_id)
        engine.state.last_roll = (2, 2)
        engine.state.doubles_count = 1
        force_roll(engine, 3, 4)

        engine._apply_card(
            player,
            all_cards()["biz_08"],
            engine.state.decks["business"],
        )
        engine.end_turn(player_id)

        assert engine.state.current_player_id == player_id
        assert engine.state.phase == Phase.WAITING_FOR_ROLL


def test_bank_journal_and_save_roundtrip(board) -> None:
    engine = _engine(board)
    player = engine.state.current_player
    engine._charge(player, None, 100, "Тестова такса")
    engine.state.bank_pot = 75

    restored = state_from_dict(state_to_dict(engine.state))

    assert restored.bank_transactions[-1]["amount"] == 100
    assert restored.bank_transactions[-1]["reason"] == "Тестова такса"
    assert restored.bank_pot == 75


def test_debt_advisor_returns_executable_plan(board) -> None:
    engine = _engine(board)
    debtor = engine.state.current_player_id
    engine.state.players[debtor].cash = 0
    engine.state.properties[1] = PropertyState(1, owner=debtor)
    engine.state.properties[5] = PropertyState(5, owner=debtor)
    engine.state.debt = PendingDebt(debtor, None, 80, "Тестов дълг")
    engine.state.phase = Phase.AWAITING_PAYMENT

    advice = build_debt_advice(engine.state, board)

    assert advice is not None
    assert advice["covers"] is True
    assert advice["actions"]
    assert advice["actions"][0]["type"] == "mortgage"
    assert advice["raised"] >= 80


def test_detailed_event_history_records_payment_reason_and_round(board) -> None:
    engine = _engine(board)
    player = engine.state.current_player
    description = f"{player.name} плаща тестова административна такса от 100 €."
    events = [
        engine._log(description, "tax"),
        *engine._charge(player, None, 100, "Тестова административна такса"),
    ]

    _record_event_history(SimpleNamespace(engine=engine), events)

    assert len(engine.state.event_history) == 1
    entry = engine.state.event_history[0]
    assert entry["type"] == "payment"
    assert entry["reason"] == "Тестова административна такса"
    assert entry["description"] == description
    assert entry["round"] == 1
    assert events[1]["reason"] == "Тестова административна такса"
    assert events[1]["description"] == description


def test_detailed_event_history_survives_save_roundtrip(board) -> None:
    engine = _engine(board)
    engine.state.event_history.append({
        "type": "purchase", "player_id": engine.state.current_player_id,
        "position": 1, "price": 60, "round": 1, "ts": 123.0,
    })

    restored = state_from_dict(state_to_dict(engine.state))

    assert restored.event_history == engine.state.event_history
