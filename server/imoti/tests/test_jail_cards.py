"""Идентичност на картите „освобождаване от административна проверка".

В играта има точно две такива карти (``com_13`` и ``biz_12``) и всяка от тях
съществува в едно копие. Докато играчът пазеше само брой, използването на
едната връщаше в тестето произволната „липсваща" карта — включително тази,
която друг играч още държи в ръката си. Тогава тя можеше да бъде изтеглена
отново и в обращение да се появи трето копие.
"""
from __future__ import annotations

import random

import pytest

from app.game.board import Board
from app.game.cards import JAIL_FREE_CARD_IDS, deck_of, jail_card_mode
from app.game.engine import GameEngine
from app.game.player import Player
from app.game.rules import GameSettings
from app.game.serialization import state_from_dict, state_to_dict
from app.game.state import PendingDebt, Phase

from conftest import make_players


def _copies_in_play(engine: GameEngine, card_id: str) -> int:
    """Колко копия на картата съществуват — в ръце и в тестетата."""
    total = sum(
        player.jail_card_ids.count(card_id)
        for player in engine.state.players.values()
    )
    for deck in engine.state.decks.values():
        total += deck.draw_pile.count(card_id)
        total += deck.discard_pile.count(card_id)
    return total


class TestJailCardIdentity:
    def test_exactly_two_jail_cards_defined(self) -> None:
        assert set(JAIL_FREE_CARD_IDS) == {"com_13", "biz_12"}

    def test_use_returns_the_played_card_to_its_own_deck(
        self, engine: GameEngine,
    ) -> None:
        """Връща се изиграната карта, а не някоя друга."""
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        player.in_jail = True
        player.jail_card_ids = ["com_13"]
        # Двете карти са извън тестетата: едната е в ръката, другата да не е.
        for deck in engine.state.decks.values():
            deck.draw_pile = [c for c in deck.draw_pile if c not in JAIL_FREE_CARD_IDS]
            deck.discard_pile = [
                c for c in deck.discard_pile if c not in JAIL_FREE_CARD_IDS
            ]

        engine.use_jail_card(pid)

        community = engine.state.decks[deck_of("com_13")]
        assert "com_13" in community.discard_pile
        assert _copies_in_play(engine, "biz_12") == 0
        assert _copies_in_play(engine, "com_13") == 1

    def test_other_players_card_is_not_returned(self, engine: GameEngine) -> None:
        """Ядрото на бъга: чуждата карта не бива да се връща в тестето."""
        p1, p2 = engine.state.turn_order
        first, second = engine.state.players[p1], engine.state.players[p2]
        first.jail_card_ids = ["com_13"]
        second.jail_card_ids = ["biz_12"]
        for deck in engine.state.decks.values():
            deck.draw_pile = [c for c in deck.draw_pile if c not in JAIL_FREE_CARD_IDS]
            deck.discard_pile = [
                c for c in deck.discard_pile if c not in JAIL_FREE_CARD_IDS
            ]
        first.in_jail = True

        engine.use_jail_card(p1)

        # Картата на втория играч остава само в неговата ръка.
        assert second.jail_card_ids == ["biz_12"]
        assert _copies_in_play(engine, "com_13") == 1
        assert _copies_in_play(engine, "biz_12") == 1

    def test_get_out_cards_is_read_only(self, engine: GameEngine) -> None:
        player = engine.state.players[engine.state.turn_order[0]]
        with pytest.raises(AttributeError):
            player.get_out_cards = 3  # type: ignore[misc]

    def test_count_mirrors_the_list(self, engine: GameEngine) -> None:
        player = engine.state.players[engine.state.turn_order[0]]
        assert player.get_out_cards == 0
        player.jail_card_ids.append("com_13")
        assert player.get_out_cards == 1


def _force_bankruptcy(engine: GameEngine, debtor_id: str, creditor_id: str | None) -> None:
    """Поставя неплатим дълг и обявява фалит по нормалния път."""
    debtor = engine.state.players[debtor_id]
    debtor.cash = 0
    engine.state.phase = Phase.AWAITING_PAYMENT
    engine.state.debt = PendingDebt(
        debtor=debtor_id, creditor=creditor_id, amount=99999, reason="тест",
    )
    engine.declare_bankruptcy(debtor_id)


