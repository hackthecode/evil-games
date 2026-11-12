"""Банков заем: таван 50% от активите, лихва в брой на всяка обиколка.

Лихвата се ПЛАЩА, а не се трупа върху главницата. Само когато играчът
няма средства и гратисът още тече, тя се добавя към заема.
"""
from __future__ import annotations

import random

import pytest

from app.game.engine import GameEngine, GameError
from app.game.properties import LOAN_INTEREST_PERCENT, LOAN_MAX_PERCENT, PropertyState
from app.game.rules import GameSettings
from app.game.state import PendingDebt, Phase

from conftest import make_players

GROUP = (6, 8, 9)   # 100 + 100 + 120 = 320
LONE = 1            # Вършец, 60 €


def _engine(board, count: int = 2) -> GameEngine:
    engine = GameEngine(board, GameSettings(auctions_enabled=False), rng=random.Random(6))
    engine.start_game(make_players(count))
    engine.state.phase = Phase.MANAGEMENT
    engine.state.current_index = 0
    # Тайните мисии се раздават със seed от часовника (engine.start_game), а
    # тукашните имоти могат случайно да изпълнят някоя и да добавят бонус.
    # Заемите нямат нищо общо с мисиите — изключваме ги, за да не мърда кешът.
    for player in engine.state.players.values():
        player.secret_mission = None
    return engine


def _own(engine: GameEngine, position: int, owner: str, level: int = 0,
         mortgaged: bool = False) -> None:
    engine.state.properties[position] = PropertyState(
        position, owner=owner, level=level, mortgaged=mortgaged
    )


# --- Таван на заема ------------------------------------------------------

def test_no_properties_means_no_loan(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]

    assert engine.loan_capacity(player) == 0
    with pytest.raises(GameError):
        engine.take_loan(player, 100)


def test_capacity_is_half_the_asset_value(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, player)

    assert engine.loan_capacity(player) == 320 * LOAN_MAX_PERCENT // 100  # 160


def test_buildings_raise_the_capacity(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, player)
    engine.state.properties[GROUP[0]].level = 2   # 2 × 50 € строеж

    assert engine.loan_capacity(player) == (320 + 100) // 2


def test_mortgaged_properties_do_not_count(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]
    _own(engine, GROUP[0], player)
    _own(engine, GROUP[1], player, mortgaged=True)

    assert engine.loan_capacity(player) == 100 // 2


def test_borrowing_above_the_cap_is_refused(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, player)

    with pytest.raises(GameError):
        engine.take_loan(player, 161)
    assert engine.state.players[player].loan == 0


def test_capacity_shrinks_with_the_outstanding_balance(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, player)

    engine.take_loan(player, 100)

    assert engine.loan_capacity(player) == 60
    with pytest.raises(GameError):
        engine.take_loan(player, 61)


def test_loan_adds_cash_and_debt(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, player)
    cash = engine.state.players[player].cash

    engine.take_loan(player, 150)

    assert engine.state.players[player].cash == cash + 150
    assert engine.state.players[player].loan == 150


# --- Лихва ---------------------------------------------------------------

def test_no_interest_before_a_full_lap(board) -> None:
    """Самото редуване на ходовете не начислява лихва."""
    engine = _engine(board, count=2)
    borrower, _ = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, borrower)
    engine.state.current_index = engine.state.turn_order.index(borrower)
    engine.take_loan(borrower, 100)

    for _ in range(6):
        engine._advance_turn()

    assert engine.state.players[borrower].loan == 100


def test_interest_accrues_on_each_completed_lap(board) -> None:
    engine = _engine(board, count=2)
    borrower, _ = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, borrower)
    engine.state.current_index = engine.state.turn_order.index(borrower)
    engine.take_loan(borrower, 100)
    player = engine.state.players[borrower]

    cash_before = player.cash

    # Една пълна обиколка (минаване през Начален площад). Играчът има
    # пари, затова лихвата се ПЛАЩА и заемът остава непроменен.
    player.stats["laps"] += 1
    engine._advance_turn(); engine._advance_turn()
    assert player.loan == 100
    assert player.cash == cash_before - 20

    # Втора обиколка: пак се плаща от кеша, без натрупване.
    player.stats["laps"] += 1
    engine._advance_turn(); engine._advance_turn()
    assert player.loan == 100
    assert player.cash == cash_before - 40


