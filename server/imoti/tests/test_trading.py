"""Тестове на търговската система: оферти, контраоферти, атомарност."""
from __future__ import annotations

import pytest

from app.game.engine import GameEngine, GameError
from app.game.properties import PropertyState
from app.game.state import Phase


def _trade_events_id(events: list[dict]) -> str:
    for event in events:
        if event.get("type") == "trade_offer":
            return event["trade"]["trade_id"]
    raise AssertionError("Няма събитие trade_offer")


class TestTradeCreation:
    def test_create_valid_trade(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)
        events = engine.create_trade(
            p1, p2, offer_properties=[3], request_cash=200
        )
        trade_id = _trade_events_id(events)
        assert engine.state.trades[trade_id].status == "pending"

    def test_empty_trade_rejected(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        with pytest.raises(GameError):
            engine.create_trade(p1, p2)

    def test_cannot_offer_foreign_property(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p2)
        with pytest.raises(GameError):
            engine.create_trade(p1, p2, offer_properties=[3])

    def test_cannot_offer_more_cash_than_owned(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        with pytest.raises(GameError):
            engine.create_trade(p1, p2, offer_cash=99999)

    def test_cannot_sell_property_below_own_value(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)

        with pytest.raises(GameError, match="под собствената им стойност"):
            engine.create_trade(
                p1, p2, offer_properties=[3], request_cash=59
            )

    def test_can_sell_property_at_own_value(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)

        events = engine.create_trade(
            p1, p2, offer_properties=[3], request_cash=60
        )

        assert engine.state.trades[_trade_events_id(events)].status == "pending"

    def test_mortgaged_property_uses_displayed_trade_value(
        self, engine: GameEngine,
    ) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(
            position=3, owner=p1, mortgaged=True,
        )

        with pytest.raises(GameError, match="под собствената им стойност"):
            engine.create_trade(
                p1, p2, offer_properties=[3], request_cash=32
            )
        events = engine.create_trade(
            p1, p2, offer_properties=[3], request_cash=33
        )
        assert engine.state.trades[_trade_events_id(events)].status == "pending"

    def test_cannot_trade_improved_property(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1, level=2)
        with pytest.raises(GameError):
            engine.create_trade(p1, p2, offer_properties=[3])

    def test_trade_disabled_setting(self, engine: GameEngine) -> None:
        engine.state.settings.trading_enabled = False
        p1, p2 = engine.state.turn_order
        with pytest.raises(GameError):
            engine.create_trade(p1, p2, offer_cash=10)

    def test_no_trade_during_purchase(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        from conftest import force_roll

        force_roll(engine, 1, 2)
        engine.roll_dice(p1)
        assert engine.state.phase == Phase.AWAITING_PURCHASE
        with pytest.raises(GameError):
            engine.create_trade(p1, p2, offer_cash=10)


class TestTradePremium:
    """Надценка: допустима над стойността, но с таван и данък."""

    def test_can_sweeten_property_swap_with_cash(self, engine: GameEngine) -> None:
        # Ядрото на правилото: собствената парична добавка не бива да се
        # брои срещу подателя, иначе размяната имот↔имот изисква равенство.
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)   # 60 €
        engine.state.properties[6] = PropertyState(position=6, owner=p2)   # 100 €

        events = engine.create_trade(
            p1, p2, offer_properties=[3], offer_cash=140, request_properties=[6],
        )
        assert engine.state.trades[_trade_events_id(events)].status == "pending"

    def test_swap_below_property_value_still_blocked(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)   # 60 €
        engine.state.properties[6] = PropertyState(position=6, owner=p2)   # 100 €

        with pytest.raises(GameError, match="под собствената им стойност"):
            engine.create_trade(p1, p2, offer_properties=[3], request_properties=[6])

    def test_excessive_premium_rejected(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)   # 60 €

        # 60 € имот, таван на надценката = max(150, 60 * 200%) = 150 €.
        with pytest.raises(GameError, match="прикрит подарък"):
            engine.create_trade(p1, p2, offer_properties=[3], request_cash=400)

    def test_cash_gift_rejected(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        with pytest.raises(GameError, match="прикрит подарък"):
            engine.create_trade(p1, p2, offer_cash=1000)

    def test_small_favour_still_allowed(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        events = engine.create_trade(p1, p2, offer_cash=150)
        assert engine.state.trades[_trade_events_id(events)].status == "pending"

    def test_premium_tax_goes_to_bank(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)   # 60 €
        cash2 = engine.state.players[p2].cash

        events = engine.create_trade(p1, p2, offer_properties=[3], request_cash=160)
        engine.respond_trade(p2, _trade_events_id(events), accept=True)

        # Надценка 100 € → данък 30 €.
        assert engine.state.players[p2].cash == cash2 - 160 - 30
        assert engine.state.players[p2].stats["bank_paid"] >= 30

    def test_equal_trade_pays_no_tax(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)   # 60 €
        cash2 = engine.state.players[p2].cash

        events = engine.create_trade(p1, p2, offer_properties=[3], request_cash=60)
        engine.respond_trade(p2, _trade_events_id(events), accept=True)

        assert engine.state.players[p2].cash == cash2 - 60


class TestTradeExecution:
    def test_accept_executes_atomically(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)
        cash1 = engine.state.players[p1].cash
        cash2 = engine.state.players[p2].cash
        events = engine.create_trade(p1, p2, offer_properties=[3], request_cash=200)
        trade_id = _trade_events_id(events)
        engine.respond_trade(p2, trade_id, accept=True)
        assert engine.state.properties[3].owner == p2
        assert engine.state.players[p1].cash == cash1 + 200
        # Имотът струва 60 €, платени са 200 € → надценка 140 €,
        # върху която купувачът плаща 30% данък към банката.
        assert engine.state.players[p2].cash == cash2 - 200 - 42

    def test_decline_leaves_state(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)
        events = engine.create_trade(p1, p2, offer_properties=[3], request_cash=200)
        trade_id = _trade_events_id(events)
        engine.respond_trade(p2, trade_id, accept=False)
        assert engine.state.properties[3].owner == p1
        assert engine.state.trades[trade_id].status == "declined"

    def test_stale_trade_fails_if_assets_gone(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)
        events = engine.create_trade(p1, p2, offer_properties=[3], request_cash=100)
        trade_id = _trade_events_id(events)
        # Междувременно имотът сменя собственика си.
        engine.state.properties[3].owner = p2
        with pytest.raises(GameError):
            engine.respond_trade(p2, trade_id, accept=True)
        # Никакви пари не са разменени.
        assert engine.state.trades[trade_id].status == "cancelled"

    def test_only_target_can_respond(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        events = engine.create_trade(p1, p2, offer_cash=50)
        trade_id = _trade_events_id(events)
        with pytest.raises(GameError):
            engine.respond_trade(p1, trade_id, accept=True)

    def test_mortgaged_property_transfers(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1, mortgaged=True)
        events = engine.create_trade(p1, p2, offer_properties=[3], request_cash=50)
        trade_id = _trade_events_id(events)
        engine.respond_trade(p2, trade_id, accept=True)
        prop = engine.state.properties[3]
        assert prop.owner == p2
        assert prop.mortgaged  # ипотеката се запазва

    def test_jail_cards_trade(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.players[p1].jail_card_ids = ["com_13", "biz_12"]
        events = engine.create_trade(p1, p2, offer_jail_cards=1, request_cash=30)
        trade_id = _trade_events_id(events)
        engine.respond_trade(p2, trade_id, accept=True)
        assert engine.state.players[p1].get_out_cards == 1
        assert engine.state.players[p2].get_out_cards == 1


class TestCounterOffers:
    def test_counter_marks_original(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        events = engine.create_trade(p1, p2, offer_cash=50)
        original_id = _trade_events_id(events)
        counter_events = engine.create_trade(
            p2, p1, offer_cash=20, request_cash=10, counter_of=original_id
        )
        counter_id = _trade_events_id(counter_events)
        assert engine.state.trades[original_id].status == "countered"
        assert engine.state.trades[counter_id].status == "pending"
        assert engine.state.trades[counter_id].counter_of == original_id

    def test_accept_counter(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        events = engine.create_trade(p1, p2, offer_cash=50)
        original_id = _trade_events_id(events)
        counter_events = engine.create_trade(
            p2, p1, offer_cash=0, request_cash=80, counter_of=original_id
        )
        counter_id = _trade_events_id(counter_events)
        cash2 = engine.state.players[p2].cash
        engine.respond_trade(p1, counter_id, accept=True)
        assert engine.state.players[p2].cash == cash2 + 80

    def test_cancel_own_trade(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        events = engine.create_trade(p1, p2, offer_cash=50)
        trade_id = _trade_events_id(events)
        engine.cancel_trade(p1, trade_id)
        assert engine.state.trades[trade_id].status == "cancelled"
        with pytest.raises(GameError):
            engine.respond_trade(p2, trade_id, accept=True)

    def test_cannot_cancel_foreign_trade(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        events = engine.create_trade(p1, p2, offer_cash=50)
        trade_id = _trade_events_id(events)
        with pytest.raises(GameError):
            engine.cancel_trade(p2, trade_id)
