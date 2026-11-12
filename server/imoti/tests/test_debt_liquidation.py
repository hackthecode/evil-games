"""Бързо набавяне на средства при недостиг: комбиниран план с едно действие."""
from __future__ import annotations

import random

import pytest

from app.game.advisor import build_debt_advice
from app.game.engine import GameEngine, GameError
from app.game.properties import PropertyState
from app.game.rules import GameSettings
from app.game.state import PendingDebt, Phase

from conftest import make_players


# Групата „krairechen" е с 3 имота — стига за къщи и ипотеки едновременно.
GROUP = (6, 8, 9)
OTHER = (11, 13)


def _engine(board, count: int = 3) -> GameEngine:
    engine = GameEngine(board, GameSettings(auctions_enabled=False), rng=random.Random(3))
    engine.start_game(make_players(count))
    return engine


def _own(engine: GameEngine, position: int, owner: str, level: int = 0) -> None:
    engine.state.properties[position] = PropertyState(position, owner=owner, level=level)


def _in_debt(engine: GameEngine, debtor: str, creditor: str | None, amount: int) -> None:
    engine.state.debt = PendingDebt(debtor, creditor, amount, "Наем")
    engine.state.phase = Phase.AWAITING_PAYMENT


# --- Планът вече важи и за дълг към банката -----------------------------

def test_plan_settles_debt_to_another_player(board) -> None:
    engine = _engine(board)
    debtor, creditor, _ = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, debtor, level=1)
    engine.state.players[debtor].cash = 0
    creditor_cash = engine.state.players[creditor].cash
    _in_debt(engine, debtor, creditor, 150)

    engine.settle_debt_with_plan(debtor)

    assert engine.state.debt is None
    assert engine.state.phase == Phase.MANAGEMENT
    assert engine.state.players[creditor].cash == creditor_cash + 150


def test_plan_also_settles_debt_to_the_bank(board) -> None:
    """Досега планът се показваше при дълг към банката, но не се изпълняваше."""
    engine = _engine(board)
    debtor = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, debtor, level=1)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, None, 150)

    engine.settle_debt_with_plan(debtor)

    assert engine.state.debt is None
    assert engine.state.phase == Phase.MANAGEMENT


def test_plan_refuses_when_it_cannot_cover(board) -> None:
    engine = _engine(board)
    debtor, creditor, _ = engine.state.turn_order
    _own(engine, GROUP[0], debtor)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, creditor, 9999)

    with pytest.raises(GameError):
        engine.settle_debt_with_plan(debtor)
    # Активите остават непокътнати — не разпродаваме напразно.
    assert engine.state.properties[GROUP[0]].mortgaged is False


def test_plan_matches_what_the_player_was_shown(board) -> None:
    """Изпълненото трябва да съвпада с показания план — имоти и суми."""
    engine = _engine(board)
    debtor, creditor, _ = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, debtor, level=1)
    for pos in OTHER:
        _own(engine, pos, debtor)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, creditor, 200)

    advice = build_debt_advice(engine.state, engine.board)
    expected_raise = sum(a["amount"] for a in advice["actions"])
    sold = {a["position"] for a in advice["actions"] if a["type"] == "sell"}
    mortgaged = {a["position"] for a in advice["actions"] if a["type"] == "mortgage"}

    engine.settle_debt_with_plan(debtor)

    for pos in mortgaged:
        assert engine.state.properties[pos].mortgaged is True, pos
    for pos in sold:
        assert engine.state.properties[pos].level == 0, pos
    # Набраното минус платеното трябва да е остатъкът в брой.
    assert engine.state.players[debtor].cash == expected_raise - 200


# --- Частично набавяне по изрично искане --------------------------------

def test_raise_funds_liquidates_even_when_it_is_not_enough(board) -> None:
    engine = _engine(board)
    debtor, creditor, _ = engine.state.turn_order
    _own(engine, GROUP[0], debtor)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, creditor, 9999)

    engine.raise_funds(debtor)

    # Пълната ликвидация вече минава и през продажба на банката като
    # последна мярка, така че имотът напуска портфейла напълно.
    assert GROUP[0] not in engine.state.properties
    assert engine.state.players[debtor].cash > 0
    # Дългът остава открит — оттук нататък трябва сделка или фалит.
    assert engine.state.debt is not None
    assert engine.state.phase == Phase.AWAITING_PAYMENT