def test_missed_laps_are_not_lost(board) -> None:
    """Ако лихвата не е начислена навреме, догонва всички обиколки."""
    engine = _engine(board, count=2)
    borrower, _ = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, borrower)
    engine.state.current_index = engine.state.turn_order.index(borrower)
    engine.take_loan(borrower, 100)
    player = engine.state.players[borrower]

    cash_before = player.cash
    player.stats["laps"] += 2
    engine._accrue_loan_interest(player)

    # Две обиколки наведнъж — и двете лихви се плащат в брой.
    assert player.loan == 100
    assert player.cash == cash_before - 40


def test_interest_percent_comes_from_room_settings(board) -> None:
    engine = _engine(board, count=2)
    engine.state.settings.loan_interest_percent = 50
    borrower, _ = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, borrower)
    engine.take_loan(borrower, 100)
    player = engine.state.players[borrower]

    cash_before = player.cash
    player.stats["laps"] += 1
    engine._accrue_loan_interest(player)

    assert player.loan == 100                    # не се трупа
    assert player.cash == cash_before - 50       # 50% лихва, платена в брой


def test_loans_can_be_disabled_in_settings(board) -> None:
    engine = _engine(board)
    engine.state.settings.loans_enabled = False
    player = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, player)

    assert engine.loan_capacity(player) == 0
    with pytest.raises(GameError):
        engine.take_loan(player, 50)


def test_no_interest_without_a_loan(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]
    engine._advance_turn()
    assert engine.state.players[player].loan == 0


# --- Погасяване ----------------------------------------------------------

def test_repay_in_full(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, player)
    engine.take_loan(player, 150)
    cash = engine.state.players[player].cash

    engine.repay_loan(player)

    assert engine.state.players[player].loan == 0
    assert engine.state.players[player].cash == cash - 150


def test_partial_repayment(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, player)
    engine.take_loan(player, 150)

    engine.repay_loan(player, 50)

    assert engine.state.players[player].loan == 100


def test_repayment_is_capped_by_available_cash(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, player)
    engine.take_loan(player, 150)
    engine.state.players[player].cash = 40

    engine.repay_loan(player)

    assert engine.state.players[player].loan == 110
    assert engine.state.players[player].cash == 0


def test_repay_without_a_loan_is_refused(board) -> None:
    engine = _engine(board)
    player = engine.state.turn_order[0]
    with pytest.raises(GameError):
        engine.repay_loan(player)


# --- Нетна стойност: най-важната проверка --------------------------------

def test_loan_reduces_net_worth(board) -> None:
    """Иначе играч печели или се спасява от фалит с чужди пари."""
    engine = _engine(board)
    player_id = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, player_id)
    player = engine.state.players[player_id]
    before = player.net_worth(engine.board, engine.state.properties)

    engine.take_loan(player_id, 150)
    after = player.net_worth(engine.board, engine.state.properties)

    # Парите растат със 150, но и дългът — нетната стойност не мърда.
    assert after == before
    # А след лихвата (една завършена обиколка) вече е по-беден.
    player.stats["laps"] += 1
    engine._accrue_loan_interest(player)
    assert player.net_worth(engine.board, engine.state.properties) < before


def test_loan_survives_serialization(board) -> None:
    from app.game.serialization import state_from_dict, state_to_dict

    engine = _engine(board)
    player_id = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, player_id)
    engine.take_loan(player_id, 120)

    restored = state_from_dict(state_to_dict(engine.state))

    assert restored.players[player_id].loan == 120


def test_old_saves_without_loan_default_to_zero(board) -> None:
    from app.game.player import Player

    player = Player.from_dict({
        "player_id": "p1", "name": "Стар", "token": "red", "cash": 1500,
    })
    assert player.loan == 0
    assert LOAN_INTEREST_PERCENT == 20 and LOAN_MAX_PERCENT == 50


