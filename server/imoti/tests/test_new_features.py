"""Тестове на новите функции: групово строене, реванш, статистика."""
from __future__ import annotations

import random

import pytest

from app.game.engine import GameEngine, GameError
from app.game.properties import PropertyState
from app.game.rules import GameSettings
from app.game.state import Phase

from conftest import force_roll, make_players


def _own_group(engine: GameEngine, pid: str, positions=(1, 3)) -> None:
    for pos in positions:
        engine.state.properties[pos] = PropertyState(position=pos, owner=pid)


# ----------------------------------------------------------------------
# Групово строене
# ----------------------------------------------------------------------
class TestBuildGroup:
    def test_build_group_raises_all_by_one(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 5000
        _own_group(engine, pid)  # група star_centar: полета 1 и 3
        events = engine.build_group(pid, "star_centar")
        assert engine.state.properties[1].level == 1
        assert engine.state.properties[3].level == 1
        animated = [
            event for event in events if event.get("type") in {"build", "payment"}
        ]
        assert animated
        assert all(event.get("fast") for event in animated)
        assert all(event.get("group_build") for event in animated)

    def test_build_group_twice(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 5000
        _own_group(engine, pid)
        engine.build_group(pid, "star_centar")
        engine.build_group(pid, "star_centar")
        assert engine.state.properties[1].level == 2
        assert engine.state.properties[3].level == 2

    def test_build_group_requires_full_group(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 5000
        engine.state.properties[1] = PropertyState(position=1, owner=pid)
        with pytest.raises(GameError):
            engine.build_group(pid, "star_centar")

    def test_build_group_partial_when_low_cash(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        _own_group(engine, pid)
        # Достатъчно само за едно подобрение (цена 50 на ниво).
        engine.state.players[pid].cash = 60
        engine.build_group(pid, "star_centar")
        levels = sorted([engine.state.properties[1].level, engine.state.properties[3].level])
        assert levels == [0, 1]  # едното е построено, другото не

    def test_build_group_starts_from_the_dearest(self, engine: GameEngine) -> None:
        """При недостиг къщите остават на скъпите територии.

        Групата „Крайречен“: Чифлик 100 €, Рибарица 100 €, Девин 120 €.
        Парите стигат за две къщи по 50 € — без къща трябва да остане
        най-евтината, а не последната по ред на таблото.
        """
        pid = engine.state.current_player_id
        _own_group(engine, pid, positions=(6, 8, 9))
        engine.state.players[pid].cash = 110
        engine.build_group(pid, "krairechen")

        assert engine.state.properties[9].level == 1   # Девин, 120 €
        assert engine.state.properties[8].level == 1   # Рибарица
        assert engine.state.properties[6].level == 0   # Чифлик остава без

    def test_build_group_keeps_the_even_rule(self, engine: GameEngine) -> None:
        """Скъпото първо не бива да води до две къщи там и нула другаде."""
        pid = engine.state.current_player_id
        _own_group(engine, pid, positions=(6, 8, 9))
        engine.state.players[pid].cash = 5000
        engine.build_group(pid, "krairechen")
        engine.build_group(pid, "krairechen")

        levels = [engine.state.properties[pos].level for pos in (6, 8, 9)]
        assert levels == [2, 2, 2]


# ----------------------------------------------------------------------
# Групова продажба на подобрения
# ----------------------------------------------------------------------
class TestSellGroup:
    def test_sell_group_lowers_all_by_one(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 5000
        _own_group(engine, pid)
        engine.build_group(pid, "star_centar")
        engine.build_group(pid, "star_centar")  # и двата на ниво 2
        assert engine.state.properties[1].level == 2
        cash_before = engine.state.players[pid].cash
        engine.sell_group(pid, "star_centar")
        assert engine.state.properties[1].level == 1
        assert engine.state.properties[3].level == 1
        assert engine.state.players[pid].cash > cash_before  # върнати пари

    def test_sell_group_down_to_zero(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 5000
        _own_group(engine, pid)
        engine.build_group(pid, "star_centar")  # ниво 1
        engine.sell_group(pid, "star_centar")
        assert engine.state.properties[1].level == 0
        assert engine.state.properties[3].level == 0

    def test_sell_group_without_buildings_fails(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        _own_group(engine, pid)
        with pytest.raises(GameError):
            engine.sell_group(pid, "star_centar")

    def test_sell_group_not_owned_fails(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        with pytest.raises(GameError):
            engine.sell_group(pid, "star_centar")


# ----------------------------------------------------------------------
# Статистика
# ----------------------------------------------------------------------
class TestStatistics:
    def test_dice_stats_tracked(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        force_roll(engine, 3, 3)  # чифт
        engine.roll_dice(pid)
        stats = engine.state.players[pid].stats
        assert stats["dice_rolls"] == 1
        assert stats["dice_pips"] == 6
        assert stats["doubles"] == 1

    def test_laps_tracked(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].position = 38
        force_roll(engine, 2, 3)  # преминава Старт
        engine.roll_dice(pid)
        assert engine.state.players[pid].stats["laps"] == 1

    def test_property_income_tracked(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)
        engine.state.current_index = 1
        force_roll(engine, 1, 2)  # p2 стъпва на поле 3
        engine.roll_dice(p2)
        assert engine.state.property_income.get(3, 0) > 0

    def test_rent_stats(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)
        engine.state.current_index = 1
        force_roll(engine, 1, 2)
        engine.roll_dice(p2)
        assert engine.state.players[p1].stats["rent_collected"] > 0
        assert engine.state.players[p2].stats["rent_paid"] > 0


# ----------------------------------------------------------------------
# Реванш (през room manager)
# ----------------------------------------------------------------------
class TestRematch:
    def _manager(self, board):
        from app.room_manager import RoomManager
        return RoomManager(board)

    def test_rematch_restarts_with_same_players(self, board) -> None:
        mgr = self._manager(board)
        room, host, _ = mgr.create_room("Иван", "red")
        _, guest, _ = mgr.join_room(room.code, "Мария", "blue")
        mgr.set_ready(room, guest, True)
        mgr.start_game(room, host)
        # Симулираме напреднала игра.
        first_engine = room.engine
        first_engine.state.players[host.player_id].cash = 999
        first_engine.state.winner = host.player_id
        mgr.rematch(room, host)
        assert room.engine is not first_engine
        assert set(room.engine.state.players) == {host.player_id, guest.player_id}
        # Свежа начална сума за всички.
        cash = room.game_settings.starting_cash
        assert all(p.cash == cash for p in room.engine.state.players.values())

    def test_rematch_host_only(self, board) -> None:
        mgr = self._manager(board)
        room, host, _ = mgr.create_room("Иван", "red")
        _, guest, _ = mgr.join_room(room.code, "Мария", "blue")
        mgr.set_ready(room, guest, True)
        mgr.start_game(room, host)
        from app.room_manager import RoomError
        with pytest.raises(RoomError):
            mgr.rematch(room, guest)


# ----------------------------------------------------------------------
# Сериализация с новите полета
# ----------------------------------------------------------------------
def test_property_income_survives_serialization(board) -> None:
    from app.game.serialization import state_from_dict, state_to_dict

    settings = GameSettings()
    eng = GameEngine(board, settings, rng=random.Random(5))
    eng.start_game(make_players(2))
    eng.state.property_income[7] = 250
    restored = state_from_dict(state_to_dict(eng.state))
    assert restored.property_income[7] == 250


# ----------------------------------------------------------------------
# Търг на собствен имот (печалбата отива при продавача)
# ----------------------------------------------------------------------
class TestOwnerAuction:
    def test_auction_starts_at_property_value(self, engine: GameEngine) -> None:
        p1, _ = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)
        engine.auction_own_property(p1, 3)
        price = engine.board.space(3).price
        # Началната цена е стойността на имота.
        assert engine.state.auction.minimum_bid == price
        # Оферта под стойността се отхвърля.
        other = engine.state.turn_order[1]
        with pytest.raises(GameError):
            engine.place_bid(other, price - 1)

    def test_seller_receives_the_money(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order  # p1 е на ход
        engine.state.properties[3] = PropertyState(position=3, owner=p1)
        engine.auction_own_property(p1, 3)
        assert engine.state.phase == Phase.AWAITING_AUCTION
        assert engine.state.auction.seller == p1
        assert p1 not in engine.state.auction.participants
        assert p2 in engine.state.auction.participants
        bid = engine.board.space(3).price  # старт от стойността
        p1_cash, p2_cash = engine.state.players[p1].cash, engine.state.players[p2].cash
        engine.place_bid(p2, bid)
        engine.finish_auction()
        # Собствеността минава към наддалия, а парите — при продавача (не в банката).
        assert engine.state.properties[3].owner == p2
        assert engine.state.players[p2].cash == p2_cash - bid
        assert engine.state.players[p1].cash == p1_cash + bid

    def test_no_bids_property_stays_with_seller(self, engine: GameEngine) -> None:
        p1, _ = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)
        engine.auction_own_property(p1, 3)
        engine.finish_auction()
        assert engine.state.properties[3].owner == p1

    def test_all_bidders_withdraw_property_stays_with_seller(self, board) -> None:
        # При 3+ играчи отказите не бива да принуждават последния да купи —
        # доброволният търг от собственик просто приключва без продажба.
        settings = GameSettings(auctions_enabled=True)
        eng = GameEngine(board, settings, rng=random.Random(1))
        eng.start_game(make_players(3))
        seller = eng.state.turn_order[0]
        eng.state.properties[3] = PropertyState(position=3, owner=seller)
        eng.auction_own_property(seller, 3)
        bidders = list(eng.state.auction.participants)
        assert seller not in bidders and len(bidders) == 2
        cash_before = {p: eng.state.players[p].cash for p in eng.state.turn_order}
        eng.withdraw_auction(bidders[0])
        if eng.state.auction is not None:
            eng.withdraw_auction(bidders[1])
        # Имотът остава при продавача и никой не е платил.
        assert eng.state.properties[3].owner == seller
        assert eng.state.auction is None
        for pid in eng.state.turn_order:
            assert eng.state.players[pid].cash == cash_before[pid]

    def test_cannot_auction_foreign_property(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p2)
        with pytest.raises(GameError):
            engine.auction_own_property(p1, 3)

    def test_cannot_auction_mortgaged(self, engine: GameEngine) -> None:
        p1, _ = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1, mortgaged=True)
        with pytest.raises(GameError):
            engine.auction_own_property(p1, 3)

    def test_cannot_auction_with_group_buildings(self, engine: GameEngine) -> None:
        p1, _ = engine.state.turn_order
        for pos in (1, 3):
            engine.state.properties[pos] = PropertyState(position=pos, owner=p1)
        engine.state.players[p1].cash = 5000
        engine.build_improvement(p1, 1)  # постройка в групата
        with pytest.raises(GameError):
            engine.auction_own_property(p1, 3)

    def test_owner_auction_survives_serialization(self, engine: GameEngine) -> None:
        from app.game.serialization import state_from_dict, state_to_dict

        p1, _ = engine.state.turn_order
        engine.state.properties[3] = PropertyState(position=3, owner=p1)
        engine.auction_own_property(p1, 3)
        restored = state_from_dict(state_to_dict(engine.state))
        assert restored.auction is not None
        assert restored.auction.seller == p1


# ----------------------------------------------------------------------
# Класация в края: последният фалирал стои най-горе след победителя
# ----------------------------------------------------------------------
class TestFinalRanking:
    def _report(self, eng: GameEngine):
        from app.game.serialization import state_to_client
        return state_to_client(eng.state, eng.board)["final_report"]

    def test_bankruptcy_order_is_recorded(self, board) -> None:
        settings = GameSettings()
        eng = GameEngine(board, settings, rng=random.Random(3))
        eng.start_game(make_players(3))
        first, second, _ = eng.state.turn_order
        eng.remove_player(first)
        eng.remove_player(second)
        assert eng.state.bankruptcy_order == [first, second]

    def test_last_bankrupt_ranks_above_first(self, board) -> None:
        settings = GameSettings()
        eng = GameEngine(board, settings, rng=random.Random(3))
        eng.start_game(make_players(4))
        p1, p2, p3, p4 = eng.state.turn_order
        # p1 отпада пръв, после p2, после p3 — p4 печели.
        # На първия дават най-много пари: богатството не бива да мести реда.
        eng.state.players[p1].cash = 9999
        eng.remove_player(p1)
        eng.remove_player(p2)
        eng.remove_player(p3)
        assert eng.state.winner == p4
        rows = [row["player_id"] for row in self._report(eng)]
        # Победител, после последният фалирал, надолу до първия фалирал.
        assert rows == [p4, p3, p2, p1]

    def test_declare_bankruptcy_also_records_order(self, board) -> None:
        # Обичайният път е фалит от непосилен дълг, а не напускане —
        # редът трябва да се запише и през него.
        from app.game.state import PendingDebt, Phase

        settings = GameSettings()
        eng = GameEngine(board, settings, rng=random.Random(7))
        eng.start_game(make_players(3))
        loser, creditor, _ = eng.state.turn_order
        eng.state.players[loser].cash = 0
        eng.state.phase = Phase.AWAITING_PAYMENT
        eng.state.debt = PendingDebt(
            debtor=loser, creditor=creditor, amount=500, reason="Тест",
        )
        eng.declare_bankruptcy(loser)
        assert eng.state.players[loser].bankrupt
        assert eng.state.bankruptcy_order == [loser]

    def test_order_survives_serialization(self, board) -> None:
        from app.game.serialization import state_from_dict, state_to_dict

        settings = GameSettings()
        eng = GameEngine(board, settings, rng=random.Random(3))
        eng.start_game(make_players(3))
        first = eng.state.turn_order[0]
        eng.remove_player(first)
        restored = state_from_dict(state_to_dict(eng.state))
        assert restored.bankruptcy_order == [first]

    def test_legacy_save_without_order_still_loads(self, board) -> None:
        from app.game.serialization import state_from_dict, state_to_dict

        settings = GameSettings()
        eng = GameEngine(board, settings, rng=random.Random(3))
        eng.start_game(make_players(2))
        data = state_to_dict(eng.state)
        del data["bankruptcy_order"]
        restored = state_from_dict(data)
        assert restored.bankruptcy_order == []
