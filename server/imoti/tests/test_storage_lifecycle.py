"""Жизнен цикъл на записите: изчистване от паметта и от базата.

Тези проверки пазят точно нещата, които преди липсваха: стаите се трупаха
в паметта (никой не викаше ``cleanup_idle_rooms``), базата не се чистеше
никога, а всеки старт връщаше отдавна изоставени игри.
"""
from __future__ import annotations

import json
import time

import pytest

from app.config import settings
from app.database import get_session
from app.models import GameResult, SavedGame
from app.room_manager import RoomManager

DAY = 86400


@pytest.fixture()
def manager(board) -> RoomManager:
    return RoomManager(board)


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path, monkeypatch):
    """Собствена база за всеки тест.

    Задължително: тук се трият записи, а модулната сесия сочи към
    истинската ``data/game.db``. Без подмяната един пуснат тест изтрива
    запазените игри на играчите.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app import database, models

    url = f"sqlite:///{(tmp_path / 'test.db').as_posix()}"
    engine = create_engine(url, connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    # ``get_session`` търси SessionLocal в глобалните на модула при всяко
    # извикване, затова подмяната важи и за вече импортирания room_manager.
    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(
        database, "SessionLocal",
        sessionmaker(bind=engine, autoflush=False, expire_on_commit=False),
    )
    yield
    engine.dispose()


def test_the_fixture_really_isolates_the_database() -> None:
    """Пази следващия, който добави тест тук: ако подмяната спре да работи,
    тестовете започват да трият истинската база, а не своята."""
    from app import database
    from app.config import settings

    url = str(database.SessionLocal.kw["bind"].url)
    assert "test.db" in url, url
    assert settings.DATABASE_URL not in url


def _row(code: str, status: str, age_days: float, *, paused: bool = False) -> None:
    session = get_session()
    session.add(SavedGame(
        room_code=code,
        status=status,
        state_json=json.dumps({"paused": paused}),
        room_json="{}",
        updated_at=time.time() - age_days * DAY,
    ))
    session.commit()
    session.close()


def _archive(code: str) -> None:
    session = get_session()
    session.add(GameResult(room_code=code, finished_at=time.time(), winner_name="X"))
    session.commit()
    session.close()


def _codes() -> set[str]:
    session = get_session()
    codes = {r.room_code for r in session.query(SavedGame).all()}
    session.close()
    return codes


# --- Изчистване на паметта ----------------------------------------------

class TestIdleRooms:
    def test_connected_room_is_never_evicted(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        room.last_activity = time.time() - settings.ROOM_IDLE_SECONDS - 10
        host.connected = True
        assert manager.cleanup_idle_rooms() == 0
        assert room.code in manager.rooms

    def test_abandoned_room_is_evicted(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        room.last_activity = time.time() - settings.ROOM_IDLE_SECONDS - 10
        host.connected = False
        assert manager.cleanup_idle_rooms() == 1
        assert room.code not in manager.rooms

    def test_eviction_does_not_refresh_the_saved_row(self, manager: RoomManager) -> None:
        """Пре-записът правеше стаите безсмъртни: изхвърляне → нов запис
        като „active" с прясна дата → следващият старт я връща обратно."""
        room, host, _ = manager.create_room("Иван", "red")
        _, guest, _ = manager.join_room(room.code, "Мария", "black")
        manager.set_ready(room, guest, True)
        manager.start_game(room, host)
        session = get_session()
        before = session.query(SavedGame).filter(
            SavedGame.room_code == room.code).one().updated_at
        session.close()

        room.last_activity = time.time() - settings.ROOM_IDLE_SECONDS - 10
        for member in room.members.values():
            member.connected = False
        manager.cleanup_idle_rooms()

        session = get_session()
        after = session.query(SavedGame).filter(
            SavedGame.room_code == room.code).one().updated_at
        session.close()
        assert after == before, "изхвърлянето не бива да опреснява записа"


# --- Изчистване на базата -----------------------------------------------

class TestPurge:
    def test_live_room_is_never_deleted(self, manager: RoomManager) -> None:
        """Дори запис с древна дата се пази, ако стаята е в паметта."""
        room, _, _ = manager.create_room("Иван", "red")
        _row(room.code, "active", age_days=999)
        assert manager.purge_old_saves() == {"finished": 0, "active": 0}
        assert room.code in _codes()

    def test_paused_game_survives_by_age(self, manager: RoomManager) -> None:
        """При пауза часовниците спират и нищо не се записва — датата
        остарява, докато играчите просто ги няма няколко дни."""
        _row("PAUSED", "active", age_days=999, paused=True)
        assert manager.purge_old_saves()["active"] == 0
        assert "PAUSED" in _codes()

    def test_old_abandoned_game_is_deleted(self, manager: RoomManager) -> None:
        _row("OLDGME", "active", age_days=settings.SAVE_RETENTION_DAYS + 1)
        assert manager.purge_old_saves()["active"] == 1
        assert "OLDGME" not in _codes()

    def test_recent_game_is_kept(self, manager: RoomManager) -> None:
        _row("FRESH1", "active", age_days=1)
        assert manager.purge_old_saves()["active"] == 0
        assert "FRESH1" in _codes()

    def test_finished_game_needs_its_result_archived_first(
        self, manager: RoomManager,
    ) -> None:
        """Без архивиран резултат изтриването би загубило партия завинаги."""
        _row("NOARCH", "finished", age_days=settings.FINISHED_RETENTION_DAYS + 1)
        assert manager.purge_old_saves()["finished"] == 0
        assert "NOARCH" in _codes()

        _archive("NOARCH")
        assert manager.purge_old_saves()["finished"] == 1
        assert "NOARCH" not in _codes()

    def test_recent_finished_game_is_kept(self, manager: RoomManager) -> None:
        _row("RECENT", "finished", age_days=0)
        _archive("RECENT")
        assert manager.purge_old_saves()["finished"] == 0


# --- Възстановяване при старт -------------------------------------------

class TestRestore:
    def test_stale_saves_are_not_restored(self, manager: RoomManager) -> None:
        _row("STALE1", "active", age_days=settings.RESTORE_MAX_AGE_DAYS + 1)
        assert manager.restore_active_games() == 0
        assert "STALE1" not in manager.rooms