# --- Лихвата се плаща, а не се трупа ------------------------------------

def _borrower_with_loan(board, amount: int = 100, cash: int | None = None):
    """Играч с имоти от GROUP и изтеглен заем; връща (engine, id, player)."""
    engine = _engine(board, count=2)
    borrower, _ = engine.state.turn_order
    for pos in GROUP:
        _own(engine, pos, borrower)
    engine.state.current_index = engine.state.turn_order.index(borrower)
    engine.take_loan(borrower, amount)
    player = engine.state.players[borrower]
    if cash is not None:
        player.cash = cash
    return engine, borrower, player


def test_paid_interest_leaves_the_loan_untouched(board) -> None:
    engine, _, player = _borrower_with_loan(board)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    player.stats["laps"] += 1
    engine._accrue_loan_interest(player)

    assert player.loan == 100
    # Начислява се в началото на хода — фазата не бива да мърда, иначе
    # играчът губи хвърлянето си.
    assert engine.state.phase == Phase.WAITING_FOR_ROLL
    assert engine.state.debt is None


def test_unpayable_interest_inside_grace_is_added_to_the_loan(board) -> None:
    """Докато гратисът тече, недостигът не праща играча да разпродава."""
    engine, _, player = _borrower_with_loan(board, cash=5)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    player.stats["laps"] += 1
    engine._accrue_loan_interest(player)

    assert player.loan == 120          # лихвата е добавена
    assert player.cash == 5            # нищо не е платено
    assert engine.state.debt is None
    assert engine.state.phase == Phase.WAITING_FOR_ROLL


def test_unpayable_interest_after_grace_raises_a_debt(board) -> None:
    engine, borrower, player = _borrower_with_loan(board, cash=5)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    grace = engine.state.settings.loan_grace_laps
    player.stats["laps"] += grace + 1
    engine._accrue_loan_interest(player)

    assert engine.state.phase == Phase.AWAITING_PAYMENT
    assert engine.state.debt is not None
    assert engine.state.debt.debtor == borrower
    # Уреждането трябва да върне играча към хвърлянето, а не към
    # управлението — дългът е възникнал ПРЕДИ хода му.
    assert engine.state.debt.resume_phase == Phase.WAITING_FOR_ROLL.value


def test_settling_that_debt_returns_the_player_to_the_roll(board) -> None:
    engine, borrower, player = _borrower_with_loan(board, cash=5)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    player.stats["laps"] += engine.state.settings.loan_grace_laps + 1
    engine._accrue_loan_interest(player)
    assert engine.state.phase == Phase.AWAITING_PAYMENT

    player.cash = 1000
    due = engine.state.debt.amount
    engine.settle_debt(borrower)
    assert engine.state.phase == Phase.WAITING_FOR_ROLL
    assert engine.state.debt is None
    assert player.cash == 1000 - due     # лихвата наистина е събрана


def test_grace_does_not_restart_when_topping_up_the_loan(board) -> None:
    """Ново теглене не бива да отлага разплащането безкрайно."""
    engine, borrower, player = _borrower_with_loan(board, amount=50)
    taken_at = player.loan_taken_lap
    player.stats["laps"] += 3
    engine.take_loan(borrower, 50)
    assert player.loan_taken_lap == taken_at


# --- Прибиране на заема при изчерпано обезпечение ------------------------

def test_loan_is_called_in_when_it_exceeds_the_property_value(board) -> None:
    engine, borrower, player = _borrower_with_loan(board)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    # Дълг над стойността на имотите (GROUP = 320 €).
    player.loan = 400
    player.cash = 5
    player.stats["laps"] += 1
    engine._accrue_loan_interest(player)

    assert engine.state.phase == Phase.AWAITING_PAYMENT
    assert engine.state.debt is not None
    assert "заема" in engine.state.debt.reason.lower()


