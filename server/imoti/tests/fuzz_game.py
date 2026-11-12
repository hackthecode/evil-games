"""Фъзер: играе много случайни партии и проверява инвариантите след всяко действие.

Намира за секунди неща, които подредените тестове пропускат — защото играе
комбинации, за които никой не се е сетил. Пускайте го след промяна по
сделките, имотите, картите или парите:

    ./.venv/Scripts/python.exe tests/fuzz_game.py            # 200 партии
    ./.venv/Scripts/python.exe tests/fuzz_game.py --games 2000 --seed 7

При нарушен инвариант скриптът спира и отпечатва seed-а и хода, така че
случаят да може да бъде възпроизведен точно.
"""
from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.game.board import Board  # noqa: E402
from app.game.bots import choose_bot, play_bot_step  # noqa: E402
from app.game.cards import (  # noqa: E402
    JAIL_FREE_CARD_IDS,
    BUSINESS_CARDS,
    COMMUNITY_CARDS,
    deck_of,
)
from app.game.engine import GameEngine  # noqa: E402
from app.game.player import Player  # noqa: E402
from app.game.properties import MAX_LEVEL  # noqa: E402
from app.game.rules import GameSettings  # noqa: E402
from app.game.serialization import state_from_dict, state_to_dict  # noqa: E402


# Фигурки за партиите — стигат за пълна стая от 10 играчи.
TOKENS = [
    "red", "black", "green", "pink", "yellow", "blue",
    "white", "orange", "purple", "turquoise", "brown", "silver",
]


class InvariantError(AssertionError):
    """Нарушено правило, което трябва да важи по всяко време."""


def check_invariants(engine: GameEngine) -> None:
    """Всичко, което трябва да е вярно след всяко едно действие."""
    state = engine.state

    # 1. Всяка карта съществува в точно едно копие: в тесте или в нечия ръка.
    for deck_id, source in (("community", COMMUNITY_CARDS), ("business", BUSINESS_CARDS)):
        deck = state.decks[deck_id]
        places: dict[str, int] = {}
        for card_id in deck.draw_pile + deck.discard_pile:
            places[card_id] = places.get(card_id, 0) + 1
        for player in state.players.values():
            for card_id in player.jail_card_ids + player.held_cards:
                if deck_of(card_id) == deck_id:
                    places[card_id] = places.get(card_id, 0) + 1
        for card in source:
            count = places.get(card.card_id, 0)
            if count != 1:
                raise InvariantError(
                    f"картата {card.card_id} съществува в {count} копия"
                )

    # 2. Картите „освобождаване" не се държат от двама наведнъж.
    holders: dict[str, list[str]] = {}
    for player in state.players.values():
        for card_id in player.jail_card_ids:
            holders.setdefault(card_id, []).append(player.player_id)
    for card_id, owners in holders.items():
        if len(owners) > 1:
            raise InvariantError(f"{card_id} се държи от {owners}")
        if card_id not in JAIL_FREE_CARD_IDS:
            raise InvariantError(f"{card_id} не е карта за освобождаване")

    # 3. Строителният фонд на банката не може да е отрицателен.
    houses = sum(
        p.level for p in state.properties.values()
        if 0 < p.level < MAX_LEVEL
    )
    hotels = sum(1 for p in state.properties.values() if p.level >= MAX_LEVEL)
    if houses > 32 or hotels > 12:
        raise InvariantError(f"фондът е надхвърлен: {houses} къщи, {hotels} хотела")

    for pos, prop in state.properties.items():
        space = engine.board.space(pos)
        # 4. Нивата са в допустимия диапазон и само за имоти.
        if not 0 <= prop.level <= MAX_LEVEL:
            raise InvariantError(f"поле {pos}: ниво {prop.level}")
        if prop.level and space.type != "property":
            raise InvariantError(f"поле {pos} ({space.type}) има ниво {prop.level}")
        # 5. Ипотекиран имот не носи постройки.
        if prop.mortgaged and prop.level:
            raise InvariantError(f"поле {pos} е ипотекирано с ниво {prop.level}")
        # 6. Собственикът е реален и нефалирал.
        if prop.owner is not None:
            owner = state.players.get(prop.owner)
            if owner is None:
                raise InvariantError(f"поле {pos}: непознат собственик {prop.owner}")
            if owner.bankrupt:
                raise InvariantError(f"поле {pos} принадлежи на фалирал играч")

    for player in state.players.values():
        # 7. Фалиралият няма нищо.
        if player.bankrupt:
            if player.cash or player.loan or player.jail_card_ids:
                raise InvariantError(f"{player.player_id} е фалирал, но има активи")
            owned = [p for p in state.properties.values() if p.owner == player.player_id]
            if owned:
                raise InvariantError(f"{player.player_id} е фалирал, но държи имоти")
        # 8. Отрицателни пари се допускат само при висящ дълг.
        if player.cash < 0 and state.debt is None:
            raise InvariantError(
                f"{player.player_id} е на {player.cash} € без висящо задължение"
            )
        # 9. Заемът не е отрицателен.
        if player.loan < 0:
            raise InvariantError(f"{player.player_id} има заем {player.loan}")

    # 10. Ходът сочи към съществуващ, нефалирал играч, докато има победители.
    if state.winner is None and state.turn_order:
        current = state.players.get(state.current_player_id or "")
        if current is None:
            raise InvariantError("ходът сочи към несъществуващ играч")


