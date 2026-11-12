"""Проверки за целостта на двете тестета карти.

Пазят от типичните грешки при добавяне на нова карта: повторено ``card_id``
(тихо изяжда стара карта в ``all_cards()``), ефект, който engine-ът не
разпознава (изпълнява се като „нищо не се случва"), поле извън таблото и
разминаване между префикса на идентификатора и тестето.
"""
from __future__ import annotations

import collections
import json
import random

from app.game.board import Board
from app.game.cards import (
    BUSINESS_CARDS, COMMUNITY_CARDS, KEEPABLE_POWERS, Deck, all_cards,
)
from app.game.engine import GameEngine
from app.game.rules import GameSettings

from conftest import BASE_DIR, make_players

# Типовете, които GameEngine._apply_card разпознава. Всичко извън списъка
# попада в else-клона и картата остава без ефект.
SUPPORTED_EFFECTS = {
    "gain", "pay", "move_to", "nearest_transport", "nearest_utility",
    "move_by", "repair", "pay_each", "collect_each", "jail_free",
    "goto_jail", "extra_turn", "rent_discount", "start_bonus", "keep",
    "choice", "all_move_by", "all_cash",
}

ALL = COMMUNITY_CARDS + BUSINESS_CARDS


def test_card_ids_are_unique() -> None:
    counts = collections.Counter(card.card_id for card in ALL)
    assert [cid for cid, n in counts.items() if n > 1] == []
    assert len(all_cards()) == len(ALL)


def test_every_effect_is_supported_by_the_engine() -> None:
    unsupported = [
        (card.card_id, card.effect.get("type"))
        for card in ALL
        if card.effect.get("type") not in SUPPORTED_EFFECTS
    ]
    assert unsupported == []


def test_effects_carry_their_required_payload() -> None:
    required = {
        "gain": "amount", "pay": "amount", "pay_each": "amount",
        "collect_each": "amount", "move_to": "position",
        "move_by": "steps", "repair": "per_level",
    }
    for card in ALL:
        key = required.get(card.effect["type"])
        if key is None:
            continue
        assert key in card.effect, f"{card.card_id} е без „{key}"
        value = card.effect[key]
        assert isinstance(value, int), card.card_id
        if key == "steps":
            # move_by допуска отрицателни стъпки (връщане назад), но не 0.
            assert value != 0, card.card_id
        elif key == "position":
            # 0 е Начален площад — валидна цел.
            assert value >= 0, card.card_id
        else:
            assert value > 0, card.card_id


def test_keepable_cards_declare_a_known_power() -> None:
    """Непозната сила би оставила картата в ръката без никакъв ефект."""
    for card in ALL:
        if card.effect["type"] != "keep":
            continue
        power = card.effect.get("power")
        assert power in KEEPABLE_POWERS, f"{card.card_id}: непозната сила {power}"
        percent = card.effect.get("percent")
        assert isinstance(percent, int) and percent >= 0, card.card_id
        assert percent != 100, f"{card.card_id}: 100% не променя нищо"
        uses = card.effect.get("uses", 1)
        assert isinstance(uses, int) and uses >= 1, card.card_id


def test_keepable_powers_match_their_direction() -> None:
    """Полезната карта не бива да вреди и обратното."""
    for card in ALL:
        if card.effect["type"] != "keep":
            continue
        power = KEEPABLE_POWERS[card.effect["power"]]
        percent = card.effect["percent"]
        name = card.effect["power"]
        # При покупка/строеж/платен наем по-малко е добре; при събран наем —
        # обратното.
        cheaper_is_better = name in ("purchase_discount", "purchase_surcharge",
                                     "build_discount", "rent_shield")
        helps = percent < 100 if cheaper_is_better else percent > 100
        assert helps == power["good"], f"{card.card_id}: посоката не съвпада"


def test_move_to_targets_exist_on_the_board(board) -> None:
    for card in ALL:
        if card.effect["type"] == "move_to":
            position = card.effect["position"]
            assert 0 <= position < board.size, card.card_id
            assert board.space(position) is not None


def test_deck_field_matches_id_prefix() -> None:
    for card in COMMUNITY_CARDS:
        assert card.card_id.startswith("com_") and card.deck == "community"
    for card in BUSINESS_CARDS:
        assert card.card_id.startswith("biz_") and card.deck == "business"


def test_each_deck_has_exactly_one_jail_free_card() -> None:
    """Картата за освобождаване напуска тестето, докато не бъде използвана.

    Повече от една на тесте променя осезаемо баланса на проверката.
    """
    for deck in (COMMUNITY_CARDS, BUSINESS_CARDS):
        jail_free = [c for c in deck if c.effect["type"] == "jail_free"]
        assert len(jail_free) == 1


