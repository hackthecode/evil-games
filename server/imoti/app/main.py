"""FastAPI приложение — HTTP страници, статични файлове и Socket.IO ASGI."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import socket_server
from .config import STATIC_DIR, TEMPLATES_DIR, settings
from .console import log_server_event
from .database import init_db
from .game.board import Board
from .room_manager import RoomManager

logger = logging.getLogger(__name__)

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def static_version(*paths: str) -> str:
    """Версия за статични файлове според последната им промяна.

    Приема и папки — обхожда ги рекурсивно. Така разделянето на стиловете и
    скриптовете на модули не изисква поддържане на списък тук; изпуснат файл
    означаваше кеш, който не се обновява след промяна.
    """
    versions = []
    for path in paths:
        target = STATIC_DIR / path
        try:
            if target.is_dir():
                versions.extend(
                    int(item.stat().st_mtime)
                    for item in target.rglob("*")
                    if item.is_file()
                )
            else:
                versions.append(int(target.stat().st_mtime))
        except OSError:
            continue
    return str(max(versions, default=0))


async def _housekeeping(manager: RoomManager) -> None:
    """Периодично изчистване на изоставени стаи и стари записи.

    Без този цикъл ``cleanup_idle_rooms`` не се викаше от никъде, а нищо
    не триеше от базата: записите се трупаха с месеци и всеки старт
    връщаше по 50 отдавна изоставени стаи в паметта.

    Самото триене е блокиращо (SQLite) и затова минава през executor —
    иначе би замразило всички игри за времето на заявката.
    """
    loop = asyncio.get_running_loop()
    while True:
        try:
            await asyncio.sleep(settings.CLEANUP_INTERVAL_SECONDS)
            evicted = manager.cleanup_idle_rooms()
            removed = await loop.run_in_executor(None, manager.purge_old_saves)
            if evicted or removed["active"] or removed["finished"]:
                log_server_event(
                    f"Изчистване: {evicted} стаи от паметта, "
                    f"{removed['finished']} завършени и {removed['active']} "
                    "незавършени записа от базата."
                )
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 — чистенето не бива да спира сървъра
            logger.exception("Грешка при периодичното изчистване.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Инициализация при стартиране: база, табло, възстановяване на игри."""
    init_db()
    board = Board.from_file(settings.BOARD_CONFIG)
    manager = RoomManager(board)
    restored = manager.restore_active_games()
    socket_server.manager = manager
    app.state.board = board
    app.state.manager = manager
    app.state.restored_games = restored
    if restored:
        log_server_event(f"Възстановени {restored} прекъснати игри.")
    housekeeping = asyncio.create_task(_housekeeping(manager))
    try:
        yield
    finally:
        housekeeping.cancel()
        try:
            await housekeeping
        except asyncio.CancelledError:
            pass
        # Допълнителна контролна точка при нормално затваряне. По време на
        # играта състоянието продължава да се записва след всяко действие.
        manager.checkpoint_active_games()


fastapi_app = FastAPI(title=settings.GAME_NAME, lifespan=lifespan)

# Скриптовете и стиловете са 648 KB чист текст и се свиват със 70%.
# Слоят стои върху FastAPI, а НЕ върху обвивката на Socket.IO: трафикът на
# сокета минава по /socket.io/ и никога не стига дотук, така че остава
# непокътнат — точно каквото искаме, той е и без това дребен и чест.
fastapi_app.add_middleware(GZipMiddleware, minimum_size=500)

fastapi_app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@fastapi_app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> HTMLResponse:
    """Начална страница: създаване/присъединяване към стая."""
    return templates.TemplateResponse(request, "index.html", {
        "game_name": settings.GAME_NAME,
        "static_version": static_version(
            "css/base.css", "css/lobby.css", "js/common.js", "js/lobby.js",
        ),  # лобито не зависи от игровите модули
    })


@fastapi_app.get("/game", response_class=HTMLResponse)
async def game(request: Request) -> HTMLResponse:
    """Игрови екран (лоби + игра в една страница, управлявана от JS)."""
    board: Board = request.app.state.board
    return templates.TemplateResponse(request, "game.html", {
        "game_name": settings.GAME_NAME,
        "board_json": board.to_client(),
        "static_version": static_version("css", "js"),
    })


@fastapi_app.get("/health")
async def health() -> dict:
    """Проверка на състоянието на сървъра."""
    manager: RoomManager = fastapi_app.state.manager
    return {
        "status": "ok",
        "game": settings.GAME_NAME,
        "rooms": len(manager.rooms),
    }


# Socket.IO обвива FastAPI приложението като ASGI middleware.
app = socketio.ASGIApp(socket_server.sio, other_asgi_app=fastapi_app)
