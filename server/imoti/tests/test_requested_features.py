"""Регресионни тестове за началния ред, търговете и контраофертите."""
from __future__ import annotations

import random
from unittest.mock import patch

from app.game.engine import GameEngine
from app.game.rules import GameSettings
from app.game.serialization import state_from_dict, state_to_client, state_to_dict
from app.game.state import AuctionState, Phase

from conftest import make_players


class StartingRollRandom(random.Random):
    """Подава предварително зададени начални зарове, после работи нормално."""

    def __init__(self, values: list[int]) -> None:
        super().__init__(123)
        self.values = iter(values)

    def randint(self, a: int, b: int) -> int:
        try:
            return next(self.values)
        except StopIteration:
            return super().randint(a, b)


def test_starting_roll_orders_players_and_resolves_tie(board) -> None:
    # p0=8, p1=8, p2=4; при повторението p0=3, p1=11.
    rng = StartingRollRandom([4, 4, 3, 5, 1, 3, 1, 2, 5, 6])
    engine = GameEngine(board, GameSettings(), rng=rng)

    events = engine.start_game(make_players(3))

    assert engine.state.turn_order == ["p1", "p0", "p2"]
    assert [engine.state.players[pid].order for pid in engine.state.turn_order] == [0, 1, 2]
    order_event = next(event for event in events if event["type"] == "starting_order")
    assert order_event["order"] == ["p1", "p0", "p2"]
    tiebreak_players = {
        roll["player_id"] for roll in order_event["rolls"] if roll["tiebreak"]
    }
    assert tiebreak_players == {"p0", "p1"}


def test_auction_bid_resets_deadline_and_survives_save(board) -> None:
    engine = GameEngine(board, GameSettings(auction_seconds=30), rng=random.Random(3))
    engine.start_game(make_players(2))
    first = engine.state.turn_order[0]

    timestamps = [1000.0]

    def fake_time() -> float:
        return timestamps.pop(0) if timestamps else 1005.0

    with patch("app.game.engine.time.time", side_effect=fake_time):
        engine._start_auction(1, Phase.MANAGEMENT)
        engine.place_bid(first, 10)

    assert engine.state.auction.ends_at == 1035.0
    assert engine.state.auction.bid_history == [{
        "player_id": first,
        "amount": 10,
        "ts": 1005.0,
        "position": 1,
    }]
    restored = state_from_dict(state_to_dict(engine.state))
    assert restored.auction.ends_at == 1035.0
    assert restored.auction.bid_history[0]["amount"] == 10


def test_counter_offer_contains_exact_previous_offer_for_client(engine) -> None:
    first, second = engine.state.turn_order
    original_events = engine.create_trade(
        first, second, offer_cash=100, request_cash=10,
    )
    original = original_events[-1]["trade"]
    counter_events = engine.create_trade(
        second, first, offer_cash=20, request_cash=80,
        counter_of=original["trade_id"],
    )
    counter_id = counter_events[-1]["trade"]["trade_id"]

    view = state_to_client(engine.state, engine.board, second)
    counter = view["trades"][counter_id]

    assert counter["counter_original"]["trade_id"] == original["trade_id"]
    assert counter["counter_original"]["offer_cash"] == 100
    assert counter["offer_cash"] == 20
    assert counter["created_at"] >= counter["counter_original"]["created_at"]


def test_pause_freezes_and_restores_turn_and_auction_timers(engine) -> None:
    player_id = engine.state.current_player_id
    engine.state.turn_deadline = 1040.0
    engine.state.auction = AuctionState(
        position=1,
        ends_at=1030.0,
        participants=list(engine.state.turn_order),
    )
    engine.state.phase = Phase.AWAITING_AUCTION

    with patch("app.game.engine.time.time", return_value=1000.0):
        pause_events = engine.pause_game(player_id)

    assert engine.state.paused is True
    assert engine.state.paused_turn_remaining == 40.0
    assert engine.state.paused_auction_remaining == 30.0
    assert any(event["type"] == "game_paused" for event in pause_events)

    restored = state_from_dict(state_to_dict(engine.state))
    assert restored.paused is True
    assert restored.paused_turn_remaining == 40.0
    assert restored.paused_auction_remaining == 30.0

    with patch("app.game.engine.time.time", return_value=1100.0):
        resume_events = engine.resume_game(player_id)

    assert engine.state.paused is False
    assert engine.state.turn_deadline == 1140.0
    assert engine.state.auction.ends_at == 1130.0
    assert any(event["type"] == "game_resumed" for event in resume_events)