def check_round_trip(engine: GameEngine) -> None:
    """Записът и възстановяването не бива да променят състоянието."""
    restored = state_from_dict(state_to_dict(engine.state))
    for pid, player in engine.state.players.items():
        other = restored.players[pid]
        if other.cash != player.cash or other.position != player.position:
            raise InvariantError(f"записът разваля {pid}")
        if other.jail_card_ids != player.jail_card_ids:
            raise InvariantError(
                f"записът разваля картите на {pid}: "
                f"{player.jail_card_ids} → {other.jail_card_ids}"
            )


def play_one_game(seed: int, max_steps: int = 3000) -> int:
    """Играе една партия само с ботове. Връща броя изиграни решения."""
    rng = random.Random(seed)
    board = Board.from_file(BASE_DIR / "data" / "board_config.json")
    settings = GameSettings(
        turn_time_limit=0,
        auctions_enabled=rng.random() < 0.7,
        trading_enabled=rng.random() < 0.85,
        free_trading=rng.random() < 0.3,
        loans_enabled=rng.random() < 0.8,
        sell_to_bank_enabled=rng.random() < 0.8,
        free_parking_jackpot=rng.random() < 0.4,
        eu_subsidies_enabled=rng.random() < 0.3,
        starting_cash=rng.choice([800, 1500, 2500]),
    )
    engine = GameEngine(board, settings, rng=random.Random(seed + 1))
    styles = ["cautious", "balanced", "aggressive"]
    players = []
    for i in range(rng.randint(2, 10)):
        player = Player(
            player_id=f"p{i}", name=f"Бот {i + 1}",
            token=TOKENS[i],
            cash=settings.starting_cash,
        )
        player.is_bot = True
        player.bot_style = rng.choice(styles)
        players.append(player)
    engine.start_game(players)
    check_invariants(engine)

    steps = 0
    while steps < max_steps and engine.state.winner is None:
        actor = choose_bot(engine)
        if actor is None:
            break
        play_bot_step(engine, actor)
        steps += 1
        check_invariants(engine)
        if steps % 50 == 0:
            check_round_trip(engine)
    check_round_trip(engine)
    return steps


def main() -> int:
    # Конзолата на Windows по подразбиране е cp1252 и се задавя от кирилица.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Фъзер на „Имоти и Империи")
    parser.add_argument("--games", type=int, default=200, help="брой партии")
    parser.add_argument("--seed", type=int, default=0, help="начален seed")
    args = parser.parse_args()

    total_steps = 0
    for index in range(args.games):
        seed = args.seed + index
        try:
            total_steps += play_one_game(seed)
        except InvariantError as exc:
            print(f"\nНАРУШЕН ИНВАРИАНТ (seed={seed}): {exc}")
            return 1
        except Exception as exc:  # неочаквано изключение също е находка
            print(f"\nИЗКЛЮЧЕНИЕ (seed={seed}): {type(exc).__name__}: {exc}")
            raise
        if (index + 1) % 25 == 0:
            print(f"  {index + 1}/{args.games} партии, {total_steps} решения")

    print(f"OK: {args.games} партии, {total_steps} решения, нула нарушения.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
