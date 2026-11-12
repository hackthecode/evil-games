"""Тестове на класическите правила: хотел, строителен фонд, групи, търгове."""
from __future__ import annotations

import random

import pytest

from app.game.engine import GameEngine, GameError
from app.game.properties import (
    HOTEL_POOL,
    HOUSE_POOL,
    MAX_LEVEL,
    PropertyState,
    bank_stock,
    buildings_in_play,
)
from app.game.rules import GameSettings
from app.game.state import PendingDebt, Phase

from conftest import force_roll, make_players


def _own_group(engine: GameEngine, pid: str, positions=(1, 3)) -> None:
    for pos in positions:
        engine.state.properties[pos] = PropertyState(position=pos, owner=pid)


# ----------------------------------------------------------------------
# Шесто ниво: Гранд хотел
# ----------------------------------------------------------------------
class TestHotelLevel:
    def test_max_level_is_five(self) -> None:
        assert MAX_LEVEL == 5

    def test_build_to_hotel(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 5000
        _own_group(engine, pid)
        # Строим равномерно до ниво 5 и на двата имота.
        for level in range(1, 6):
            engine.build_improvement(pid, 1)
            engine.build_improvement(pid, 3)
        assert engine.state.properties[1].level == 5
        assert engine.state.properties[3].level == 5
        with pytest.raises(GameError):
            engine.build_improvement(pid, 1)  # над максимума

    def test_hotel_rent(self, engine: GameEngine, board) -> None:
        from app.game.properties import calculate_rent

        states = {
            1: PropertyState(position=1, owner="a", level=5),
            3: PropertyState(position=3, owner="a", level=5),
        }
        assert calculate_rent(board, states, 3, 7) == 450  # Банкя, Гранд хотел


# ----------------------------------------------------------------------
# Лимитиран строителен фонд
# ----------------------------------------------------------------------
class TestBuildingStock:
    def test_pools(self) -> None:
        assert HOUSE_POOL == 32
        assert HOTEL_POOL == 12

    def test_counting(self) -> None:
        states = {
            1: PropertyState(position=1, owner="a", level=3),  # 3 къщи
            3: PropertyState(position=3, owner="a", level=5),  # 1 хотел
        }
        assert buildings_in_play(states) == (3, 1)
        assert bank_stock(states) == (HOUSE_POOL - 3, HOTEL_POOL - 1)

    def test_no_houses_blocks_building(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 5000
        _own_group(engine, pid)
        # Изчерпваме фонда: 32 къщи по други имоти (8 имота × ниво 4).
        for i, pos in enumerate((6, 8, 9, 11, 13, 14, 16, 18)):
            engine.state.properties[pos] = PropertyState(
                position=pos, owner="друг", level=4
            )
        assert bank_stock(engine.state.properties)[0] == 0
        with pytest.raises(GameError, match="къщи"):
            engine.build_improvement(pid, 1)

    def test_hotel_frees_houses(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 5000
        _own_group(engine, pid)
        for level in range(1, 5):
            engine.build_improvement(pid, 1)
            engine.build_improvement(pid, 3)
        houses_before = buildings_in_play(engine.state.properties)[0]
        engine.build_improvement(pid, 1)  # 4 къщи → хотел
        houses_after, hotels = buildings_in_play(engine.state.properties)
        assert houses_after == houses_before - 4
        assert hotels == 1

    def test_hotel_teardown_needs_houses(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 9000
        _own_group(engine, pid)
        for level in range(1, 6):
            engine.build_improvement(pid, 1)
            engine.build_improvement(pid, 3)
        # Друг играч държи всички останали къщи: 32 - 0 = блокираме фонда.
        for pos in (6, 8, 9, 11, 13, 14, 16, 18):
            engine.state.properties[pos] = PropertyState(
                position=pos, owner="друг", level=4
            )
        assert bank_stock(engine.state.properties)[0] == 0
        with pytest.raises(GameError, match="хотела"):
            engine.sell_improvement(pid, 1)


# ----------------------------------------------------------------------
# Групово правило: ипотека и размяна при постройки в групата
# ----------------------------------------------------------------------
class TestGroupBuildingRule:
    def test_mortgage_blocked_by_group_buildings(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 5000
        _own_group(engine, pid)
        engine.build_improvement(pid, 1)  # ниво 1 на Вършец
        # Банкя е без постройки, но групата има → ипотеката е забранена.
        with pytest.raises(GameError, match="групата"):
            engine.mortgage_property(pid, 3)

    def test_trade_blocked_by_group_buildings(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.players[p1].cash = 5000
        _own_group(engine, p1)
        engine.build_improvement(p1, 1)
        with pytest.raises(GameError, match="постройки"):
            engine.create_trade(p1, p2, offer_properties=[3], request_cash=50)

    def test_mortgage_ok_after_teardown(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 5000
        _own_group(engine, pid)
        engine.build_improvement(pid, 1)
        engine.sell_improvement(pid, 1)
        engine.mortgage_property(pid, 3)
        assert engine.state.properties[3].mortgaged


# ----------------------------------------------------------------------
# Търгове (настройка на домакина, изключена по подразбиране)
# ----------------------------------------------------------------------
def _auction_engine() -> GameEngine:
    from app.game.board import Board
    from pathlib import Path

    base = Path(__file__).resolve().parent.parent
    board = Board.from_file(base / "data" / "board_config.json")
    settings = GameSettings(auctions_enabled=True)
    eng = GameEngine(board, settings, rng=random.Random(11))
    eng.start_game(make_players(3))
    return eng


class TestAuctions:
    def test_default_off_decline_leaves_free(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        force_roll(engine, 1, 2)
        engine.roll_dice(pid)
        engine.decline_purchase(pid)
        assert engine.state.phase == Phase.MANAGEMENT
        assert engine.state.auction is None

    def test_decline_starts_auction_when_enabled(self) -> None:
        eng = _auction_engine()
        pid = eng.state.current_player_id
        force_roll(eng, 1, 2)
        eng.roll_dice(pid)
        eng.decline_purchase(pid)
        assert eng.state.phase == Phase.AWAITING_AUCTION
        assert eng.state.auction is not None
        assert eng.state.auction.position == 3

    def test_bid_and_win(self) -> None:
        eng = _auction_engine()
        p1 = eng.state.current_player_id
        p2 = eng.state.turn_order[1]
        force_roll(eng, 1, 2)
        eng.roll_dice(p1)
        eng.decline_purchase(p1)
        eng.place_bid(p2, 50)
        with pytest.raises(GameError):
            eng.place_bid(p1, 55)  # под минималната стъпка
        eng.place_bid(p1, 60)
        cash1 = eng.state.players[p1].cash
        eng.finish_auction()
        assert eng.state.properties[3].owner == p1
        assert eng.state.players[p1].cash == cash1 - 60
        assert eng.state.phase == Phase.MANAGEMENT

    def test_no_bids_stays_free(self) -> None:
        eng = _auction_engine()
        pid = eng.state.current_player_id
        force_roll(eng, 1, 2)
        eng.roll_dice(pid)
        eng.decline_purchase(pid)
        eng.finish_auction()
        prop = eng.state.properties.get(3)
        assert prop is None or prop.owner is None
        assert eng.state.phase == Phase.MANAGEMENT

    def test_bankruptcy_assets_queued_for_auction(self) -> None:
        eng = _auction_engine()
        order = eng.state.turn_order
        debtor = order[1]
        eng.state.properties[6] = PropertyState(position=6, owner=debtor)
        eng.state.properties[8] = PropertyState(position=8, owner=debtor)
        eng.state.players[debtor].cash = 10
        eng.state.debt = PendingDebt(
            debtor=debtor, creditor=None, amount=9999, reason="Тест"
        )
        eng.state.phase = Phase.AWAITING_PAYMENT
        eng.declare_bankruptcy(debtor)
        # Първият търг от опашката стартира веднага, вторият чака.
        assert eng.state.phase == Phase.AWAITING_AUCTION
        assert eng.state.auction is not None
        assert eng.state.auction.position == 6
        assert eng.state.auction_queue == [8]
        # След края му започва следващият.
        eng.finish_auction()
        assert eng.state.auction is not None
        assert eng.state.auction.position == 8
        assert eng.state.auction_queue == []
        eng.finish_auction()
        assert eng.state.auction is None

    def test_no_trade_during_auction(self) -> None:
        eng = _auction_engine()
        p1 = eng.state.current_player_id
        p2 = eng.state.turn_order[1]
        force_roll(eng, 1, 2)
        eng.roll_dice(p1)
        eng.decline_purchase(p1)
        with pytest.raises(GameError, match="не са позволени|търга"):
            eng.create_trade(p1, p2, offer_cash=10)

    def test_no_skip_during_auction(self) -> None:
        eng = _auction_engine()
        p1 = eng.state.current_player_id
        force_roll(eng, 1, 2)
        eng.roll_dice(p1)
        eng.decline_purchase(p1)
        with pytest.raises(GameError, match="търга"):
            eng.force_skip_turn(p1, timed_out=True)