class TestJailCardModes:
    """Чиновническата карта се играе по избор, адвокатската — сама."""

    def test_modes_are_distinct(self) -> None:
        assert jail_card_mode("com_13") == "release"
        assert jail_card_mode("biz_12") == "shield"

    def test_shield_cancels_the_check_and_keeps_position(
        self, engine: GameEngine,
    ) -> None:
        pid = engine.state.turn_order[0]
        player = engine.state.players[pid]
        player.jail_card_ids = ["biz_12"]
        player.position = 17

        events = engine._send_to_jail(player)

        assert not player.in_jail
        assert player.position == 17
        assert player.jail_card_ids == []
        assert any(e.get("type") == "jail_shield" for e in events)
        assert _copies_in_play(engine, "biz_12") == 1

    def test_release_card_does_not_shield(self, engine: GameEngine) -> None:
        """Чиновническата карта не пази предварително — играчът влиза вътре."""
        pid = engine.state.turn_order[0]
        player = engine.state.players[pid]
        player.jail_card_ids = ["com_13"]

        engine._send_to_jail(player)

        assert player.in_jail
        assert player.jail_card_ids == ["com_13"]  # остава за по-късно

    def test_shield_cannot_be_used_to_leave_jail(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        player.in_jail = True
        player.jail_card_ids = ["biz_12"]

        with pytest.raises(Exception, match="излезете"):
            engine.use_jail_card(pid)
        assert player.in_jail
        assert player.jail_card_ids == ["biz_12"]

    def test_release_is_chosen_over_shield(self, engine: GameEngine) -> None:
        """С двете в ръка излиза чиновническата, а щитът остава."""
        pid = engine.state.current_player_id
        player = engine.state.players[pid]
        player.in_jail = True
        player.jail_card_ids = ["biz_12", "com_13"]

        engine.use_jail_card(pid)

        assert not player.in_jail
        assert player.jail_card_ids == ["biz_12"]

    def test_client_projection_exposes_the_mode(self, engine: GameEngine) -> None:
        player = engine.state.players[engine.state.turn_order[0]]
        player.jail_card_ids = ["biz_12"]
        payload = player.to_client()
        assert payload["get_out_cards"] == 1
        assert payload["jail_cards"][0]["mode"] == "shield"
        assert payload["jail_cards"][0]["label"]


class TestJailCardTransfers:
    def test_bankruptcy_to_creditor_moves_the_exact_cards(
        self, engine4: GameEngine,
    ) -> None:
        p1, p2 = engine4.state.turn_order[:2]
        debtor, creditor = engine4.state.players[p1], engine4.state.players[p2]
        debtor.jail_card_ids = ["com_13"]
        creditor.jail_card_ids = ["biz_12"]

        _force_bankruptcy(engine4, p1, p2)

        assert debtor.jail_card_ids == []
        assert sorted(creditor.jail_card_ids) == ["biz_12", "com_13"]

    def test_bankruptcy_to_bank_returns_cards_to_decks(
        self, engine4: GameEngine,
    ) -> None:
        """Без наследник картите се връщат в игра, вместо да изчезнат."""
        p1 = engine4.state.turn_order[0]
        debtor = engine4.state.players[p1]
        for deck in engine4.state.decks.values():
            deck.draw_pile = [c for c in deck.draw_pile if c not in JAIL_FREE_CARD_IDS]
            deck.discard_pile = [
                c for c in deck.discard_pile if c not in JAIL_FREE_CARD_IDS
            ]
        debtor.jail_card_ids = ["com_13"]

        _force_bankruptcy(engine4, p1, None)

        assert debtor.jail_card_ids == []
        assert _copies_in_play(engine4, "com_13") == 1
        assert "com_13" in engine4.state.decks["community"].discard_pile


class TestJailCardPersistence:
    def test_round_trip_keeps_identity(self, engine: GameEngine, board: Board) -> None:
        p1 = engine.state.turn_order[0]
        engine.state.players[p1].jail_card_ids = ["biz_12"]

        restored = state_from_dict(state_to_dict(engine.state))

        assert restored.players[p1].jail_card_ids == ["biz_12"]

    def test_legacy_save_with_counter_is_upgraded(
        self, engine: GameEngine,
    ) -> None:
        """Стар запис пази само брой — идентичността се раздава наново."""
        data = state_to_dict(engine.state)
        p1 = engine.state.turn_order[0]
        data["format_version"] = 5
        for payload in data["players"].values():
            payload.pop("jail_card_ids", None)
        data["players"][p1]["get_out_cards"] = 1

        restored = state_from_dict(data)

        assert len(restored.players[p1].jail_card_ids) == 1
        assert restored.players[p1].jail_card_ids[0] in JAIL_FREE_CARD_IDS

    def test_duplicate_in_save_is_reconciled(self, engine: GameEngine) -> None:
        """Запис от преди поправката може да съдържа две копия на една карта."""
        p1, p2 = engine.state.turn_order
        engine.state.players[p1].jail_card_ids = ["com_13"]
        engine.state.players[p2].jail_card_ids = ["com_13"]

        restored = state_from_dict(state_to_dict(engine.state))

        held = (
            restored.players[p1].jail_card_ids + restored.players[p2].jail_card_ids
        )
        assert sorted(held) == ["biz_12", "com_13"]  # дубликатът стана свободната карта
        for card_id in JAIL_FREE_CARD_IDS:
            in_decks = sum(
                deck.draw_pile.count(card_id) + deck.discard_pile.count(card_id)
                for deck in restored.decks.values()
            )
            assert in_decks == 0  # държат се от играчи, не стоят и в тестето

    def test_unheld_cards_are_returned_to_decks(self, engine: GameEngine) -> None:
        """Карта, която никой не държи и я няма в тестето, се връща в игра."""
        data = state_to_dict(engine.state)
        for deck in data["decks"].values():
            deck["draw_pile"] = [
                c for c in deck["draw_pile"] if c not in JAIL_FREE_CARD_IDS
            ]
            deck["discard_pile"] = [
                c for c in deck["discard_pile"] if c not in JAIL_FREE_CARD_IDS
            ]

        restored = state_from_dict(data)

        for card_id in JAIL_FREE_CARD_IDS:
            deck = restored.decks[deck_of(card_id)]
            assert card_id in deck.discard_pile


class TestJailCardTrade:
    def test_trade_moves_the_named_card(self, board: Board) -> None:
        settings = GameSettings(auctions_enabled=False, free_trading=True)
        eng = GameEngine(board, settings, rng=random.Random(3))
        eng.start_game(make_players(2))
        p1, p2 = eng.state.turn_order
        eng.state.players[p1].jail_card_ids = ["biz_12"]
        eng.state.players[p1].cash = 500
        eng.state.players[p2].cash = 500

        events = eng.create_trade(p1, p2, offer_jail_cards=1, request_cash=10)
        trade_id = next(
            e["trade"]["trade_id"] for e in events
            if e.get("type") == "trade_offer"
        )
        eng.respond_trade(p2, trade_id, accept=True)

        assert eng.state.players[p1].jail_card_ids == []
        assert eng.state.players[p2].jail_card_ids == ["biz_12"]


class TestJailCardCirculation:
    def test_full_game_never_duplicates_a_jail_card(self, board: Board) -> None:
        """Дълга ботова партия: нито една карта не се размножава."""
        settings = GameSettings(turn_time_limit=0)
        eng = GameEngine(board, settings, rng=random.Random(11))
        players = make_players(4)
        for player in players:
            player.is_bot = True
            player.cash = 1500
        eng.start_game(players)

        from app.game.bots import choose_bot, play_bot_step

        steps = 0
        while steps < 4000 and not eng.state.winner:
            actor = choose_bot(eng)
            if actor is None:
                break
            play_bot_step(eng, actor)
            steps += 1
            for card_id in JAIL_FREE_CARD_IDS:
                copies = _copies_in_play(eng, card_id)
                assert copies == 1, f"{card_id} съществува в {copies} копия"

        assert steps > 200, "партията спря твърде рано, за да значи нещо"