def test_texts_are_present_and_bulgarian() -> None:
    for card in ALL:
        assert card.text.strip(), card.card_id
        assert card.text.strip().endswith((".", "!", "?")), card.card_id
        # Поне една кирилска буква — пази от забравен заместващ текст.
        assert any("А" <= ch <= "я" for ch in card.text), card.card_id


def test_full_deck_cycle_draws_every_card_once() -> None:
    """Тестето обхожда всички карти, преди да се повтори."""
    rng = random.Random(5)
    deck = Deck.build("community", rng)
    drawn = []
    for _ in range(len(COMMUNITY_CARDS)):
        card = deck.draw(rng)
        drawn.append(card.card_id)
        deck.discard(card.card_id)
    assert sorted(drawn) == sorted(c.card_id for c in COMMUNITY_CARDS)


def test_client_state_exposes_deck_counts_without_card_ids() -> None:
    """Клиентът вижда КОЛКО карти има в тестето, но не и кои.

    Броят е нужен, за да личи кога тестето ще се разбърка; съдържанието
    остава тайна, иначе следващата карта става предвидима.
    """
    from app.game.serialization import state_to_client

    board = Board.from_file(BASE_DIR / "data" / "board_config.json")
    engine = GameEngine(board, GameSettings(auctions_enabled=False), rng=random.Random(3))
    engine.start_game(make_players(2))

    view = state_to_client(engine.state, board, "p0")
    counts = view["deck_counts"]
    assert set(counts) == set(engine.state.decks)
    for deck_id, entry in counts.items():
        deck = engine.state.decks[deck_id]
        assert entry == {"draw": len(deck.draw_pile), "discard": len(deck.discard_pile)}
    # Никъде в проекцията не бива да се появи идентификатор на карта.
    assert "decks" not in view
    dumped = json.dumps(view, ensure_ascii=False, default=str)
    for card in ALL:
        assert card.card_id not in dumped, card.card_id


def test_choice_cards_are_well_formed() -> None:
    """И двата варианта трябва да носят етикет и смислени суми.

    Карта, при която сигурният вариант е по-добър и от най-добрия изход на
    залога, не предлага истински избор — никой разумен играч не би рискувал.
    """
    for card in ALL:
        if card.effect["type"] != "choice":
            continue
        safe = card.effect.get("safe")
        risky = card.effect.get("risky")
        assert isinstance(safe, dict) and isinstance(risky, dict), card.card_id
        assert safe.get("label", "").strip(), card.card_id
        assert risky.get("label", "").strip(), card.card_id
        assert risky.get("note", "").strip(), card.card_id
        for key, holder in (("amount", safe), ("win", risky), ("lose", risky)):
            assert isinstance(holder.get(key), int), f"{card.card_id}: {key}"
        # Залогът трябва да има и по-добър, и по-лош изход от сигурното.
        assert risky["win"] > safe["amount"], card.card_id
        assert risky["lose"] < safe["amount"], card.card_id


def test_name_templates_only_on_immediate_cards() -> None:
    """Държаните карти показват текста си направо от дефиницията.

    ``Player.held_cards_client`` и ``jail_cards_client`` връщат ``card.text``
    без замяна, така че шаблон там би стигнал до играча като „{съсед}".
    """
    for card in ALL:
        if "{съсед}" not in card.text:
            continue
        assert card.effect["type"] not in ("keep", "jail_free"), card.card_id


def test_no_unknown_templates_remain() -> None:
    """Печатна грешка в шаблон би стигнала до играча като суров текст."""
    import re

    for card in ALL:
        for found in re.findall(r"\{[^}]*\}", card.text):
            assert found == "{съсед}", f"{card.card_id}: непознат шаблон {found}"


def test_every_card_has_an_icon() -> None:
    """Иконата е лицето на картата — липсваща оставя празно място."""
    for card in ALL:
        assert card.icon.strip(), card.card_id


def test_legendary_cards_stay_rare() -> None:
    """Рядкостта идва от размера на тестето, не от отделен механизъм.

    Ако легендарните надхвърлят една десета от тестето, те престават да са
    събитие и се превръщат в обичайно теглене.
    """
    for deck in (COMMUNITY_CARDS, BUSINESS_CARDS):
        legendary = [c for c in deck if c.legendary]
        assert legendary, "тестето е без легендарни карти"
        assert len(legendary) <= len(deck) // 10, len(legendary)


def test_mass_effects_carry_their_payload() -> None:
    for card in ALL:
        etype = card.effect["type"]
        if etype == "all_move_by":
            steps = card.effect.get("steps")
            assert isinstance(steps, int) and steps != 0, card.card_id
        elif etype == "all_cash":
            amount = card.effect.get("amount")
            assert isinstance(amount, int) and amount != 0, card.card_id
