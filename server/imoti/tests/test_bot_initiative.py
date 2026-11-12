"""Тестове за инициативата на ботовете: сделки за монопол и откупуване на ипотеки."""
from __future__ import annotations

import random

from app.game.bots import play_bot_step
from app.game.engine import GameEngine
from app.game.player import Player
from app.game.properties import PropertyState
from app.game.rules import GameSettings
from app.game.state import Phase


# Групата „star_centar" е най-малката (2 имота), което прави сценариите ясни.
GROUP = (1, 3)
OTHER_GROUP = (6, 8, 9)


def _engine(board, bot_cash: int = 1500, style: str = "balanced") -> GameEngine:
    """Бот срещу човек, ботът е на ход във фаза MANAGEMENT."""
    engine = GameEngine(
        board,
        GameSettings(auctions_enabled=False),
        rng=random.Random(11),
    )
    engine.start_game([
        Player("bot1", "Бот", "red", 0, is_bot=True, bot_style=style),
        Player("human", "Човек", "blue", 0),
    ])
    engine.state.players["bot1"].cash = bot_cash
    engine.state.players["human"].cash = 1500
    # Ботът е на ход и е стигнал до управленската фаза.
    engine.state.current_index = engine.state.turn_order.index("bot1")
    engine.state.phase = Phase.MANAGEMENT
    return engine


def _own(engine: GameEngine, position: int, owner: str, mortgaged: bool = False) -> None:
    engine.state.properties[position] = PropertyState(
        position, owner=owner, mortgaged=mortgaged
    )


# --- Сделки по инициатива на бота ---------------------------------------

def test_bot_offers_trade_for_missing_group_property(board) -> None:
    """Бот с 1 от 2 имота предлага пари за затварящия групата имот."""
    engine = _engine(board)
    _own(engine, GROUP[0], "bot1")
    _own(engine, GROUP[1], "human")

    events = play_bot_step(engine, "bot1")

    offer = next(e for e in events if e.get("type") == "trade_offer")
    trade = offer["trade"]
    assert trade["from_player"] == "bot1"
    assert trade["to_player"] == "human"
    assert trade["request_properties"] == [GROUP[1]]
    # Плаща се над стойността (60 €), за да има шанс офертата да бъде приета.
    assert trade["offer_cash"] > 60
    assert not trade["offer_properties"]


def test_bot_offer_is_a_valid_trade(board) -> None:
    """Офертата на бота минава през правилата и човекът може да я приеме."""
    engine = _engine(board)
    _own(engine, GROUP[0], "bot1")
    _own(engine, GROUP[1], "human")

    events = play_bot_step(engine, "bot1")
    trade_id = next(e for e in events if e.get("type") == "trade_offer")["trade"]["trade_id"]

    engine.respond_trade("human", trade_id, True)

    assert engine.state.properties[GROUP[1]].owner == "bot1"
    assert engine.state.trades[trade_id].status == "accepted"


def test_bot_does_not_repeat_the_same_offer(board) -> None:
    """След направена оферта ботът приключва хода, вместо да я повтаря."""
    engine = _engine(board)
    _own(engine, GROUP[0], "bot1")
    _own(engine, GROUP[1], "human")

    play_bot_step(engine, "bot1")
    events = play_bot_step(engine, "bot1")

    assert not any(e.get("type") == "trade_offer" for e in events)
    # Вместо повторна оферта ботът предава хода.
    assert any(e.get("type") == "turn" for e in events)
    assert engine.state.current_player_id == "human"


def test_bot_makes_only_one_pending_offer(board) -> None:
    """Две почти завършени групи не водят до две едновременни оферти."""
    engine = _engine(board, bot_cash=6000)
    _own(engine, GROUP[0], "bot1")
    _own(engine, GROUP[1], "human")
    _own(engine, OTHER_GROUP[0], "bot1")
    _own(engine, OTHER_GROUP[1], "bot1")
    _own(engine, OTHER_GROUP[2], "human")

    play_bot_step(engine, "bot1")
    play_bot_step(engine, "bot1")

    pending = [t for t in engine.state.trades.values() if t.status == "pending"]
    assert len(pending) == 1


def test_bot_skips_offer_it_cannot_afford(board) -> None:
    """Без пари над резерва ботът не предлага сделка."""
    engine = _engine(board, bot_cash=320)  # резервът на balanced е 300
    _own(engine, GROUP[0], "bot1")
    _own(engine, GROUP[1], "human")

    events = play_bot_step(engine, "bot1")

    assert not any(e.get("type") == "trade_offer" for e in events)


def test_bot_ignores_group_owned_by_nobody(board) -> None:
    """Свободен имот се купува от полето, не се иска със сделка."""
    engine = _engine(board)
    _own(engine, GROUP[0], "bot1")

    events = play_bot_step(engine, "bot1")

    assert not any(e.get("type") == "trade_offer" for e in events)


def test_aggressive_bot_pays_more_than_cautious(board) -> None:
    """Стилът определя надценката за монопол."""
    offers = {}
    for style in ("cautious", "aggressive"):
        engine = _engine(board, bot_cash=3000, style=style)
        _own(engine, GROUP[0], "bot1")
        _own(engine, GROUP[1], "human")
        events = play_bot_step(engine, "bot1")
        offer = next(e for e in events if e.get("type") == "trade_offer")
        offers[style] = offer["trade"]["offer_cash"]

    assert offers["aggressive"] > offers["cautious"]


