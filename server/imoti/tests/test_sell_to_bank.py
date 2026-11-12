"""Продажба на имот обратно на банката за 80% от цената."""
from __future__ import annotations

import random

import pytest

from app.game.advisor import build_debt_advice
from app.game.engine import GameEngine, GameError
from app.game.properties import SELL_TO_BANK_PERCENT, PropertyState
from app.game.rules import GameSettings
from app.game.state import PendingDebt, Phase

from conftest import make_players

GROUP = (6, 8, 9)     # krairechen: 100, 100, 120
LONE = 1              # Вършец, 60 €


def _engine(board, count: int = 2) -> GameEngine:
    engine = GameEngine(board, GameSettings(auctions_enabled=False), rng=random.Random(8))
    engine.start_game(make_players(count))
    engine.state.phase = Phase.MANAGEMENT
    return engine


def _own(engine: GameEngine, position: int, owner: str, level: int = 0,
         mortgaged: bool = False) -> None:
    engine.state.properties[position] = PropertyState(
        position, owner=owner, level=level, mortgaged=mortgaged
    )


# --- Ръчна продажба ------------------------------------------------------

def test_sells_for_eighty_percent_and_frees_the_property(board) -> None:
    engine = _engine(board)
    seller = engine.state.turn_order[0]
    engine.state.current_index = 0
    _own(engine, LONE, seller)
    cash = engine.state.players[seller].cash

    engine.sell_property_to_bank(seller, LONE)

    assert engine.state.players[seller].cash == cash + 48   # 60 × 80%
    assert LONE not in engine.state.properties              # отново свободен
    assert SELL_TO_BANK_PERCENT == 80


def test_cannot_sell_what_you_do_not_own(board) -> None:
    engine = _engine(board)
    seller, other = engine.state.turn_order
    engine.state.current_index = 0
    _own(engine, LONE, other)

    with pytest.raises(GameError):
        engine.sell_property_to_bank(seller, LONE)


def test_mortgaged_property_pays_out_minus_the_principal(board) -> None:
    """Главницата вече е изплатена при ипотекирането, затова се удържа."""
    engine = _engine(board)
    seller = engine.state.turn_order[0]
    engine.state.current_index = 0
    _own(engine, LONE, seller, mortgaged=True)   # Вършец: цена 60, ипотека 30
    cash = engine.state.players[seller].cash

    engine.sell_property_to_bank(seller, LONE)

    assert engine.state.players[seller].cash == cash + 18   # 48 − 30
    assert LONE not in engine.state.properties


def test_buildings_block_the_sale(board) -> None:
    engine = _engine(board)
    seller = engine.state.turn_order[0]
    engine.state.current_index = 0
    for pos in GROUP:
        _own(engine, pos, seller)
    engine.state.properties[GROUP[0]].level = 1

    # И самият застроен имот, и съседите му в групата са блокирани.
    with pytest.raises(GameError):
        engine.sell_property_to_bank(seller, GROUP[0])
    with pytest.raises(GameError):
        engine.sell_property_to_bank(seller, GROUP[1])


def test_sale_is_blocked_during_an_auction(board) -> None:
    engine = GameEngine(board, GameSettings(auctions_enabled=True), rng=random.Random(8))
    engine.start_game(make_players(2))
    seller = engine.state.turn_order[0]
    engine.state.current_index = 0
    _own(engine, LONE, seller)
    engine.state.players[seller].position = 3
    engine.state.phase = Phase.AWAITING_PURCHASE
    engine.decline_purchase(seller)      # стартира търг
    assert engine.state.auction is not None

    with pytest.raises(GameError):
        engine.sell_property_to_bank(seller, LONE)


def test_sold_property_can_be_bought_again(board) -> None:
    engine = _engine(board)
    seller, buyer = engine.state.turn_order
    engine.state.current_index = 0
    _own(engine, LONE, seller)
    engine.sell_property_to_bank(seller, LONE)

    engine.state.current_index = engine.state.turn_order.index(buyer)
    engine.state.players[buyer].position = LONE
    engine.state.players[buyer].cash = 500
    engine.state.phase = Phase.AWAITING_PURCHASE
    engine.buy_property(buyer)

    assert engine.state.properties[LONE].owner == buyer


# --- Като последна мярка при дълг ---------------------------------------

def test_advice_prefers_mortgage_over_selling(board) -> None:
    """Докато ипотеките стигат, имот не се продава."""
    engine = _engine(board)
    debtor, creditor = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, debtor)
    engine.state.players[debtor].cash = 0
    engine.state.debt = PendingDebt(debtor, creditor, 100, "Наем")
    engine.state.phase = Phase.AWAITING_PAYMENT

    advice = build_debt_advice(engine.state, engine.board)

    assert advice["covers"]
    assert all(a["type"] == "mortgage" for a in advice["actions"])


def test_advice_falls_back_to_selling_when_mortgages_are_not_enough(board) -> None:
    engine = _engine(board)
    debtor, creditor = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, debtor)
    engine.state.players[debtor].cash = 0
    # Ипотеките дават 50+50+60 = 160; искаме повече, за да се стигне до продажба.
    engine.state.debt = PendingDebt(debtor, creditor, 250, "Наем")
    engine.state.phase = Phase.AWAITING_PAYMENT

    advice = build_debt_advice(engine.state, engine.board)
    kinds = [a["type"] for a in advice["actions"]]

    assert "sell_property" in kinds, kinds
    # Продажбите идват СЛЕД ипотеките.
    assert kinds.index("sell_property") > kinds.index("mortgage")


def test_raise_funds_executes_the_sale(board) -> None:
    engine = _engine(board)
    debtor, creditor = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, debtor)
    engine.state.players[debtor].cash = 0
    engine.state.debt = PendingDebt(debtor, creditor, 9999, "Наем")
    engine.state.phase = Phase.AWAITING_PAYMENT

    engine.raise_funds(debtor)

    # Всичко е ипотекирано; продадените имоти са напуснали портфейла.
    remaining = [p for p in engine.state.properties.values() if p.owner == debtor]
    assert len(remaining) < len(GROUP)
    assert engine.state.players[debtor].cash > 160   # над сбора на ипотеките