def test_called_in_loan_is_repaid_at_once_when_affordable(board) -> None:
    engine, _, player = _borrower_with_loan(board)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    player.loan = 400
    player.cash = 2000
    player.stats["laps"] += 1
    engine._accrue_loan_interest(player)

    assert player.loan == 0
    assert engine.state.debt is None
    assert engine.state.phase == Phase.WAITING_FOR_ROLL


def test_mortgaging_does_not_trigger_the_call_in(board) -> None:
    """Ипотеката е първата стъпка при набавяне на пари.

    Ако обезпечението се мереше само по свободните имоти, самото спасяване
    щеше да срине покритието и да поиска целия заем — спирала, от която
    играчът няма изход.
    """
    engine, borrower, player = _borrower_with_loan(board, amount=150)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    for pos in GROUP:
        engine.mortgage_property(borrower, pos)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    player.stats["laps"] += 1
    engine._accrue_loan_interest(player)

    # Ипотекираните имоти още са обезпечение — няма прибиране.
    assert engine.state.debt is None
    assert player.loan == 150


def test_loan_fields_survive_serialization(board) -> None:
    from app.game.serialization import state_from_dict, state_to_dict

    engine, borrower, player = _borrower_with_loan(board)
    player.stats["laps"] += 4
    restored = state_from_dict(state_to_dict(engine.state))
    assert restored.players[borrower].loan_taken_lap == player.loan_taken_lap


def test_old_save_without_the_new_field_keeps_its_grace(board) -> None:
    """Стар запис не бива да се озове извън гратиса още при зареждането."""
    from app.game.player import Player

    restored = Player.from_dict({
        "player_id": "p0", "name": "Стар", "token": "red", "cash": 100,
        "loan": 200, "loan_lap": 7,
    })
    assert restored.loan_taken_lap == 7


# --- Дългът в началото на хода не блокира играта ------------------------

def _push_into_post_grace_debt(engine: GameEngine, player):
    """Довежда играча до неплатима лихва с изтекъл гратис."""
    engine.state.phase = Phase.WAITING_FOR_ROLL
    player.cash = 5
    player.stats["laps"] += engine.state.settings.loan_grace_laps + 1
    return engine._accrue_loan_interest(player)


def test_bot_resolves_the_turn_start_debt_itself(board) -> None:
    from app.game.bots import choose_bot, play_bot_step

    engine, borrower, player = _borrower_with_loan(board)
    player.is_bot = True
    _push_into_post_grace_debt(engine, player)

    assert choose_bot(engine) == borrower
    for _ in range(12):                      # ипотекира/продава, докато плати
        if engine.state.debt is None:
            break
        play_bot_step(engine, borrower)
    assert engine.state.debt is None
    # Играта продължава, а не виси във фаза на плащане.
    assert engine.state.phase in (Phase.WAITING_FOR_ROLL, Phase.MANAGEMENT)


def test_bankruptcy_from_the_turn_start_debt_passes_the_turn(board) -> None:
    """Дори при фалит редът трябва да мине нататък.

    С трима играчи, за да не свърши играта: при двама победата настъпва
    веднага и проверката за предаване на реда би минала на празни обороти.
    """
    engine = _engine(board, count=3)
    borrower = engine.state.turn_order[0]
    for pos in GROUP:
        _own(engine, pos, borrower)
    engine.state.current_index = 0
    engine.take_loan(borrower, 100)
    player = engine.state.players[borrower]
    for pos in GROUP:                        # без имоти няма какво да продаде
        engine.state.properties.pop(pos, None)
    _push_into_post_grace_debt(engine, player)
    assert engine.state.debt is not None

    engine.declare_bankruptcy(borrower)
    assert player.bankrupt
    assert engine.state.debt is None
    assert engine.state.phase != Phase.AWAITING_PAYMENT
    assert engine.state.phase != Phase.GAME_OVER
    assert engine.state.current_player_id != borrower


def test_timeout_skips_the_turn_start_debt(board) -> None:
    """Изтекло време при дълг преди хвърлянето предава реда."""
    engine, borrower, player = _borrower_with_loan(board)
    _push_into_post_grace_debt(engine, player)
    assert engine.state.phase == Phase.AWAITING_PAYMENT

    engine.force_skip_turn(borrower, timed_out=True)
    assert engine.state.current_player_id != borrower


