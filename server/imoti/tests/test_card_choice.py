"""Карти с избор: сигурен вариант или залог на зара.

Най-важната проверка тук е ботът: непозната фаза в ``play_bot_step`` връща
празен списък, а socket слоят тогава спира бот-цикъла и стаята увисва.
"""
from __future__ import annotations

import random

import pytest

from app.game.bots import choose_bot, play_bot_step
from app.game.cards import Card
from app.game.engine import GameEngine, GameError
from app.game.rules import GameSettings
from app.game.state import Phase

from conftest import make_players

CHOICE_CARD = Card("com_38", "community", "Тестова карта с избор.", {
    "type": "choice",
    "safe": {"label": "Платете 120 €", "amount": -120},
    "risky": {"label": "Хвърлете зар", "note": "Четно — нищо. Нечетно — 260 €.",
              "win": 0, "lose": -260},
})


def _draw_choice(engine: GameEngine, player_id: str) -> None:
    """Кара конкретния играч да изтегли картата с избор."""
    player = engine.state.players[player_id]
    deck = engine.state.decks["community"]
    engine._apply_card(player, CHOICE_CARD, deck)


class TestChoiceMechanic:
    def test_drawing_enters_choice_phase(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        _draw_choice(engine, pid)
        assert engine.state.phase == Phase.AWAITING_CARD_CHOICE
        pending = engine.state.pending_card_choice
        assert pending is not None and pending.player_id == pid
        assert pending.safe_amount == -120
        assert pending.risky_lose == -260

    def test_safe_option_charges_the_fixed_amount(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 1000
        _draw_choice(engine, pid)
        engine.resolve_card_choice(pid, "safe")
        assert engine.state.players[pid].cash == 880
        assert engine.state.pending_card_choice is None
        assert engine.state.phase == Phase.MANAGEMENT

    def test_risky_option_follows_the_die(self, board) -> None:
        # Четен зар печели, нечетен губи — проверяваме и двата изхода.
        for seed, expect_win in ((1, None), (2, None)):
            eng = GameEngine(board, GameSettings(), rng=random.Random(seed))
            eng.start_game(make_players(2))
            pid = eng.state.current_player_id
            eng.state.players[pid].cash = 1000
            _draw_choice(eng, pid)
            events = eng.resolve_card_choice(pid, "risky")
            roll = next(e for e in events if e.get("type") == "choice_roll")
            if roll["won"]:
                assert roll["roll"] % 2 == 0
                assert eng.state.players[pid].cash == 1000   # win = 0
            else:
                assert roll["roll"] % 2 == 1
                assert eng.state.players[pid].cash == 740    # lose = -260

    def test_wrong_player_cannot_resolve(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        _draw_choice(engine, p1)
        with pytest.raises(GameError):
            engine.resolve_card_choice(p2, "safe")

    def test_invalid_option_is_rejected(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        _draw_choice(engine, pid)
        with pytest.raises(GameError):
            engine.resolve_card_choice(pid, "може би")

    def test_unaffordable_choice_enters_payment_phase(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 10
        _draw_choice(engine, pid)
        engine.resolve_card_choice(pid, "safe")
        # Недостигът минава по обичайния път за задължения, а изборът е чист.
        assert engine.state.pending_card_choice is None
        assert engine.state.phase == Phase.AWAITING_PAYMENT
        assert engine.state.debt is not None

    def test_timeout_falls_back_to_the_safe_option(self, engine: GameEngine) -> None:
        pid = engine.state.current_player_id
        engine.state.players[pid].cash = 1000
        _draw_choice(engine, pid)
        engine.force_skip_turn(pid, timed_out=True)
        # Изборът не изчезва: неотговорилият плаща сигурния вариант.
        assert engine.state.players[pid].cash == 880
        assert engine.state.pending_card_choice is None
        assert engine.state.phase != Phase.AWAITING_CARD_CHOICE

    def test_survives_serialization(self, engine: GameEngine) -> None:
        from app.game.serialization import state_from_dict, state_to_dict

        pid = engine.state.current_player_id
        _draw_choice(engine, pid)
        restored = state_from_dict(state_to_dict(engine.state))
        assert restored.pending_card_choice is not None
        assert restored.pending_card_choice.player_id == pid
        assert restored.pending_card_choice.risky_lose == -260

    def test_client_projection_exposes_the_choice(self, engine: GameEngine) -> None:
        from app.game.serialization import state_to_client

        pid = engine.state.current_player_id
        _draw_choice(engine, pid)
        view = state_to_client(engine.state, engine.board, pid)
        assert view["pending_card_choice"]["safe_label"] == "Платете 120 €"


class TestChoiceWithBots:
    """Без тези проверки бот в новата фаза замразява цялата стая."""

    def _bot_engine(self, board, style: str) -> tuple[GameEngine, str]:
        eng = GameEngine(board, GameSettings(), rng=random.Random(4))
        players = make_players(2)
        players[0].is_bot = True
        players[0].bot_style = style
        eng.start_game(players)
        return eng, players[0].player_id

    @pytest.mark.parametrize("style", ["cautious", "balanced", "aggressive"])
    def test_bot_always_resolves_the_choice(self, board, style: str) -> None:
        eng, bot_id = self._bot_engine(board, style)
        eng.state.current_index = eng.state.turn_order.index(bot_id)
        _draw_choice(eng, bot_id)
        # Ботът трябва да е избран за действие и да върне събития — празен
        # отговор спира бот-цикъла в socket слоя и играта увисва.
        assert choose_bot(eng) == bot_id
        events = play_bot_step(eng, bot_id)
        assert events, f"{style}: ботът не върна събития"
        assert eng.state.phase != Phase.AWAITING_CARD_CHOICE
        assert eng.state.pending_card_choice is None

    def test_cautious_bot_takes_the_safe_option(self, board) -> None:
        eng, bot_id = self._bot_engine(board, "cautious")
        eng.state.current_index = eng.state.turn_order.index(bot_id)
        eng.state.players[bot_id].cash = 2000
        _draw_choice(eng, bot_id)
        play_bot_step(eng, bot_id)
        assert eng.state.players[bot_id].cash == 1880  # платил е сигурните 120

    def test_bot_avoids_a_gamble_it_cannot_cover(self, board) -> None:
        eng, bot_id = self._bot_engine(board, "aggressive")
        eng.state.current_index = eng.state.turn_order.index(bot_id)
        eng.state.players[bot_id].cash = 130   # губещият изход би го съсипал
        _draw_choice(eng, bot_id)
        play_bot_step(eng, bot_id)
        assert eng.state.players[bot_id].cash == 10  # избрал е сигурното


class TestNameTemplates:
    """Вмъкване на име на друг играч в текста на картата."""

    def _card(self) -> Card:
        return Card("com_04", "community", "{съсед} ви маха от балкона.",
                    {"type": "gain", "amount": 10})

    def test_name_is_substituted(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        player = engine.state.players[p1]
        text = engine._resolve_card_text(self._card(), player)
        assert "{съсед}" not in text
        assert engine.state.players[p2].name in text

    def test_never_picks_the_drawing_player(self, board) -> None:
        eng = GameEngine(board, GameSettings(), rng=random.Random(11))
        eng.start_game(make_players(4))
        drawer = eng.state.players[eng.state.turn_order[0]]
        for _ in range(30):
            text = eng._resolve_card_text(self._card(), drawer)
            assert drawer.name not in text

    def test_falls_back_when_alone(self, board) -> None:
        eng = GameEngine(board, GameSettings(), rng=random.Random(2))
        eng.start_game(make_players(2))
        p1, p2 = eng.state.turn_order
        eng.state.players[p2].bankrupt = True    # остава сам на масата
        text = eng._resolve_card_text(self._card(), eng.state.players[p1])
        assert "{съсед}" not in text
        assert text.strip()

    def test_resolved_text_reaches_event_and_log(self, engine: GameEngine) -> None:
        p1, p2 = engine.state.turn_order
        deck = engine.state.decks["community"]
        # Слагаме шаблонната карта най-отгоре в тестето.
        from app.game import cards as cards_module
        original = cards_module.all_cards
        template = self._card()
        cards_module.all_cards = lambda: {**original(), template.card_id: template}
        try:
            deck.draw_pile.insert(0, template.card_id)
            events = engine._draw_card(engine.state.players[p1], "community")
        finally:
            cards_module.all_cards = original
        card_event = next(e for e in events if e.get("type") == "card")
        log_event = next(e for e in events if e.get("type") == "log")
        other = engine.state.players[p2].name
        assert "{съсед}" not in card_event["text"] and other in card_event["text"]
        assert "{съсед}" not in log_event["text"] and other in log_event["text"]
