"""Общи фикстури за тестовете — детерминиран random seed."""
from __future__ import annotations

import random
import sys
from pathlib import Path

import pytest

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.database import init_db  # noqa: E402
from app.game.board import Board  # noqa: E402
from app.game.dice_cheat import SIGNAL_FILE  # noqa: E402
from app.game.engine import GameEngine  # noqa: E402
from app.game.player import Player  # noqa: E402
from app.game.rules import GameSettings  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _database(tmp_path_factory) -> None:
    """Отделна база за цялата тестова сесия.

    Досега тук се викаше ``init_db()`` върху истинската ``data/game.db`` и
    всеки тест, който стартира игра, ѝ оставяше запис. Оттам идваха и
    хилядата „активни" записа: не от истински партии, а от тестовите
    пускания. Играта на потребителя не бива да пази следи от тестовете.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app import database, models

    path = tmp_path_factory.mktemp("db") / "test.db"
    engine = create_engine(
        f"sqlite:///{path.as_posix()}", connect_args={"check_same_thread": False}
    )
    models.Base.metadata.create_all(bind=engine)
    # ``get_session`` чете SessionLocal от глобалните на модула при всяко
    # извикване, затова подмяната важи и за вече импортираните модули.
    database.engine = engine
    database.SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False
    )
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def _no_forced_dice() -> None:
    """Гарантира, че ръчно зададено хвърляне не се промъква в тестовете.

    Конзолата ``cheat_dice.py`` оставя стойност, валидна до следващото
    хвърляне. Ако тя завари тестовете, те падат по необясними причини.
    """
    try:
        SIGNAL_FILE.unlink()
    except OSError:
        pass


@pytest.fixture()
def board() -> Board:
    """Реалното табло от data/board_config.json."""
    return Board.from_file(BASE_DIR / "data" / "board_config.json")


@pytest.fixture()
def settings() -> GameSettings:
    """Изолирани настройки за старите тестове без автоматичен търг."""
    return GameSettings(auctions_enabled=False)


def make_players(count: int = 2) -> list[Player]:
    """Създава тестови играчи (стигат за пълна стая от 10)."""
    tokens = [
        "red", "black", "green", "pink", "yellow", "blue",
        "white", "orange", "purple", "turquoise", "brown", "silver",
    ]
    return [
        Player(player_id=f"p{i}", name=f"Играч {i + 1}", token=tokens[i], cash=0)
        for i in range(count)
    ]


@pytest.fixture()
def engine(board: Board, settings: GameSettings) -> GameEngine:
    """Двигател с детерминиран seed и двама играчи."""
    eng = GameEngine(board, settings, rng=random.Random(42))
    eng.start_game(make_players(2))
    return eng


@pytest.fixture()
def engine4(board: Board, settings: GameSettings) -> GameEngine:
    """Двигател с 4 играчи и детерминиран seed."""
    eng = GameEngine(board, settings, rng=random.Random(7))
    eng.start_game(make_players(4))
    return eng


def force_roll(eng: GameEngine, die1: int, die2: int) -> None:
    """Помощник: подменя RNG-то така, че следващото хвърляне да е точно това.

    randint се вика два пъти (по веднъж за зар); shuffle/др. не се засягат,
    защото подменяме само randint с итератор.
    """
    values = iter([die1, die2])
    original = eng.rng.randint

    def fake_randint(a: int, b: int) -> int:
        try:
            return next(values)
        except StopIteration:
            eng.rng.randint = original  # възстановяване след двете стойности
            return original(a, b)

    eng.rng.randint = fake_randint  # type: ignore[method-assign]