def test_raise_funds_pays_immediately_when_the_plan_turns_out_to_be_enough(board) -> None:
    """Ако набраното стигне, не караме играча да щрака втори бутон."""
    engine = _engine(board)
    debtor, creditor, _ = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, debtor, level=1)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, creditor, 120)

    engine.raise_funds(debtor)

    assert engine.state.debt is None
    assert engine.state.phase == Phase.MANAGEMENT


def test_raise_funds_rejects_when_there_is_nothing_left(board) -> None:
    engine = _engine(board)
    debtor, creditor, _ = engine.state.turn_order
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, creditor, 500)

    with pytest.raises(GameError):
        engine.raise_funds(debtor)


def test_raise_funds_requires_the_payment_phase(board) -> None:
    engine = _engine(board)
    debtor = engine.state.turn_order[0]
    _own(engine, GROUP[0], debtor)

    with pytest.raises(GameError):
        engine.raise_funds(debtor)


def test_only_the_debtor_can_raise_funds(board) -> None:
    engine = _engine(board)
    debtor, other, _ = engine.state.turn_order
    _own(engine, GROUP[0], debtor)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, other, 9999)

    with pytest.raises(GameError):
        engine.raise_funds(other)


# --- Правилата остават в сила -------------------------------------------

@pytest.mark.parametrize("amount", [60, 120, 200, 9999])
def test_liquidation_respects_even_selling_within_a_group(board, amount: int) -> None:
    """Частичната разпродажба не бива да оставя неравна група.

    Правилото допуска разлика най-много едно ниво; планът е подреден точно
    заради това, а `sell_improvement` проверява наново при всяка стъпка.
    """
    engine = _engine(board)
    debtor, creditor, _ = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, debtor, level=2)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, creditor, amount)

    if amount == 9999:
        engine.raise_funds(debtor)
    else:
        engine.settle_debt_with_plan(debtor)

    # При пълна ликвидация имотите може и да са продадени — тогава няма
    # какво да е неравномерно.
    levels = [
        engine.state.properties[pos].level
        for pos in GROUP if pos in engine.state.properties
    ]
    if levels:
        assert max(levels) - min(levels) <= 1, levels
    # Спира веднага щом стигне — не разпродава повече от нужното.
    if amount == 60:
        assert levels == [1, 1, 1]


# --- Време за реакция при възникнал дълг ---------------------------------

def test_new_debt_restarts_the_turn_clock(board) -> None:
    """Длъжникът получава пълен срок, а не остатъка от хода си.

    Играч, който е мислил дълго преди да хвърли, попадаше в дълг с няколко
    останали секунди — физически не успяваше да продаде и ипотекира ръчно и
    таймерът вършеше работата вместо него.
    """
    settings = GameSettings(auctions_enabled=False, turn_time_limit=60)
    engine = GameEngine(board, settings, rng=random.Random(3))
    engine.start_game(make_players(2))
    payer, payee = (engine.state.players[pid] for pid in engine.state.turn_order)
    payer.cash = 10

    engine.touch_turn_clock()
    engine.state.turn_deadline -= 52          # ходът тече вече 52 секунди
    almost_gone = engine.state.turn_deadline

    engine._charge(payer, payee, 500, "Наем")

    assert engine.state.phase is Phase.AWAITING_PAYMENT
    assert engine.state.turn_deadline > almost_gone + 40


def test_turn_clock_is_untouched_when_the_payment_succeeds(board) -> None:
    """Платен наем не е повод за нов срок — ходът си тече нормално."""
    settings = GameSettings(auctions_enabled=False, turn_time_limit=60)
    engine = GameEngine(board, settings, rng=random.Random(3))
    engine.start_game(make_players(2))
    payer, payee = (engine.state.players[pid] for pid in engine.state.turn_order)

    engine.touch_turn_clock()
    engine.state.turn_deadline -= 52
    deadline = engine.state.turn_deadline

    engine._charge(payer, payee, 50, "Наем")

    assert engine.state.turn_deadline == deadline


# --- Изтекло време при дълг към банката ----------------------------------

def test_timeout_liquidates_before_bankruptcy_for_bank_debt(board) -> None:
    """Данък или такса не бива да фалира играч, който има с какво да плати.

    Ликвидацията при изтекло време важеше само за дълг към друг играч;
    дългът към банката водеше право към фалит въпреки свободните активи.
    """
    engine = _engine(board, count=2)
    debtor = engine.state.turn_order[0]
    engine.state.current_index = 0
    for pos in OTHER:
        _own(engine, pos, debtor)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, None, 100)

    engine.force_skip_turn(debtor, timed_out=True)

    assert not engine.state.players[debtor].bankrupt
    assert engine.state.debt is None


