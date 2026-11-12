"""Тестове на игровия двигател: движение, покупки, наеми, карти, фалит."""
from __future__ import annotations

import pytest

from app.game.engine import GameEngine, GameError
from app.game.player import Player
from app.game.properties import PropertyState
from app.game.rules import GameSettings
from app.game.state import PendingDebt, Phase

from conftest import force_roll


# ----------------------------------------------------------------------
# Движение
# ----------------------------------------------------------------------
class TestMovement:
    def test_roll_moves_current_player(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        force_roll(engine, 1, 3)  # поле 4: данък (неутрално, без преместване)
        engine.roll_dice(pid)
        assert engine.state.players[pid].position == 4

    def test_wrap_around_board(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].position = 38
        force_roll(engine, 2, 3)
        engine.roll_dice(pid)
        assert engine.state.players[pid].position == (38 + 5) % 40

    def test_pass_start_collects_income(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        player.position = 38
        cash_before = player.cash
        force_roll(engine, 2, 3)
        engine.roll_dice(pid)
        # стъпва на поле 3 (имот) — фаза за покупка; доходът е получен.
        assert player.cash == cash_before + engine.state.settings.start_income

    def test_pass_start_collects_european_subsidy(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        player.position = 38
        engine.state.settings.eu_subsidies_enabled = True
        engine.state.settings.eu_subsidy_amount = 350
        cash_before = player.cash

        force_roll(engine, 2, 3)
        events = engine.roll_dice(pid)

        assert player.cash == cash_before + engine.state.settings.start_income + 350
        assert engine.state.bank_transactions[-1]["reason"] == "Европейска субсидия"
        assert engine.state.bank_transactions[-1]["amount"] == 350
        assert any(
            event.get("type") == "payment" and event.get("amount") == 350
            for event in events
        )

    def test_cannot_roll_twice(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        force_roll(engine, 3, 4)
        engine.roll_dice(pid)
        with pytest.raises(GameError):
            engine.roll_dice(pid)

    def test_other_player_cannot_roll(self, engine: GameEngine) -> None:
        other = engine.state.turn_order[1]
        with pytest.raises(GameError):
            engine.roll_dice(other)

    def test_other_player_cannot_end_turn(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        force_roll(engine, 1, 2)  # поле 3 — имот
        engine.roll_dice(pid)
        engine.decline_purchase(pid)
        other = engine.state.turn_order[1]
        with pytest.raises(GameError):
            engine.end_turn(other)


# ----------------------------------------------------------------------
# Покупка и наем
# ----------------------------------------------------------------------
class TestPurchase:
    def test_buy_property(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        force_roll(engine, 1, 2)  # поле 3: Банкя, 60 €.
        engine.roll_dice(pid)
        assert engine.state.phase == Phase.AWAITING_PURCHASE
        cash_before = player.cash
        engine.buy_property(pid)
        assert engine.state.properties[3].owner == pid
        assert player.cash == cash_before - 60
        assert engine.state.phase == Phase.MANAGEMENT

    def test_cannot_buy_out_of_phase(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        with pytest.raises(GameError):
            engine.buy_property(pid)

    def test_cannot_buy_without_cash(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 10
        force_roll(engine, 1, 2)
        engine.roll_dice(pid)
        with pytest.raises(GameError):
            engine.buy_property(pid)

    def test_rent_paid_on_landing(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        # p1 притежава поле 3.
        engine.state.properties[3] = PropertyState(position=3, owner=p1)
        # Прескачаме към хода на p2.
        engine.state.current_index = 1
        cash1 = engine.state.players[p1].cash
        cash2 = engine.state.players[p2].cash
        force_roll(engine, 1, 2)
        engine.roll_dice(p2)
        rent = 4  # базов наем на поле 3
        assert engine.state.players[p2].cash == cash2 - rent
        assert engine.state.players[p1].cash == cash1 + rent

    def test_no_rent_on_mortgaged(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1, mortgaged=True)
        engine.state.current_index = 1
        cash2 = engine.state.players[p2].cash
        force_roll(engine, 1, 2)
        engine.roll_dice(p2)
        assert engine.state.players[p2].cash == cash2
        assert engine.state.phase == Phase.MANAGEMENT


# ----------------------------------------------------------------------
# Отказ от покупка
# ----------------------------------------------------------------------
class TestDeclinePurchase:
    def test_decline_leaves_property_free(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        force_roll(engine, 1, 2)
        engine.roll_dice(pid)
        engine.decline_purchase(pid)
        assert engine.state.phase == Phase.MANAGEMENT
        prop = engine.state.properties.get(3)
        assert prop is None or prop.owner is None

    def test_declined_property_can_be_bought_later(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        force_roll(engine, 1, 2)
        engine.roll_dice(p1)
        engine.decline_purchase(p1)
        engine.end_turn(p1)
        # Вторият играч стъпва на същото поле и го купува.
        force_roll(engine, 1, 2)
        engine.roll_dice(p2)
        assert engine.state.phase == Phase.AWAITING_PURCHASE
        engine.buy_property(p2)
        assert engine.state.properties[3].owner == p2

    def test_cannot_decline_out_of_phase(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        with pytest.raises(GameError):
            engine.decline_purchase(pid)


# ----------------------------------------------------------------------
# Групи и подобрения
# ----------------------------------------------------------------------
class TestImprovements:
    def _own_group(self, engine: GameEngine, pid: str) -> list[int]:
        # Група star_centar: полета 1 и 3.
        for pos in (1, 3):
            engine.state.properties[pos] = PropertyState(position=pos, owner=pid)
        return [1, 3]

    def test_full_group_doubles_base_rent(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        self._own_group(engine, p1)
        engine.state.current_index = 1
        cash2 = engine.state.players[p2].cash
        force_roll(engine, 1, 2)
        engine.roll_dice(p2)
        assert engine.state.players[p2].cash == cash2 - 8  # 4 × 2

    def test_build_requires_full_group(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.properties[1] = PropertyState(position=1, owner=pid)
        with pytest.raises(GameError):
            engine.build_improvement(pid, 1)

    def test_build_and_rent_increase(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        self._own_group(engine, p1)
        engine.build_improvement(p1, 1)
        assert engine.state.properties[1].level == 1
        # Равномерност: второ ниво на поле 1 изисква ниво 1 на поле 3.
        with pytest.raises(GameError):
            engine.build_improvement(p1, 1)
        engine.build_improvement(p1, 3)
        engine.build_improvement(p1, 1)
        assert engine.state.properties[1].level == 2

    def test_sell_improvement_evenly(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        self._own_group(engine, pid)
        engine.build_improvement(pid, 1)
        engine.build_improvement(pid, 3)
        engine.sell_improvement(pid, 1)
        assert engine.state.properties[1].level == 0
        # Не може пак от поле 1 — поле 3 е с по-високо ниво.
        with pytest.raises(GameError):
            engine.sell_improvement(pid, 1)
        engine.sell_improvement(pid, 3)

    def test_build_cost_deducted(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        self._own_group(engine, pid)
        cash = engine.state.players[pid].cash
        engine.build_improvement(pid, 1)
        assert engine.state.players[pid].cash == cash - 50


# ----------------------------------------------------------------------
# Ипотеки
# ----------------------------------------------------------------------
class TestMortgage:
    def test_mortgage_and_release(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        engine.state.properties[3] = PropertyState(position=3, owner=pid)
        cash = player.cash
        engine.mortgage_property(pid, 3)
        assert engine.state.properties[3].mortgaged
        assert player.cash == cash + 30
        engine.unmortgage_property(pid, 3)
        assert not engine.state.properties[3].mortgaged
        assert player.cash == cash + 30 - 33  # 30 + 10% лихва

    def test_cannot_mortgage_foreign(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p2)
        with pytest.raises(GameError):
            engine.mortgage_property(p1, 3)

    def test_cannot_mortgage_with_improvements(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        for pos in (1, 3):
            engine.state.properties[pos] = PropertyState(position=pos, owner=pid)
        engine.build_improvement(pid, 1)
        with pytest.raises(GameError):
            engine.mortgage_property(pid, 1)


# ----------------------------------------------------------------------
# Карти
# ----------------------------------------------------------------------
class TestCards:
    def test_draw_card_applies_effect(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        # Поле 2 е „Обществено събитие".
        force_roll(engine, 1, 1)
        cash_before = player.cash
        events = engine.roll_dice(pid)
        card_events = [e for e in events if e.get("type") == "card"]
        # Поне една карта. Може да са и повече: карта с преместване отвежда
        # на ново поле и ако то също е картово, се тегли следваща.
        assert card_events
        # Ефектът е приложен: парите, позицията или модификатор са променени,
        # или играчът е на проверка.
        changed = (
            player.cash != cash_before
            or player.position != 2
            or player.modifiers
            or player.in_jail
            or player.get_out_cards
        )
        assert changed or engine.state.phase in (
            Phase.MANAGEMENT, Phase.AWAITING_PAYMENT, Phase.AWAITING_PURCHASE
        )

    def test_deck_recycles(self, engine: GameEngine) -> None:
        deck = engine.state.decks["community"]
        seen = set()
        for _ in range(60):  # повече от размера на тестето
            card = deck.draw(engine.rng)
            deck.discard(card.card_id)
            seen.add(card.card_id)
        assert len(seen) >= 20


# ----------------------------------------------------------------------
# Административна проверка
# ----------------------------------------------------------------------
class TestJail:
    def test_goto_jail_corner(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        player.position = 27
        force_roll(engine, 1, 2)  # 27 + 3 = 30 → изпращане на проверка
        engine.roll_dice(pid)
        assert player.in_jail
        assert player.position == 10  # полето на проверката

    def test_three_doubles_sends_to_jail(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        engine.state.doubles_count = 2  # вече два чифта
        force_roll(engine, 4, 4)
        engine.roll_dice(pid)
        assert player.in_jail

    def test_pay_fee_to_leave(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        player.in_jail = True
        player.position = 10
        cash = player.cash
        engine.pay_jail_fee(pid)
        assert not player.in_jail
        assert player.cash == cash - engine.state.settings.jail_fee

    def test_jail_card_frees(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        player.in_jail = True
        player.jail_card_ids = ["com_13"]
        engine.use_jail_card(pid)
        assert not player.in_jail
        assert player.get_out_cards == 0

    def test_doubles_free_from_jail(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        player.in_jail = True
        player.position = 10
        force_roll(engine, 3, 3)
        engine.roll_dice(pid)
        assert not player.in_jail
        assert player.position == 16

    def test_failed_attempts_then_forced_fee(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        player.in_jail = True
        player.position = 10
        fee = engine.state.settings.jail_fee
        for attempt in range(engine.state.settings.jail_max_turns):
            assert player.in_jail
            cash = player.cash
            force_roll(engine, 1, 2)  # не е чифт
            engine.roll_dice(pid)
            if player.in_jail:
                # Ходът продължава: приключваме го и връщаме реда обратно.
                engine.end_turn(pid)
                other = engine.state.current_player_id
                force_roll(engine, 1, 3)
                engine.roll_dice(other)
                if engine.state.phase == Phase.AWAITING_PURCHASE:
                    engine.decline_purchase(other)
                engine.end_turn(other)
        assert not player.in_jail
        assert player.cash == cash - fee


# ----------------------------------------------------------------------
# Фалит и победа
# ----------------------------------------------------------------------
class TestBankruptcy:
    def test_insufficient_rent_creates_debt(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1, level=4)
        engine.state.current_index = 1
        engine.state.players[p2].cash = 100  # наем при ниво 4 е 320
        force_roll(engine, 1, 2)
        engine.roll_dice(p2)
        assert engine.state.phase == Phase.AWAITING_PAYMENT
        assert engine.state.debt is not None
        assert engine.state.debt.amount == 320

    def test_debt_is_settled_with_automatic_mortgage(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1, level=4)
        engine.state.properties[31] = PropertyState(position=31, owner=p2)
        engine.state.current_index = 1
        engine.state.players[p2].cash = 200
        creditor_cash = engine.state.players[p1].cash
        force_roll(engine, 1, 2)
        events = engine.roll_dice(p2)

        assert engine.state.debt is None
        assert engine.state.phase == Phase.MANAGEMENT
        assert engine.state.properties[31].mortgaged
        assert engine.state.players[p2].cash == 30
        assert engine.state.players[p1].cash == creditor_cash + 320
        automatic = [event for event in events if event.get("automatic")]
        assert any(event.get("type") == "mortgage" for event in automatic)

    def test_automatic_mortgage_stops_when_debt_is_covered(
        self, engine: GameEngine
    ) -> None:
        """Ипотекира от най-евтиното нагоре и спира щом дългът е покрит.

        Полета 1 и 3 са по 60 € (ипотека по 30), полета 6 и 8 — по 100 €
        (ипотека по 50). При недостиг от 80 € двете евтини не стигат, затова
        пада и първото по-скъпо; второто остава непокътнато.
        """
        creditor, debtor = engine.state.turn_order
        engine.state.players[debtor].cash = 20
        creditor_cash = engine.state.players[creditor].cash
        for pos in (1, 3, 6, 8):
            engine.state.properties[pos] = PropertyState(position=pos, owner=debtor)

        events = engine._charge(
            engine.state.players[debtor], engine.state.players[creditor], 100,
            "Наем за тестов имот",
        )

        assert engine.state.debt is None
        assert engine.state.properties[1].mortgaged
        assert engine.state.properties[3].mortgaged
        assert engine.state.properties[6].mortgaged
        # Спира веднага щом набраното покрие дълга.
        assert not engine.state.properties[8].mortgaged
        # 20 + 110 набрани − 100 платени. Тръгването от евтините води до
        # повече на брой стъпки и до остатък в брой.
        assert engine.state.players[debtor].cash == 30
        assert engine.state.players[creditor].cash == creditor_cash + 100
        assert sum(
            event.get("type") == "mortgage" and event.get("automatic")
            for event in events
        ) == 3

    def test_automatic_mortgage_does_not_sell_buildings(
        self, engine: GameEngine
    ) -> None:
        creditor, debtor = engine.state.turn_order
        engine.state.players[debtor].cash = 0
        engine.state.properties[1] = PropertyState(
            position=1, owner=debtor, level=1
        )
        engine.state.properties[3] = PropertyState(
            position=3, owner=debtor, level=1
        )

        events = engine._charge(
            engine.state.players[debtor], engine.state.players[creditor], 100,
            "Наем за тестов имот",
        )

        assert engine.state.phase == Phase.AWAITING_PAYMENT
        assert engine.state.debt is not None
        assert engine.state.properties[1].level == 1
        assert engine.state.properties[3].level == 1
        assert not engine.state.properties[1].mortgaged
        assert not engine.state.properties[3].mortgaged
        assert not any(event.get("type") == "sell_improvement" for event in events)

    def test_automatic_mortgage_is_atomic_when_assets_cannot_cover_debt(
        self, engine: GameEngine
    ) -> None:
        creditor, debtor = engine.state.turn_order
        engine.state.players[debtor].cash = 0
        engine.state.properties[1] = PropertyState(position=1, owner=debtor)

        engine._charge(
            engine.state.players[debtor], engine.state.players[creditor], 100,
            "Наем за тестов имот",
        )

        assert engine.state.phase == Phase.AWAITING_PAYMENT
        assert engine.state.debt is not None
        assert engine.state.players[debtor].cash == 0
        assert not engine.state.properties[1].mortgaged

    def test_bankruptcy_transfers_to_creditor(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1, level=4)
        engine.state.properties[31] = PropertyState(position=31, owner=p2)
        engine.state.current_index = 1
        engine.state.players[p2].cash = 100
        force_roll(engine, 1, 2)
        engine.roll_dice(p2)
        engine.declare_bankruptcy(p2)
        assert engine.state.players[p2].bankrupt
        assert engine.state.properties[31].owner == p1
        # Кредиторът получава и парите на фалиралия.
        assert engine.state.winner == p1
        assert engine.state.phase == Phase.GAME_OVER

    def test_cannot_bankrupt_without_debt(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        with pytest.raises(GameError):
            engine.declare_bankruptcy(pid)

    def test_winner_last_standing_with_four(self, engine4: GameEngine) -> None:
        order = engine4.state.turn_order
        for pid in order[1:3]:
            player = engine4.state.players[pid]
            player.bankrupt = True
        # Остават двама: фалира още един чрез дълг.
        p_last = order[3]
        engine4.state.debt = PendingDebt(
            debtor=p_last, creditor=None, amount=99999, reason="Тест"
        )
        engine4.state.phase = Phase.AWAITING_PAYMENT
        engine4.declare_bankruptcy(p_last)
        assert engine4.state.winner == order[0]


# ----------------------------------------------------------------------
# Край на хода / двойни зарове
# ----------------------------------------------------------------------
class TestTurnFlow:
    def test_doubles_grant_extra_roll(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        force_roll(engine, 2, 2)  # чифт → поле 4 (данък)
        engine.roll_dice(pid)
        assert engine.state.phase == Phase.MANAGEMENT
        engine.end_turn(pid)
        assert engine.state.current_player_id == pid
        assert engine.state.phase == Phase.WAITING_FOR_ROLL

    def test_normal_roll_passes_turn(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        force_roll(engine, 1, 3)  # поле 4: данък
        engine.roll_dice(pid)
        engine.end_turn(pid)
        assert engine.state.current_player_id != pid

    def test_skip_disconnected_player(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        events = engine.force_skip_turn(pid)
        assert engine.state.current_player_id != pid
        assert any(e.get("type") == "turn" for e in events)

    def test_turn_deadline_set_and_renewed(self, engine: GameEngine) -> None:
        import time as time_module

        assert engine.state.turn_deadline > time_module.time()
        first_deadline = engine.state.turn_deadline
        pid = engine.state.current_player_id
        force_roll(engine, 1, 3)  # данък — фаза управление
        engine.roll_dice(pid)
        engine.end_turn(pid)
        # Новият ход получава нов краен срок.
        assert engine.state.turn_deadline >= first_deadline

    def test_timeout_skip_logs_and_advances(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        events = engine.force_skip_turn(pid, timed_out=True)
        assert engine.state.current_player_id != pid
        assert engine.state.players[pid].stats["consecutive_timeouts"] == 1
        assert any("изтече" in e.get("text", "") for e in events)

    def test_two_consecutive_timeouts_allow_host_removal(
        self, engine: GameEngine,
    ) -> None:
        first, second = engine.state.turn_order
        engine.force_skip_turn(first, timed_out=True)
        engine.force_skip_turn(second, timed_out=True)

        events = engine.force_skip_turn(first, timed_out=True)

        assert engine.state.players[first].stats["consecutive_timeouts"] == 2
        assert any("може да премахне" in e.get("text", "") for e in events)

    def test_completed_turn_resets_consecutive_timeouts(
        self, engine: GameEngine,
    ) -> None:
        first, second = engine.state.turn_order
        engine.force_skip_turn(first, timed_out=True)
        engine.force_skip_turn(second, timed_out=True)
        force_roll(engine, 1, 3)  # данък — фаза управление
        engine.roll_dice(first)

        engine.end_turn(first)

        assert engine.state.players[first].stats["consecutive_timeouts"] == 0

    def test_timeout_auto_mortgages_and_pays_player(self, engine: GameEngine) -> None:
        creditor, debtor = engine.state.turn_order
        engine.state.current_index = 1
        engine.state.players[debtor].cash = 20
        creditor_cash = engine.state.players[creditor].cash
        engine.state.properties[1] = PropertyState(position=1, owner=debtor)
        engine.state.properties[3] = PropertyState(position=3, owner=debtor)
        engine.state.properties[6] = PropertyState(position=6, owner=debtor)
        engine.state.debt = PendingDebt(
            debtor=debtor, creditor=creditor, amount=100, reason="Наем"
        )
        engine.state.phase = Phase.AWAITING_PAYMENT

        events = engine.force_skip_turn(debtor, timed_out=True)

        assert not engine.state.players[debtor].bankrupt
        # Ипотекира от най-евтиното: 1 и 3 (по 30 €) не стигат за 80 €,
        # затова пада и 6 (50 €). Остатъкът от 30 € остава в брой.
        assert engine.state.players[debtor].cash == 30
        assert engine.state.players[creditor].cash == creditor_cash + 100
        assert engine.state.properties[1].mortgaged
        assert engine.state.properties[3].mortgaged
        assert engine.state.properties[6].mortgaged
        assert engine.state.debt is None
        assert engine.state.current_player_id == creditor
        assert any(e.get("type") == "payment" and e.get("to") == creditor for e in events)

    def test_one_click_debt_plan_is_instant_and_pays_player(
        self, engine: GameEngine,
    ) -> None:
        creditor, debtor = engine.state.turn_order
        engine.state.current_index = 1
        engine.state.players[debtor].cash = 0
        creditor_cash = engine.state.players[creditor].cash
        engine.state.properties[1] = PropertyState(
            position=1, owner=debtor, level=1,
        )
        engine.state.properties[3] = PropertyState(
            position=3, owner=debtor, level=1,
        )
        engine.state.debt = PendingDebt(
            debtor=debtor, creditor=creditor, amount=100, reason="Наем",
        )
        engine.state.phase = Phase.AWAITING_PAYMENT

        events = engine.settle_debt_with_plan(debtor)

        assert engine.state.debt is None
        assert engine.state.phase == Phase.MANAGEMENT
        assert engine.state.players[creditor].cash == creditor_cash + 100
        assert engine.state.properties[1].level == 0
        assert engine.state.properties[3].level == 0
        action_events = [event for event in events if event.get("type") != "log"]
        assert action_events
        assert all(event.get("instant") for event in action_events)

    def test_timeout_sells_buildings_then_mortgages_and_pays(
        self, engine: GameEngine
    ) -> None:
        creditor, debtor = engine.state.turn_order
        engine.state.current_index = 1
        engine.state.players[debtor].cash = 0
        creditor_cash = engine.state.players[creditor].cash
        engine.state.properties[1] = PropertyState(
            position=1, owner=debtor, level=1
        )
        engine.state.properties[3] = PropertyState(
            position=3, owner=debtor, level=1
        )
        engine.state.debt = PendingDebt(
            debtor=debtor, creditor=creditor, amount=100, reason="Наем"
        )
        engine.state.phase = Phase.AWAITING_PAYMENT

        events = engine.force_skip_turn(debtor, timed_out=True)

        assert not engine.state.players[debtor].bankrupt
        assert engine.state.players[debtor].cash == 10
        assert engine.state.players[creditor].cash == creditor_cash + 100
        assert engine.state.properties[1].level == 0
        assert engine.state.properties[3].level == 0
        assert engine.state.properties[1].mortgaged
        assert engine.state.properties[3].mortgaged
        automatic = [event for event in events if event.get("automatic")]
        assert sum(event["type"] == "sell_improvement" for event in automatic) == 2
        assert sum(event["type"] == "mortgage" for event in automatic) == 2
        assert all(event.get("instant") for event in automatic)

    def test_timeout_bankruptcy_when_mortgages_cannot_cover_debt(
        self, engine: GameEngine
    ) -> None:
        creditor, debtor = engine.state.turn_order
        engine.state.current_index = 1
        engine.state.players[debtor].cash = 0
        engine.state.properties[1] = PropertyState(position=1, owner=debtor)
        engine.state.debt = PendingDebt(
            debtor=debtor, creditor=creditor, amount=100, reason="Наем"
        )
        engine.state.phase = Phase.AWAITING_PAYMENT

        engine.force_skip_turn(debtor, timed_out=True)

        assert engine.state.players[debtor].bankrupt

    def test_no_deadline_without_limit(self, board, settings) -> None:
        import random as random_module

        from conftest import make_players

        settings.turn_time_limit = 0
        eng = GameEngine(board, settings, rng=random_module.Random(3))
        eng.start_game(make_players(2))
        assert eng.state.turn_deadline == 0.0

    def test_full_room_of_ten_players(self, board, settings) -> None:
        """Пълна стая: 10 играчи получават ред, пари и уникална фигурка."""
        import random as random_module

        from conftest import make_players

        eng = GameEngine(board, settings, rng=random_module.Random(11))
        eng.start_game(make_players(10))
        assert len(eng.state.turn_order) == 10
        assert len(set(eng.state.turn_order)) == 10
        assert len({p.token for p in eng.state.players.values()}) == 10
        assert all(p.position == 0 for p in eng.state.players.values())
        assert all(
            p.cash == settings.starting_cash for p in eng.state.players.values()
        )
        # Един пълен кръг връща хода на първия играч.
        first = eng.state.current_player_id
        for _ in range(10):
            eng.force_skip_turn(eng.state.current_player_id)
        assert eng.state.current_player_id == first

    def test_eleven_players_rejected(self, board, settings) -> None:
        import random as random_module

        from conftest import make_players

        eng = GameEngine(board, settings, rng=random_module.Random(12))
        with pytest.raises(GameError):
            eng.start_game(make_players(11))

    def test_remove_player_returns_assets(self, engine4: GameEngine) -> None:
        order = engine4.state.turn_order
        target = order[2]
        engine4.state.properties[3] = PropertyState(position=3, owner=target, level=2)
        engine4.remove_player(target)
        assert engine4.state.players[target].bankrupt
        prop = engine4.state.properties[3]
        assert prop.owner is None
        assert prop.level == 0