def test_bot_does_not_request_property_from_built_group(board) -> None:
    """Имот от група с постройки не може да се разменя — ботът не го иска."""
    engine = _engine(board)
    _own(engine, GROUP[0], "bot1")
    _own(engine, GROUP[1], "human")
    engine.state.properties[GROUP[1]].level = 1

    events = play_bot_step(engine, "bot1")

    assert not any(e.get("type") == "trade_offer" for e in events)


def test_bot_makes_no_offer_when_trading_disabled(board) -> None:
    engine = _engine(board)
    engine.state.settings.trading_enabled = False
    _own(engine, GROUP[0], "bot1")
    _own(engine, GROUP[1], "human")

    events = play_bot_step(engine, "bot1")

    assert not any(e.get("type") == "trade_offer" for e in events)


# --- Откупуване на ипотеки ----------------------------------------------

def test_bot_unmortgages_when_it_has_spare_cash(board) -> None:
    """Свободните пари над резерва се връщат в ипотекиран имот."""
    engine = _engine(board, bot_cash=2000)
    _own(engine, GROUP[0], "bot1", mortgaged=True)

    events = play_bot_step(engine, "bot1")

    assert any(
        e.get("type") == "unmortgage" and e.get("position") == GROUP[0]
        for e in events
    )
    assert engine.state.properties[GROUP[0]].mortgaged is False


def test_bot_keeps_reserve_instead_of_unmortgaging(board) -> None:
    """Ипотеката остава, ако откупуването би пробило резерва."""
    engine = _engine(board, bot_cash=320)  # 33 € откупуване, резерв 300
    _own(engine, GROUP[0], "bot1", mortgaged=True)

    events = play_bot_step(engine, "bot1")

    assert not any(e.get("type") == "unmortgage" for e in events)
    assert engine.state.properties[GROUP[0]].mortgaged is True


def test_bot_unmortgages_complete_group_first(board) -> None:
    """Завършената група има предимство пред по-скъп единичен имот."""
    engine = _engine(board, bot_cash=4000)
    # Завършена група от два евтини имота, и двата ипотекирани.
    _own(engine, GROUP[0], "bot1", mortgaged=True)
    _own(engine, GROUP[1], "bot1", mortgaged=True)
    # По-скъп имот извън завършена група.
    _own(engine, OTHER_GROUP[2], "bot1", mortgaged=True)

    events = play_bot_step(engine, "bot1")

    released = next(e["position"] for e in events if e.get("type") == "unmortgage")
    assert released in GROUP


def test_bot_unmortgages_before_building(board) -> None:
    """Мъртвият капитал се връща в игра преди нов строеж."""
    engine = _engine(board, bot_cash=4000)
    _own(engine, GROUP[0], "bot1")
    _own(engine, GROUP[1], "bot1", mortgaged=True)

    events = play_bot_step(engine, "bot1")

    assert any(e.get("type") == "unmortgage" for e in events)
    assert not any(e.get("type") == "build" for e in events)


# --- Регресия: контраофертата не бива да чупи хода на бота ---------------

def test_counter_offer_never_breaks_the_bot_turn(board) -> None:
    """Каквото и да реши ботът, ходът му завършва с валидно действие.

    Намерено чрез фъзинг: контраофертата проверяваше само дали противникът
    има исканата сума, но не и данъка върху надценката, който той също
    дължи. Правилата отхвърляха сделката и GameError прекъсваше целия
    бот-ход — в 23% от партиите.
    """
    from app.game.trading import validate_trade

    # Обхождаме диапазона, в който чистата сума стига, но данъкът — не.
    for human_cash in range(60, 400, 20):
        engine = _engine(board, bot_cash=2000)
        _own(engine, GROUP[0], "bot1")
        engine.state.players["human"].cash = 3000
        # Валидна входяща оферта: човекът плаща стойността на имота.
        engine.create_trade("human", "bot1", offer_cash=60,
                            request_properties=[GROUP[0]])
        engine.state.players["human"].cash = human_cash

        events = play_bot_step(engine, "bot1")

        assert events, f"празен ход при {human_cash} €"
        for trade in engine.state.trades.values():
            if trade.from_player == "bot1" and trade.status == "pending":
                # Ако е предложил контраоферта, тя трябва да е изпълнима.
                validate_trade(engine.state, engine.board, trade)


def test_bot_survives_an_offer_that_became_invalid(board) -> None:
    """Приемане на оферта, обезсилена междувременно, не бива да хвърля."""
    engine = _engine(board, bot_cash=2000)
    _own(engine, OTHER_GROUP[0], "human")
    # Валидна оферта: имот срещу равностойни пари.
    engine.create_trade("human", "bot1",
                        offer_properties=[OTHER_GROUP[0]], request_cash=100)
    # Човекът вече не притежава имота — офертата е обезсилена.
    del engine.state.properties[OTHER_GROUP[0]]

    events = play_bot_step(engine, "bot1")

    assert events, "ботът трябва да откаже, а не да се счупи"