def test_timeout_still_bankrupts_when_assets_are_not_enough(board) -> None:
    """Ликвидацията не отменя фалита, когато активите наистина не стигат."""
    engine = _engine(board, count=2)
    debtor = engine.state.turn_order[0]
    engine.state.current_index = 0
    _own(engine, OTHER[0], debtor)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, None, 9999)

    engine.force_skip_turn(debtor, timed_out=True)

    assert engine.state.players[debtor].bankrupt


# --- Ред на ликвидация: от най-евтиното нагоре ---------------------------

def test_plan_starts_from_the_cheapest_property(board) -> None:
    """Първо пада най-евтиният имот, а скъпите се пазят най-дълго."""
    engine = _engine(board)
    debtor, creditor, _ = engine.state.turn_order
    # Поле 1 е 60 €, поле 6 е 100 €, поле 11 е 140 € — ясно различни цени.
    for pos in (1, 6, 11):
        _own(engine, pos, debtor)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, creditor, 25)   # покрива се с една ипотека

    advice = build_debt_advice(engine.state, engine.board)
    assert len(advice["actions"]) == 1
    assert advice["actions"][0]["position"] == 1
    assert advice["actions"][0]["type"] == "mortgage"


def test_plan_walks_prices_upwards(board) -> None:
    """Стъпките вървят възходящо по цена в рамките на всеки вид действие.

    Видовете са степенувани нарочно: първо се изчерпват ипотеките и чак
    когато няма какво повече да се ипотекира, се стига до продажба на
    банката. Затова цените растат вътре във всяка степен, а не общо.
    """
    engine = _engine(board)
    debtor, creditor, _ = engine.state.turn_order
    for pos in (1, 6, 11, 16):
        _own(engine, pos, debtor)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, creditor, 400)

    advice = build_debt_advice(engine.state, engine.board)
    by_kind: dict[str, list[int]] = {}
    for action in advice["actions"]:
        price = engine.board.space(action["position"]).data.get("price", 0)
        by_kind.setdefault(action["type"], []).append(price)
    assert by_kind, "планът е празен"
    for kind, prices in by_kind.items():
        assert prices == sorted(prices), (kind, prices)
    # Ипотеките идват преди продажбите на банката.
    kinds = [a["type"] for a in advice["actions"]]
    if "sell_property" in kinds and "mortgage" in kinds:
        assert kinds.index("mortgage") < kinds.index("sell_property")


def test_buildings_go_before_mortgages_on_the_same_group(board) -> None:
    """Постройките падат първи — ипотека при застроена група е забранена."""
    engine = _engine(board)
    debtor, creditor, _ = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, debtor, level=2)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, creditor, 120)

    advice = build_debt_advice(engine.state, engine.board)
    kinds = [a["type"] for a in advice["actions"]]
    assert kinds and kinds[0] == "sell"
    # Докато има постройки в групата, ипотека не се предлага.
    first_mortgage = next((i for i, k in enumerate(kinds) if k == "mortgage"), None)
    if first_mortgage is not None:
        assert all(k == "sell" for k in kinds[:first_mortgage])


def test_executed_plan_raises_exactly_what_was_promised(board) -> None:
    """Планът се симулира, но правилата се проверяват наново при изпълнение.

    Ако някоя стъпка отпадне при повторната проверка (равномерна продажба,
    свободни къщи), цикълът спира и играчът тихо набира по-малко от
    обявеното. Затова сравняваме обещаното с набраното.
    """
    engine = _engine(board)
    debtor, creditor, _ = engine.state.turn_order
    # Група с различни нива + по-евтини имоти без постройки.
    _own(engine, GROUP[0], debtor, level=3)
    _own(engine, GROUP[1], debtor, level=2)
    _own(engine, GROUP[2], debtor, level=2)
    for pos in (1, 3):
        _own(engine, pos, debtor)
    engine.state.players[debtor].cash = 0
    _in_debt(engine, debtor, creditor, 9999)   # изчерпва всичко

    advice = build_debt_advice(engine.state, engine.board)
    promised = sum(a["amount"] for a in advice["actions"])
    before = engine.state.players[debtor].cash
    engine.raise_funds(debtor)
    assert engine.state.players[debtor].cash - before == promised