def test_laps_left_over_after_a_demand_are_not_forgiven(board) -> None:
    """Прекъсването заради дълг не бива да опрощава следващите обиколки."""
    engine, borrower, player = _borrower_with_loan(board)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    player.cash = 5
    # Дългогодишен длъжник: гратисът отдавна е изтекъл, но лихвата е била
    # плащана редовно до преди три обиколки.
    laps = player.stats["laps"] + 20
    player.stats["laps"] = laps
    player.loan_taken_lap = laps - engine.state.settings.loan_grace_laps - 1
    player.loan_lap = laps - 3
    engine._accrue_loan_interest(player)

    # Първата е поискана като задължение; другите две чакат реда си.
    assert engine.state.debt is not None
    assert player.stats["laps"] - player.loan_lap == 2

    player.cash = 1000
    due = engine.state.debt.amount
    engine.settle_debt(borrower)
    assert player.cash == 1000 - due
    cash_after_settle = player.cash
    engine._accrue_loan_interest(player)
    # Двете чакащи обиколки се плащат сега, а не изчезват.
    assert player.cash == cash_after_settle - 40
    assert player.loan_lap == player.stats["laps"]


def test_settling_the_called_in_loan_closes_it(board) -> None:
    """Платената главница закрива заема, вместо да се иска пак."""
    engine, borrower, player = _borrower_with_loan(board)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    player.loan = 400          # над стойността на имотите (GROUP = 320 €)
    player.cash = 5
    player.stats["laps"] += 1
    engine._accrue_loan_interest(player)
    # Гратисът още тече: лихвата от 80 € се добавя, а после банката иска
    # целия набъбнал остатък.
    assert player.loan == 480
    assert engine.state.debt is not None
    assert engine.state.debt.amount == 480

    player.cash = 2000
    engine.settle_debt(borrower)
    assert player.cash == 1520
    assert player.loan == 0            # без това играчът плаща два пъти
    assert engine.state.debt is None

    # Следващата обиколка не бива да иска нищо повече.
    player.stats["laps"] += 1
    engine._accrue_loan_interest(player)
    assert engine.state.debt is None
    assert player.cash == 1520


def test_called_in_loan_flag_survives_serialization(board) -> None:
    from app.game.serialization import state_from_dict, state_to_dict

    engine, _, player = _borrower_with_loan(board)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    player.loan = 400
    player.cash = 5
    player.stats["laps"] += 1
    engine._accrue_loan_interest(player)

    restored = state_from_dict(state_to_dict(engine.state))
    assert restored.debt is not None
    assert restored.debt.clears_loan is True
    assert restored.debt.resume_phase == Phase.WAITING_FOR_ROLL.value


def test_plain_debt_does_not_touch_the_loan(board) -> None:
    """Обикновен дълг (наем) не бива да закрива заема като страничен ефект."""
    engine, borrower, player = _borrower_with_loan(board)
    player.cash = 5
    engine.state.phase = Phase.MANAGEMENT
    engine._enter_payment_phase(PendingDebt(
        debtor=borrower, creditor=None, amount=30, reason="Наем",
    ))
    player.cash = 500
    engine.settle_debt(borrower)
    assert player.loan == 100          # непокътнат


def test_the_grace_covers_exactly_ten_laps(board) -> None:
    """Десетата обиколка още е в гратис; единайсетата вече не е."""
    engine, _, player = _borrower_with_loan(board)
    engine.state.phase = Phase.WAITING_FOR_ROLL
    player.cash = 5
    grace = engine.state.settings.loan_grace_laps
    taken = player.loan_taken_lap

    player.stats["laps"] = taken + grace          # точно десетата
    player.loan_lap = player.stats["laps"] - 1
    engine._accrue_loan_interest(player)
    assert engine.state.debt is None              # още се добавя към заема

    player.stats["laps"] = taken + grace + 1      # единайсетата
    engine._accrue_loan_interest(player)
    assert engine.state.debt is not None
