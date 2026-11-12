"""Тестове за настройките на стаята и поправките от 2026-07-18:

- търг от пазарна цена или от минималната стъпка;
- свободна търговия без под/данък/такси;
- победа веднага при фалит на предпоследния с ипотекирани имоти;
- продажба на подобрения по време на собствен дълг.
"""
from __future__ import annotations

import random

import pytest

from app.game.board import Board
from app.game.engine import GameEngine, GameError
from app.game.player import Player
from app.game.properties import PropertyState
from app.game.rules import GameSettings, validate_settings_update
from app.game.state import PendingDebt, Phase
from app.game.trading import TradeError

from conftest import BASE_DIR, make_players


def _engine(settings: GameSettings, count: int = 2) -> GameEngine:
    board = Board.from_file(BASE_DIR / "data" / "board_config.json")
    eng = GameEngine(board, settings, rng=random.Random(42))
    eng.start_game(make_players(count))
    return eng


def _first_property(eng: GameEngine):
    return next(sp for sp in eng.board.spaces if sp.type == "property")


def _group_pair(eng: GameEngine) -> list[int]:
    groups: dict[str, list[int]] = {}
    for sp in eng.board.spaces:
        if sp.type == "property" and sp.group:
            groups.setdefault(sp.group, []).append(sp.position)
    return next(p for p in groups.values() if len(p) == 2)


# ----------------------------------------------------------------------
# Начална цена на търга
# ----------------------------------------------------------------------
def test_auction_starts_from_market_price_when_enabled():
    eng = _engine(GameSettings(auctions_enabled=True, auction_start_market=True))
    state = eng.state
    sp = _first_property(eng)
    state.players["p0"].position = sp.position
    state.phase = Phase.AWAITING_PURCHASE
    state.current_index = 0
    eng.decline_purchase("p0")
    assert state.auction is not None
    assert state.auction.minimum_bid == sp.price


def test_auction_starts_from_min_step_by_default():
    eng = _engine(GameSettings(auctions_enabled=True, auction_start_market=False))
    state = eng.state
    sp = _first_property(eng)
    state.players["p0"].position = sp.position
    state.phase = Phase.AWAITING_PURCHASE
    state.current_index = 0
    eng.decline_purchase("p0")
    assert state.auction is not None
    assert state.auction.minimum_bid == 0  # мин. оферта = стъпката (10)


def test_market_start_bid_below_price_rejected():
    eng = _engine(GameSettings(auctions_enabled=True, auction_start_market=True))
    state = eng.state
    sp = _first_property(eng)
    state.players["p0"].position = sp.position
    state.players["p1"].cash = 5000
    state.phase = Phase.AWAITING_PURCHASE
    state.current_index = 0
    eng.decline_purchase("p0")
    with pytest.raises(GameError):
        eng.place_bid("p1", max(1, sp.price - 10))
    eng.place_bid("p1", sp.price)
    assert state.auction.highest_bid == sp.price


def test_settings_validation_accepts_new_flags():
    clean = validate_settings_update(
        {"auction_start_market": 1, "free_trading": True, "hack": "x"}
    )
    assert clean == {"auction_start_market": True, "free_trading": True}


# ----------------------------------------------------------------------
# Свободна търговия
# ----------------------------------------------------------------------
def _prepare_trade_pair(free: bool) -> GameEngine:
    eng = _engine(GameSettings(auctions_enabled=False, free_trading=free))
    state = eng.state
    sp = _first_property(eng)
    state.properties[sp.position] = PropertyState(position=sp.position, owner="p0")
    state.players["p0"].cash = 1000
    state.players["p1"].cash = 1000
    state.phase = Phase.MANAGEMENT
    state.current_index = 0
    return eng


def test_free_trading_allows_property_gift():
    eng = _prepare_trade_pair(free=True)
    sp = _first_property(eng)
    events = eng.create_trade(
        "p0", "p1", offer_cash=0, offer_properties=[sp.position],
        offer_jail_cards=0, request_cash=0, request_properties=[],
        request_jail_cards=0,
    )
    trade_id = next(t.trade_id for t in eng.state.trades.values())
    eng.respond_trade("p1", trade_id, True)
    assert eng.state.properties[sp.position].owner == "p1"
    # Без данък: парите на двамата са непокътнати.
    assert eng.state.players["p0"].cash == 1000
    assert eng.state.players["p1"].cash == 1000


