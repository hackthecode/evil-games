"""Държани карти: прилагат се сами, точно веднъж, при правилното действие."""
from __future__ import annotations

import random

import pytest

from app.game.cards import all_cards
from app.game.engine import GameEngine, GameError
from app.game.properties import PropertyState
from app.game.rules import GameSettings
from app.game.state import Phase

from conftest import make_players

# Карти по сила (виж cards.py).
PURCHASE_DISCOUNT = "com_33"   # 75% от цената
PURCHASE_SURCHARGE = "biz_37"  # 120% от цената
BUILD_HALF_ONCE = "com_34"     # 50%, едно ниво
BUILD_HALF_TWICE = "biz_35"    # 50%, две нива
RENT_BOOST = "com_35"          # 150% за собственика
RENT_SHIELD = "com_36"         # 50% за платеца
RENT_PENALTY = "com_37"        # 50% за собственика

GROUP = (6, 8, 9)  # krairechen


def _engine(board, count: int = 2) -> GameEngine:
    engine = GameEngine(board, GameSettings(auctions_enabled=False), rng=random.Random(4))
    engine.start_game(make_players(count))
    return engine


def _own(engine: GameEngine, position: int, owner: str, level: int = 0) -> None:
    engine.state.properties[position] = PropertyState(position, owner=owner, level=level)


# --- Покупка -------------------------------------------------------------

def test_purchase_discount_applies_once_and_leaves_the_hand(board) -> None:
    engine = _engine(board)
    buyer = engine.state.turn_order[0]
    player = engine.state.players[buyer]
    player.held_cards.append(PURCHASE_DISCOUNT)
    player.cash = 1000
    player.position = 1  # Вършец, 60 €
    engine.state.phase = Phase.AWAITING_PURCHASE
    engine.state.current_index = engine.state.turn_order.index(buyer)

    engine.buy_property(buyer)

    assert player.cash == 1000 - 45          # 60 × 75%
    assert PURCHASE_DISCOUNT not in player.held_cards

    # Втора покупка вече е на пълна цена.
    player.position = 3  # Банкя, 60 €
    engine.state.phase = Phase.AWAITING_PURCHASE
    engine.buy_property(buyer)
    assert player.cash == 1000 - 45 - 60


def test_purchase_surcharge_makes_it_more_expensive(board) -> None:
    engine = _engine(board)
    buyer = engine.state.turn_order[0]
    player = engine.state.players[buyer]
    player.held_cards.append(PURCHASE_SURCHARGE)
    player.cash = 1000
    player.position = 1
    engine.state.phase = Phase.AWAITING_PURCHASE
    engine.state.current_index = engine.state.turn_order.index(buyer)

    engine.buy_property(buyer)

    assert player.cash == 1000 - 72          # 60 × 120%
    assert PURCHASE_SURCHARGE not in player.held_cards


def test_discount_lets_you_afford_what_you_otherwise_could_not(board) -> None:
    """Проверката за средства трябва да е по намалената цена."""
    engine = _engine(board)
    buyer = engine.state.turn_order[0]
    player = engine.state.players[buyer]
    player.held_cards.append(PURCHASE_DISCOUNT)
    player.cash = 50                          # под 60, но над 45
    player.position = 1
    engine.state.phase = Phase.AWAITING_PURCHASE
    engine.state.current_index = engine.state.turn_order.index(buyer)

    engine.buy_property(buyer)

    assert player.cash == 5


def test_failed_purchase_does_not_burn_the_card(board) -> None:
    """Ако средствата не стигат дори с отстъпката, картата остава."""
    engine = _engine(board)
    buyer = engine.state.turn_order[0]
    player = engine.state.players[buyer]
    player.held_cards.append(PURCHASE_DISCOUNT)
    player.cash = 10
    player.position = 1
    engine.state.phase = Phase.AWAITING_PURCHASE
    engine.state.current_index = engine.state.turn_order.index(buyer)

    with pytest.raises(GameError):
        engine.buy_property(buyer)

    assert PURCHASE_DISCOUNT in player.held_cards
    assert player.cash == 10


# --- Строеж --------------------------------------------------------------

def test_build_discount_applies_once(board) -> None:
    engine = _engine(board)
    builder = engine.state.turn_order[0]
    player = engine.state.players[builder]
    for pos in GROUP:
        _own(engine, pos, builder)
    player.held_cards.append(BUILD_HALF_ONCE)
    player.cash = 2000
    engine.state.phase = Phase.MANAGEMENT
    engine.state.current_index = engine.state.turn_order.index(builder)

    full = engine.current_build_cost(GROUP[0])
    engine.build_improvement(builder, GROUP[0])

    assert player.cash == 2000 - full // 2
    assert BUILD_HALF_ONCE not in player.held_cards


