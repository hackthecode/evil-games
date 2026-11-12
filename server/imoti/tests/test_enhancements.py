"""Тестове за класическите режими, статистиката и компютърните играчи."""
from __future__ import annotations

import random

from app.game.bots import choose_bot, play_bot_step
from app.game.engine import GameEngine
from app.game.player import Player
from app.game.properties import PropertyState
from app.game.rules import GameSettings, apply_rules_preset
from app.game.state import PendingDebt, Phase

from conftest import make_players


def test_new_games_use_classic_auctions() -> None:
    assert GameSettings().auctions_enabled is True


def test_quick_preset() -> None:
    settings = GameSettings()
    apply_rules_preset(settings, "quick")
    assert settings.victory_condition == "round_limit"
    assert settings.free_parking_jackpot is True
    assert settings.turn_time_limit == 45


def test_mortgage_transfer_charges_receiver(engine: GameEngine) -> None:
    sender, receiver = engine.state.turn_order
    engine.state.properties[1] = PropertyState(1, owner=sender, mortgaged=True)
    before = engine.state.players[receiver].cash
    trade_value = 33
    engine.create_trade(
        sender, receiver, offer_properties=[1], request_cash=trade_value,
    )
    trade_id = next(iter(engine.state.trades))
    engine.respond_trade(receiver, trade_id, True)
    assert engine.state.players[receiver].cash == before - trade_value - 3
    assert engine.state.properties[1].owner == receiver


def test_bankruptcy_liquidates_buildings(engine: GameEngine) -> None:
    debtor, creditor = engine.state.turn_order
    engine.state.properties[1] = PropertyState(1, owner=debtor, level=2)
    engine.state.players[debtor].cash = 0
    before = engine.state.players[creditor].cash
    engine.state.debt = PendingDebt(debtor, creditor, 9999, "Наем")
    engine.state.phase = Phase.AWAITING_PAYMENT
    engine.declare_bankruptcy(debtor)
    assert engine.state.properties[1].level == 0
    assert engine.state.players[creditor].cash == before + 50


def test_free_parking_collects_bank_pot(board) -> None:
    settings = GameSettings(auctions_enabled=False, free_parking_jackpot=True)
    engine = GameEngine(board, settings, random.Random(1))
    engine.start_game(make_players(2))
    player = engine.state.current_player
    engine._charge(player, None, 100, "Данък")
    assert engine.state.bank_pot == 100
    player.position = 20
    engine._resolve_space(player)
    assert engine.state.bank_pot == 0
    assert player.cash == settings.starting_cash


def test_bank_pot_stays_empty_when_free_parking_fund_is_disabled(board) -> None:
    settings = GameSettings(auctions_enabled=False, free_parking_jackpot=False)
    engine = GameEngine(board, settings, random.Random(1))
    engine.start_game(make_players(2))
    player = engine.state.current_player

    engine._charge(player, None, 100, "Данък")

    assert engine.state.bank_pot == 0
    assert engine.state.bank_transactions[-1]["amount"] == 100


def test_bot_can_play_a_step(board) -> None:
    engine = GameEngine(board, GameSettings(auctions_enabled=False), random.Random(2))
    bots = [
        Player("bot00001", "Бот 1", "red", 0, is_bot=True, bot_style="cautious"),
        Player("bot00002", "Бот 2", "blue", 0, gender="female", is_bot=True, bot_style="aggressive"),
    ]
    engine.start_game(bots)
    player_id = choose_bot(engine)
    events = play_bot_step(engine, player_id)
    assert any(event.get("type") == "dice" for event in events)