def test_free_trading_allows_pure_cash_transfer():
    eng = _prepare_trade_pair(free=True)
    eng.create_trade(
        "p0", "p1", offer_cash=800, offer_properties=[], offer_jail_cards=0,
        request_cash=0, request_properties=[], request_jail_cards=0,
    )
    trade_id = next(t.trade_id for t in eng.state.trades.values())
    eng.respond_trade("p1", trade_id, True)
    assert eng.state.players["p0"].cash == 200
    assert eng.state.players["p1"].cash == 1800


def test_free_trading_no_mortgage_fee():
    eng = _prepare_trade_pair(free=True)
    sp = _first_property(eng)
    eng.state.properties[sp.position].mortgaged = True
    eng.create_trade(
        "p0", "p1", offer_cash=0, offer_properties=[sp.position],
        offer_jail_cards=0, request_cash=0, request_properties=[],
        request_jail_cards=0,
    )
    trade_id = next(t.trade_id for t in eng.state.trades.values())
    eng.respond_trade("p1", trade_id, True)
    assert eng.state.properties[sp.position].owner == "p1"
    # Никой не плаща ипотечна такса.
    assert eng.state.players["p1"].cash == 1000


def test_classic_trading_still_enforces_floor():
    eng = _prepare_trade_pair(free=False)
    sp = _first_property(eng)
    with pytest.raises((GameError, TradeError)):
        eng.create_trade(
            "p0", "p1", offer_cash=0, offer_properties=[sp.position],
            offer_jail_cards=0, request_cash=0, request_properties=[],
            request_jail_cards=0,
        )


# ----------------------------------------------------------------------
# Победа при фалит на предпоследния
# ----------------------------------------------------------------------
def test_bankruptcy_with_mortgaged_assets_ends_two_player_game():
    eng = _engine(GameSettings(auctions_enabled=False))
    state = eng.state
    sp = _first_property(eng)
    state.properties[sp.position] = PropertyState(
        position=sp.position, owner="p0", mortgaged=True
    )
    state.players["p0"].cash = 50
    state.players["p1"].cash = 500
    state.debt = PendingDebt(debtor="p0", creditor="p1", amount=400, reason="Наем")
    state.phase = Phase.AWAITING_PAYMENT
    state.current_index = 0
    eng.declare_bankruptcy("p0")
    # Победата се обявява веднага — без висящо решение за ипотеки и лихва.
    assert state.winner == "p1"
    assert state.phase == Phase.GAME_OVER
    assert state.pending_mortgage_transfer is None


def test_bankruptcy_with_mortgaged_assets_continues_three_player_game():
    eng = _engine(GameSettings(auctions_enabled=False), count=3)
    state = eng.state
    sp = _first_property(eng)
    state.properties[sp.position] = PropertyState(
        position=sp.position, owner="p0", mortgaged=True
    )
    state.players["p0"].cash = 50
    state.players["p1"].cash = 500
    state.debt = PendingDebt(debtor="p0", creditor="p1", amount=400, reason="Наем")
    state.phase = Phase.AWAITING_PAYMENT
    state.current_index = 0
    eng.declare_bankruptcy("p0")
    # С трима играчи класическият поток остава: решение за ипотеките.
    assert state.winner is None
    assert state.phase == Phase.AWAITING_MORTGAGE_DECISION
    eng.resolve_mortgage_transfer("p1", [])
    assert state.winner is None
    assert state.phase in (Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL)


# ----------------------------------------------------------------------
# Продажба на подобрения при собствен дълг (регресия)
# ----------------------------------------------------------------------
def test_sell_improvement_and_mortgage_during_debt_to_player():
    eng = _engine(GameSettings(auctions_enabled=False))
    state = eng.state
    pair = _group_pair(eng)
    for pos in pair:
        state.properties[pos] = PropertyState(position=pos, owner="p0", level=2)
    state.players["p0"].cash = 30
    state.debt = PendingDebt(debtor="p0", creditor="p1", amount=400, reason="Наем")
    state.phase = Phase.AWAITING_PAYMENT
    state.current_index = 1  # дългът е извън хода на длъжника
    eng.sell_improvement("p0", pair[0])
    assert state.properties[pair[0]].level == 1
    # Кредиторът НЕ може да набавя средства в тази фаза.
    state.properties[pair[1]].owner = "p1"
    state.properties[pair[1]].level = 0
    with pytest.raises(GameError):
        eng.mortgage_property("p1", pair[1])