def test_multi_use_card_survives_until_its_uses_run_out(board) -> None:
    """Картата за ДВЕ нива остава в ръката след първото."""
    engine = _engine(board)
    builder = engine.state.turn_order[0]
    player = engine.state.players[builder]
    for pos in GROUP:
        _own(engine, pos, builder)
    player.held_cards.append(BUILD_HALF_TWICE)
    player.cash = 5000
    engine.state.phase = Phase.MANAGEMENT
    engine.state.current_index = engine.state.turn_order.index(builder)

    cost = engine.current_build_cost(GROUP[0])
    engine.build_improvement(builder, GROUP[0])
    assert BUILD_HALF_TWICE in player.held_cards, "след 1-во ниво картата остава"

    engine.build_improvement(builder, GROUP[1])
    assert BUILD_HALF_TWICE not in player.held_cards, "след 2-ро ниво си отива"

    engine.build_improvement(builder, GROUP[2])   # трето — на пълна цена
    assert player.cash == 5000 - cost // 2 - cost // 2 - cost


# --- Наем: двама различни играчи в едно събитие --------------------------

def _land_on_rent(engine: GameEngine, payer: str, owner: str, position: int):
    _own(engine, position, owner)
    engine.state.players[payer].position = position
    engine.state.current_index = engine.state.turn_order.index(payer)
    return engine._resolve_space(engine.state.players[payer])


def test_rent_shield_belongs_to_the_payer(board) -> None:
    engine = _engine(board)
    payer, owner = engine.state.turn_order
    engine.state.players[payer].held_cards.append(RENT_SHIELD)
    engine.state.players[payer].cash = 1000
    owner_cash = engine.state.players[owner].cash

    _land_on_rent(engine, payer, owner, GROUP[0])

    # Основен наем на „Чифлик" е 6 €; щитът го прави 3 €.
    assert engine.state.players[owner].cash == owner_cash + 3
    assert RENT_SHIELD not in engine.state.players[payer].held_cards


def test_rent_boost_belongs_to_the_owner(board) -> None:
    engine = _engine(board)
    payer, owner = engine.state.turn_order
    engine.state.players[owner].held_cards.append(RENT_BOOST)
    engine.state.players[payer].cash = 1000
    owner_cash = engine.state.players[owner].cash

    _land_on_rent(engine, payer, owner, GROUP[0])

    assert engine.state.players[owner].cash == owner_cash + 9   # 6 × 150%
    assert RENT_BOOST not in engine.state.players[owner].held_cards


def test_rent_penalty_harms_the_owner(board) -> None:
    engine = _engine(board)
    payer, owner = engine.state.turn_order
    engine.state.players[owner].held_cards.append(RENT_PENALTY)
    engine.state.players[payer].cash = 1000
    owner_cash = engine.state.players[owner].cash

    _land_on_rent(engine, payer, owner, GROUP[0])

    assert engine.state.players[owner].cash == owner_cash + 3   # 6 × 50%
    assert RENT_PENALTY not in engine.state.players[owner].held_cards


def test_both_players_cards_apply_in_one_rent_event(board) -> None:
    """Щитът на платеца и повишението на собственика се трупат."""
    engine = _engine(board)
    payer, owner = engine.state.turn_order
    engine.state.players[payer].held_cards.append(RENT_SHIELD)
    engine.state.players[owner].held_cards.append(RENT_BOOST)
    engine.state.players[payer].cash = 1000
    owner_cash = engine.state.players[owner].cash

    _land_on_rent(engine, payer, owner, GROUP[0])

    # 6 → щит 50% → 3 → повишение 150% → 4 (целочислено).
    assert engine.state.players[owner].cash == owner_cash + 4
    assert not engine.state.players[payer].held_cards
    assert not engine.state.players[owner].held_cards


# --- Общи правила --------------------------------------------------------

def test_keep_card_enters_the_hand_and_not_the_deck(board) -> None:
    engine = _engine(board)
    player = engine.state.players[engine.state.turn_order[0]]
    deck = engine.state.decks["community"]
    card = all_cards()[PURCHASE_DISCOUNT]

    engine._apply_card(player, card, deck)

    assert PURCHASE_DISCOUNT in player.held_cards
    assert PURCHASE_DISCOUNT not in deck.discard_pile


def test_used_card_returns_to_its_deck(board) -> None:
    engine = _engine(board)
    buyer = engine.state.turn_order[0]
    player = engine.state.players[buyer]
    player.held_cards.append(PURCHASE_DISCOUNT)
    player.cash = 1000
    player.position = 1
    engine.state.phase = Phase.AWAITING_PURCHASE
    engine.state.current_index = engine.state.turn_order.index(buyer)

    engine.buy_property(buyer)

    assert PURCHASE_DISCOUNT in engine.state.decks["community"].discard_pile


def test_held_cards_survive_serialization(board) -> None:
    from app.game.serialization import state_from_dict, state_to_dict

    engine = _engine(board)
    player = engine.state.players[engine.state.turn_order[0]]
    player.held_cards.extend([PURCHASE_DISCOUNT, BUILD_HALF_TWICE])
    player.modifiers["held_uses::" + BUILD_HALF_TWICE] = 2

    restored = state_from_dict(state_to_dict(engine.state))
    same = restored.players[player.player_id]

    assert same.held_cards == [PURCHASE_DISCOUNT, BUILD_HALF_TWICE]
    assert same.modifiers["held_uses::" + BUILD_HALF_TWICE] == 2


def test_old_saves_without_held_cards_load_fine(board) -> None:
    from app.game.player import Player

    player = Player.from_dict({
        "player_id": "p1", "name": "Стар запис", "token": "red", "cash": 1500,
    })
    assert player.held_cards == []
