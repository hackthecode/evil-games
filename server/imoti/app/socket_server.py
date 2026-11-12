"""Socket.IO сървър — цялата multiplayer комуникация в реално време.

Всяко събитие валидира входа (Pydantic + security), проверява членството в
стаята и правата на играча, извиква авторитетния engine и излъчва резултата
към всички клиенти в стаята. Клиентът никога не определя игрови резултати.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import socketio
from pydantic import ValidationError

from .config import settings
from .console import log_connection, log_server_event
from .game.bots import choose_bot, play_bot_step
from .game.engine import GameError
from .game.state import Phase
from .room_manager import Room, RoomError, RoomManager
from .useragent import describe
from .schemas import (
    BidPayload,
    BotPayload,
    CardChoicePayload,
    ChatPayload,
    CreateRoomPayload,
    JoinRoomPayload,
    KickPayload,
    LoanPayload,
    MortgageDecisionPayload,
    GroupPayload,
    PositionPayload,
    ReconnectPayload,
    SettingsPayload,
    TradeCancelPayload,
    TradePayload,
    TradeResponsePayload,
)
from .security import (
    RateLimiter,
    client_ip,
    sanitize_chat,
    sanitize_gender_choice,
    sanitize_name,
    sanitize_room_code,
    sanitize_token_choice,
    verify_reconnect_token,
)

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_timeout=20,
    ping_interval=10,
)

# Задава се от main.py при стартиране.
manager: RoomManager | None = None

_rate_limiter = RateLimiter()
# sid → (room_code, player_id)
_sessions: dict[str, tuple[str, str]] = {}
# sid → каквото знаем за клиента (адрес, браузър, система, език...).
# Попълва се при connect, защото тогава още няма player_id — свързването
# с конкретния играч става при create/join/reconnect.
_clients: dict[str, dict[str, str]] = {}
# room_code → asyncio.Task, следяща лимита на хода
_turn_tasks: dict[str, asyncio.Task] = {}
_auction_tasks: dict[str, asyncio.Task] = {}
_bot_tasks: dict[str, asyncio.Task] = {}

# Най-често на толкова секунди се пише в базата. Между тях записите се
# обединяват — при срив се губят най-много толкова секунди игра, а на
# бот-партия това сваля записите от над един в секунда до един на три.
PERSIST_MIN_INTERVAL = 3.0
# room_code → кога последно е писано (monotonic) и евентуален отложен запис.
_last_write: dict[str, float] = {}
_pending_writes: dict[str, asyncio.Task] = {}

# Пауза между две бот-решения, за да са видими анимациите.
BOT_STEP_DELAY = 0.75
# Предпазен лимит срещу безкраен бот-цикъл при неочаквано състояние.
BOT_LOOP_MAX_STEPS = 120


def _get_manager() -> RoomManager:
    assert manager is not None, "RoomManager не е инициализиран"
    return manager


def _profile(sid: str) -> dict[str, str]:
    """Данните за връзката или празен запис, ако вече са изчистени."""
    return _clients.get(sid) or {}


def _adopt_profile(member: Any, sid: str) -> dict[str, str]:
    """Пренася данните от връзката върху члена на стаята и ги връща.

    Дотук се знаеше само адресът; браузърът и системата идват от същия
    ``connect`` и трябва да останат при играча, за да ги вижда домакинът и
    след като връзката се смени.
    """
    info = _profile(sid)
    member.ip = info.get("ip") or member.ip
    member.browser = info.get("browser", "") or member.browser
    member.system = info.get("system", "") or member.system
    member.device = info.get("device", "") or member.device
    member.language = info.get("language", "") or member.language
    member.connected_at = time.time()
    return info


def _console(event: str, room: Room, member: Any, sid: str | None = None,
             detail: str = "") -> None:
    """Отпечатва събитието в терминала на сървъра."""
    info = _profile(sid) if sid else {}
    log_connection(
        event,
        name=getattr(member, "name", "—"),
        ip=info.get("ip") or getattr(member, "ip", None) or "неизвестен",
        room=room.code,
        browser=info.get("browser") or getattr(member, "browser", ""),
        system=info.get("system") or getattr(member, "system", ""),
        device=info.get("device") or getattr(member, "device", ""),
        language=info.get("language") or getattr(member, "language", ""),
        transport=info.get("transport", ""),
        players=len([m for m in room.members.values() if m.connected]),
        detail=detail,
    )


# ----------------------------------------------------------------------
# Помощни функции
# ----------------------------------------------------------------------
async def _error(sid: str, message: str) -> None:
    """Изпраща съобщение за грешка само до извикващия."""
    await sio.emit("error_message", {"message": message}, to=sid)


def _session(sid: str) -> tuple[Room, str] | None:
    """Намира стаята и player_id за дадена връзка."""
    info = _sessions.get(sid)
    if info is None:
        return None
    room = _get_manager().rooms.get(info[0])
    if room is None:
        return None
    return room, info[1]


async def _broadcast_lobby(room: Room) -> None:
    await sio.emit("lobby_state", room.lobby_to_client(), room=room.code)


async def _send_connection_log(room: Room) -> None:
    """Изпраща конзолата на връзките САМО на домакина.

    Записите съдържат адреси и затова никога не тръгват по общия път на
    излъчване (``lobby_state`` / ``game_update``), който стига до всички.
    """
    host = room.host
    if host is None or not host.sid or not host.connected:
        return
    await sio.emit(
        "connection_log",
        {"entries": room.connection_log[-120:]},
        to=host.sid,
    )


_HISTORY_EVENT_TYPES = {
    "dice", "move", "card", "payment", "purchase", "auction_end",
    "build", "sell_improvement", "mortgage", "unmortgage", "sell_property", "loan_taken", "loan_repaid",
    "loan_interest",
    "trade_accepted", "ownership_transfer", "jail", "bankrupt", "turn",
    "mortgage_transfer", "mission_completed", "group_completed",
    "global_event_start", "global_event_end", "tax_amnesty",
    "auction_bid", "starting_order", "player_disconnected", "player_reconnected",
    "game_paused", "game_resumed",
}


def _record_event_history(room: Room, events: list[dict[str, Any]]) -> None:
    """Записва структурирани действия за подробния протокол на партията."""
    if room.engine is None:
        return
    state = room.engine.state
    latest_log_text: str | None = None
    for event in events:
        if event.get("type") == "log" and event.get("text"):
            latest_log_text = str(event["text"])
        if event.get("type") not in _HISTORY_EVENT_TYPES:
            continue
        entry = dict(event)
        entry["ts"] = time.time()
        entry["round"] = state.round_number
        entry["turn_player"] = event.get("player_id") or state.current_player_id
        if entry["type"] == "payment":
            reason = entry.get("reason")
            if not reason:
                for transaction in reversed(state.bank_transactions):
                    if (
                        transaction.get("from") == entry.get("from")
                        and transaction.get("to") == entry.get("to")
                        and transaction.get("amount") == entry.get("amount")
                    ):
                        reason = transaction.get("reason")
                        break
            reason = reason or "Паричен трансфер"
            # Същият списък се излъчва към клиентите след записването на
            # историята, затова добавяме причината и към оригиналното събитие.
            event["reason"] = reason
            entry["reason"] = reason
            description = entry.get("description") or latest_log_text or reason
            event["description"] = description
            entry["description"] = description
        state.event_history.append(entry)
    if len(state.event_history) > 500:
        state.event_history = state.event_history[-500:]


async def _broadcast_game(
    room: Room, events: list[dict[str, Any]] | None = None,
    full_for: str | None = None,
) -> None:
    """Излъчва персонализирано състояние, без да разкрива чужди мисии.

    ``full_for`` е sid на играч, който тъкмо влиза или се връща — само на
    него отива и игровият лог. За останалите той е излишен: те си го градят
    от самите събития, а препращането му тежеше близо 6 KB на обновяване.
    """
    mgr = _get_manager()
    if events and room.engine is not None:
        events = list(events) + room.engine.collect_social_events()
    if events:
        _record_event_history(room, events)
    for member in room.members.values():
        if not member.sid or not member.connected:
            continue
        state = mgr.game_state_for_client(
            room, member.player_id, full=member.sid == full_for,
        )
        if state is not None:
            await sio.emit(
                "game_update",
                {"events": events or [], "state": state},
                to=member.sid,
            )
    _ensure_turn_timer(room)
    _ensure_auction_timer(room)
    _ensure_bot_task(room)


def _ensure_bot_task(room: Room) -> None:
    if room.engine is None or room.engine.state.paused or choose_bot(room.engine) is None:
        return
    task = _bot_tasks.get(room.code)
    if task is None or task.done():
        _bot_tasks[room.code] = asyncio.create_task(_bot_loop(room.code))


async def _bot_loop(room_code: str) -> None:
    """Изпълнява решенията на ботовете с пауза за видими анимации.

    Излизането от цикъла спира бот-ходовете до следващото събитие в стаята
    (действие на играч или таймерът на хода), затова всеки изход се логва —
    иначе играта просто „замръзва" без следа в конзолата.
    """
    try:
        for _ in range(BOT_LOOP_MAX_STEPS):
            room = _get_manager().rooms.get(room_code)
            if room is None or room.engine is None:
                return
            while room.engine.state.paused:
                await asyncio.sleep(0.5)
                room = _get_manager().rooms.get(room_code)
                if room is None or room.engine is None:
                    return
            player_id = choose_bot(room.engine)
            if player_id is None:
                return
            await asyncio.sleep(BOT_STEP_DELAY)
            if room.engine.state.paused:
                continue
            try:
                events = play_bot_step(room.engine, player_id)
            except GameError:
                logger.warning(
                    "Стая %s: ботът %s прекъсна с GameError във фаза %s.",
                    room_code, player_id, room.engine.state.phase.name,
                    exc_info=True,
                )
                return
            except Exception:
                # Неочаквана грешка не бива да умира тихо: без този клон
                # цикълът спира без следа и играта „замръзва".
                logger.exception(
                    "Стая %s: неочаквана грешка в хода на бота %s (фаза %s).",
                    room_code, player_id, room.engine.state.phase.name,
                )
                return
            if not events:
                logger.warning(
                    "Стая %s: ботът %s не върна нито едно събитие във фаза %s "
                    "— няма ход, който да изиграе.",
                    room_code, player_id, room.engine.state.phase.name,
                )
                return
            room.touch()
            await _broadcast_game(room, events)
            await _persist_async(room)
        else:
            room = _get_manager().rooms.get(room_code)
            phase = (
                room.engine.state.phase.name
                if room is not None and room.engine is not None
                else "неизвестна"
            )
            logger.warning(
                "Стая %s: бот-цикълът достигна лимита от %d стъпки във фаза %s "
                "и спира. Ботовете чакат следващото събитие в стаята.",
                room_code, BOT_LOOP_MAX_STEPS, phase,
            )
    finally:
        _bot_tasks.pop(room_code, None)


# ----------------------------------------------------------------------
# Лимит на хода: сървърен таймер, който пропуска AFK играчи
# ----------------------------------------------------------------------
def _ensure_turn_timer(room: Room) -> None:
    """Стартира задачата-часовник за стаята, ако има лимит и няма задача."""
    if room.engine is None:
        return
    state = room.engine.state
    if state.settings.turn_time_limit <= 0 or state.phase == Phase.GAME_OVER:
        return
    task = _turn_tasks.get(room.code)
    if task is None or task.done():
        _turn_tasks[room.code] = asyncio.create_task(_turn_timer(room.code))


async def _turn_timer(room_code: str) -> None:
    """Следи срока на текущия ход и го пропуска при изтичане."""
    mgr = _get_manager()
    try:
        while True:
            room = mgr.rooms.get(room_code)
            if room is None or room.engine is None:
                return
            state = room.engine.state
            if state.phase == Phase.GAME_OVER:
                return
            if state.paused:
                await asyncio.sleep(0.5)
                continue
            if state.settings.turn_time_limit <= 0 or not state.turn_deadline:
                return
            remaining = state.turn_deadline - time.time()
            if remaining <= 0:
                # По време на търг ходът не се пропуска — часовникът изчаква.
                if state.phase == Phase.AWAITING_AUCTION:
                    room.engine.touch_turn_clock()
                    await asyncio.sleep(1.0)
                    continue
                # Ако никой не е свързан, не въртим пропускания в празна стая —
                # отлагаме срока, докато някой се върне.
                if not any(m.connected for m in room.members.values()):
                    room.engine.touch_turn_clock()
                    await asyncio.sleep(5.0)
                    continue
                current = state.current_player_id
                if current is None:
                    return
                try:
                    # Изигран, но неприключен ход завършва нормално; само ход
                    # без никакво действие се брои за пропуснат (неактивност).
                    if state.phase == Phase.MANAGEMENT and state.debt is None:
                        events = room.engine.auto_end_turn(current)
                    else:
                        events = room.engine.force_skip_turn(current, timed_out=True)
                except GameError:
                    return
                mgr_room = mgr.rooms.get(room_code)
                if mgr_room is None:
                    return
                await _broadcast_game(mgr_room, events)
                await _persist_async(mgr_room)
                continue
            await asyncio.sleep(min(remaining, 1.0))
    finally:
        _turn_tasks.pop(room_code, None)


# ----------------------------------------------------------------------
# Търгове: отделен сървърен таймер, подновяван от всяка валидна оферта
# ----------------------------------------------------------------------
def _ensure_auction_timer(room: Room) -> None:
    if room.engine is None or room.engine.state.auction is None:
        return
    task = _auction_tasks.get(room.code)
    if task is None or task.done():
        _auction_tasks[room.code] = asyncio.create_task(_auction_timer(room.code))


async def _auction_timer(room_code: str) -> None:
    """Приключва търга по авторитетния срок от сървъра."""
    try:
        while True:
            room = _get_manager().rooms.get(room_code)
            if room is None or room.engine is None:
                return
            state = room.engine.state
            auction = state.auction
            if auction is None or state.phase != Phase.AWAITING_AUCTION:
                return
            if state.paused:
                await asyncio.sleep(0.5)
                continue
            if not any(member.connected for member in room.members.values()):
                auction.ends_at = time.time() + state.settings.auction_seconds
                await asyncio.sleep(5.0)
                continue
            remaining = auction.ends_at - time.time()
            if remaining > 0:
                await asyncio.sleep(min(remaining, 0.5))
                continue
            try:
                events = room.engine.finish_auction()
            except GameError:
                return
            room.touch()
            await _broadcast_game(room, events)
            await _persist_async(room)
            # Възможно е веднага да е стартирал следващ търг от опашката.
            if room.engine.state.auction is None:
                return
    finally:
        _auction_tasks.pop(room_code, None)


def _write_snapshot(snapshot: tuple[str, str, str, str]) -> None:
    """Записва вече готовата снимка в базата (тече в нишка на executor-а)."""
    try:
        _get_manager().write_saved_game(*snapshot)
    except Exception:  # noqa: BLE001 — записът не бива да събаря играта
        pass


def _write_result(result: tuple[str, float, str, str, int, str]) -> None:
    """Записва резултата от завършена партия (в нишка на executor-а)."""
    try:
        _get_manager().write_game_result(*result)
    except Exception:  # noqa: BLE001 — архивът не бива да събаря играта
        logger.exception("Резултатът от партията не беше записан.")


async def _write_now(room: Room) -> None:
    """Записва състоянието веднага, без отлагане."""
    mgr = _get_manager()
    if room.engine is None:
        return
    status = "finished" if room.engine.state.winner else "active"
    snapshot = mgr.serialize_room(room, status=status)
    if snapshot is None:
        return
    _last_write[room.code] = time.monotonic()
    loop = asyncio.get_event_loop()
    # Резултатът се вади също синхронно (чете живото състояние) и се
    # записва веднъж на партия — оттам нататък пълното състояние вече не
    # е нужно и подлежи на изчистване.
    result = mgr.build_result(room) if status == "finished" else None
    await loop.run_in_executor(None, _write_snapshot, snapshot)
    if result is not None:
        await loop.run_in_executor(None, _write_result, result)


async def _deferred_write(room_code: str, delay: float) -> None:
    """Изчаква и записва — така поредица от бързи ходове дава един запис."""
    try:
        await asyncio.sleep(delay)
        room = _get_manager().rooms.get(room_code)
        if room is not None:
            await _write_now(room)
    except asyncio.CancelledError:
        raise
    except Exception:  # noqa: BLE001 — записът не бива да събаря играта
        logger.exception("Отложеният запис на стая %s се провали.", room_code)
    finally:
        _pending_writes.pop(room_code, None)


async def _persist_async(room: Room, force: bool = False) -> None:
    """Персистира без разкъсана снимка и без излишни записи.

    Сериализацията става синхронно в event loop-а — така снимката е
    консистентна спрямо игровото състояние. В отделната нишка отива само
    самият запис в SQLite, който не докосва живото състояние.

    Записът тежи около 59 KB, а при бот-партия действията валят на всеки
    0.75 s. Затова честите ходове се обединяват: ако наскоро е писано,
    записът се отлага и се заменя от следващия — така поредица от бързи
    ходове дава един запис вместо десет.

    ``force`` заобикаля обединяването. Задължително е за краевите моменти:
    при завършена партия оттук се архивира и резултатът, а флагът
    ``result_archived`` живее в паметта — отложен запис, който така и не се
    случи, би загубил партията за класацията.
    """
    if room.engine is None:
        return
    if force or room.engine.state.winner is not None:
        pending = _pending_writes.pop(room.code, None)
        if pending is not None:
            pending.cancel()
        await _write_now(room)
        return

    since = time.monotonic() - _last_write.get(room.code, 0.0)
    if since >= PERSIST_MIN_INTERVAL:
        await _write_now(room)
        return
    # Наскоро е писано: отлагаме и заменяме евентуалния предишен отложен
    # запис, за да не се трупат.
    pending = _pending_writes.pop(room.code, None)
    if pending is not None:
        pending.cancel()
    _pending_writes[room.code] = asyncio.create_task(
        _deferred_write(room.code, PERSIST_MIN_INTERVAL - since)
    )


def _check_rate(sid: str) -> bool:
    return _rate_limiter.allow(sid)


async def _run_action(sid: str, action, *args, persist: bool = True) -> bool:
    """Обвивка за игрово действие: валидация, изпълнение, излъчване, запис."""
    info = _session(sid)
    if info is None:
        await _error(sid, "Не сте в стая.")
        return False
    room, player_id = info
    if room.engine is None:
        await _error(sid, "Играта не е започнала.")
        return False
    if room.engine.state.paused:
        await _error(sid, "Играта е на пауза. Изчакайте домакина да я възобнови.")
        return False
    try:
        events = action(room.engine, player_id, *args)
    except GameError as exc:
        await _error(sid, str(exc))
        return False
    room.touch()
    await _broadcast_game(room, events)
    if persist:
        await _persist_async(room)
    return True


# ----------------------------------------------------------------------
# Свързване / изключване
# ----------------------------------------------------------------------
@sio.event
async def connect(sid: str, environ: dict) -> None:
    """Нова връзка — изчаква create_room / join_room / reconnect_room.

    Тук се събира всичко, което ASGI средата знае за госта: адрес,
    браузър, система, език. При ``connect`` играчът още няма име и стая,
    а при ``disconnect`` средата вече не е достъпна — затова данните се
    пазят по ``sid`` и се допълват с името при влизането му в стая.
    """
    profile = describe(environ.get("HTTP_USER_AGENT"))
    language = str(environ.get("HTTP_ACCEPT_LANGUAGE", "") or "").split(",")[0]
    query = str(environ.get("QUERY_STRING", "") or "")
    _clients[sid] = {
        "ip": client_ip(environ),
        "browser": profile["browser"],
        "system": profile["system"],
        "device": profile["device"],
        "user_agent": profile["raw"],
        "language": language,
        # polling или websocket — полезно при оплаквания от бавна игра.
        "transport": "websocket" if "transport=websocket" in query else "polling",
    }


@sio.event
async def connection_probe(sid: str, data: Any = None) -> dict[str, float]:
    """Лек отговор за измерване на реалното закъснение до сървъра."""
    return {"server_time": time.time()}


@sio.event
async def disconnect(sid: str) -> None:
    """Изключване: пазим мястото на играча за grace период."""
    _rate_limiter.forget(sid)
    info = _session(sid)
    # Данните се четат ПРЕДИ изваждането — иначе записът остава без тях.
    profile = dict(_profile(sid))
    _clients.pop(sid, None)
    _sessions.pop(sid, None)
    if info is None:
        return
    room, player_id = info
    member = room.members.get(player_id)
    if member is None or member.sid != sid:
        return
    mgr = _get_manager()
    mgr.mark_disconnected(room, member)
    room.record_connection("disconnect", member, ip=profile.get("ip"))
    # Преходът от лобито към игровата страница затваря сокета и веднага
    # отваря нов. Без това разграничение конзолата показваше „загубена
    # връзка" при всяко влизане — шум, който крие истинските прекъсвания.
    brief = time.time() - member.connected_at < 5
    log_connection(
        "reload" if brief else "disconnect",
        name=member.name, ip=profile.get("ip") or member.ip or "неизвестен",
        room=room.code,
        players=len([m for m in room.members.values() if m.connected]),
        detail="" if brief else ("играта продължава" if room.started else ""),
    )
    await _send_connection_log(room)
    if room.started:
        await _broadcast_game(room, [
            {"type": "log", "text": f"{member.name} загуби връзка.",
             "kind": "warning", "ts": time.time()},
            {"type": "player_disconnected", "player_id": player_id,
             "name": member.name},
        ])
        await _persist_async(room, force=True)
    await _broadcast_lobby(room)


# ----------------------------------------------------------------------
# Стаи: създаване, присъединяване, reconnect
# ----------------------------------------------------------------------
@sio.event
async def create_room(sid: str, data: Any) -> None:
    if not _check_rate(sid):
        return await _error(sid, "Твърде много заявки — изчакайте.")
    try:
        payload = CreateRoomPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидни данни.")
    name = sanitize_name(payload.name)
    token = sanitize_token_choice(payload.token) or "red"
    gender = sanitize_gender_choice(payload.gender) or "male"
    if name is None:
        return await _error(sid, "Невалидно име (1–20 знака).")

    mgr = _get_manager()
    try:
        room, member, reconnect = mgr.create_room(
            name, token, gender, initial_settings=payload.settings,
        )
    except RoomError as exc:
        return await _error(sid, str(exc))

    member.sid = sid
    _adopt_profile(member, sid)
    _sessions[sid] = (room.code, member.player_id)
    room.record_connection("create", member, detail="създава стаята")
    _console("create", room, member, sid)
    await sio.enter_room(sid, room.code)
    await sio.emit("room_joined", {
        "room_code": room.code,
        "player_id": member.player_id,
        "reconnect_token": reconnect,
        "is_host": True,
    }, to=sid)
    await _broadcast_lobby(room)
    await _send_connection_log(room)


@sio.event
async def join_room(sid: str, data: Any) -> None:
    if not _check_rate(sid):
        return await _error(sid, "Твърде много заявки — изчакайте.")
    try:
        payload = JoinRoomPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидни данни.")
    code = sanitize_room_code(payload.room_code)
    name = sanitize_name(payload.name)
    token = sanitize_token_choice(payload.token) or "red"
    gender = sanitize_gender_choice(payload.gender) or "male"
    if code is None:
        return await _error(sid, "Невалиден код на стая.")
    if name is None:
        return await _error(sid, "Невалидно име (1–20 знака).")

    mgr = _get_manager()
    try:
        room, member, reconnect = mgr.join_room(
            code, name, token, gender,
            password=payload.password,
            as_spectator=payload.as_spectator,
        )
    except RoomError as exc:
        return await _error(sid, str(exc))

    member.sid = sid
    _adopt_profile(member, sid)
    _sessions[sid] = (room.code, member.player_id)
    role = "зрител" if member.is_spectator else "играч"
    room.record_connection("join", member, detail=role)
    _console("join", room, member, sid, detail=f"влиза като {role}")
    await sio.enter_room(sid, room.code)
    await sio.emit("room_joined", {
        "room_code": room.code,
        "player_id": member.player_id,
        "reconnect_token": reconnect,
        "is_host": member.is_host,
        "is_spectator": member.is_spectator,
        "started": room.started,
    }, to=sid)
    await _broadcast_lobby(room)
    await _send_connection_log(room)
    if room.started:
        # Само влизащият получава и игровия лог.
        await _broadcast_game(room, full_for=sid)


@sio.event
async def reconnect_room(sid: str, data: Any) -> None:
    """Повторно свързване чрез reconnect токен от localStorage."""
    if not _check_rate(sid):
        return await _error(sid, "Твърде много заявки — изчакайте.")
    try:
        payload = ReconnectPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидни данни.")
    verified = verify_reconnect_token(payload.reconnect_token)
    if verified is None:
        return await _error(sid, "Невалиден токен за повторно свързване.")
    code, player_id = verified

    mgr = _get_manager()
    found = mgr.find_member(code, player_id)
    if found is None:
        return await sio.emit("reconnect_failed", {}, to=sid)
    room, member = found

    # Затваряме старата връзка, ако има такава.
    if member.sid and member.sid != sid:
        _sessions.pop(member.sid, None)

    mgr.mark_reconnected(room, member, sid)
    _sessions[sid] = (room.code, member.player_id)
    previous_ip = member.ip
    _adopt_profile(member, sid)
    # Смяната на адрес е полезна следа за домакина (друга мрежа/устройство).
    changed = previous_ip and member.ip and previous_ip != member.ip
    detail = f"предишен адрес: {previous_ip}" if changed else ""
    room.record_connection("reconnect", member, detail=detail)
    _console("reconnect", room, member, sid, detail=detail)
    await sio.enter_room(sid, room.code)
    await sio.emit("room_joined", {
        "room_code": room.code,
        "player_id": member.player_id,
        "reconnect_token": payload.reconnect_token,
        "is_host": member.is_host,
        "is_spectator": member.is_spectator,
        "started": room.started,
        "reconnected": True,
    }, to=sid)
    await _broadcast_lobby(room)
    await _send_connection_log(room)
    if room.started:
        await _broadcast_game(room, [
            {"type": "log", "text": f"{member.name} се върна в играта.",
             "kind": "info", "ts": time.time()},
            {"type": "player_reconnected", "player_id": player_id,
             "name": member.name},
        ], full_for=sid)   # връщащият се получава и натрупания лог
        await _persist_async(room)


@sio.event
async def leave_room(sid: str, data: Any = None) -> None:
    info = _session(sid)
    if info is None:
        return
    room, player_id = info
    member = room.members.get(player_id)
    if member is None:
        return
    mgr = _get_manager()
    # Записът се прави преди напускането, докато членът още е в стаята.
    room.record_connection("leave", member, detail="напуска доброволно")
    _console("leave", room, member, sid, detail="напуска доброволно")
    events = mgr.leave_room(room, member)
    _sessions.pop(sid, None)
    await sio.leave_room(sid, room.code)
    await sio.emit("left_room", {}, to=sid)
    if room.code in mgr.rooms:
        await _broadcast_lobby(room)
        await _send_connection_log(room)
        if room.started and events:
            await _broadcast_game(room, events)
            await _persist_async(room, force=True)


# ----------------------------------------------------------------------
# Лоби
# ----------------------------------------------------------------------
@sio.event
async def set_ready(sid: str, data: Any) -> None:
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    if member is None:
        return
    try:
        _get_manager().set_ready(room, member, bool((data or {}).get("ready")))
    except RoomError as exc:
        return await _error(sid, str(exc))
    await _broadcast_lobby(room)


@sio.event
async def set_token(sid: str, data: Any) -> None:
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    token = sanitize_token_choice((data or {}).get("token"))
    if member is None or token is None:
        return await _error(sid, "Невалидна фигурка.")
    try:
        _get_manager().set_token(room, member, token)
    except RoomError as exc:
        return await _error(sid, str(exc))
    await _broadcast_lobby(room)


@sio.event
async def set_gender(sid: str, data: Any) -> None:
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    gender = sanitize_gender_choice((data or {}).get("gender"))
    if member is None or gender is None:
        return await _error(sid, "Невалиден избор на пол.")
    try:
        _get_manager().set_gender(room, member, gender)
    except RoomError as exc:
        return await _error(sid, str(exc))
    await _broadcast_lobby(room)


@sio.event
async def set_appearance(sid: str, data: Any) -> None:
    """Смяна на кожа, коса или прическа. Приема само променените полета."""
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    if member is None or not isinstance(data, dict):
        return await _error(sid, "Невалиден избор на външност.")
    try:
        _get_manager().set_appearance(room, member, data)
    except RoomError as exc:
        return await _error(sid, str(exc))
    await _broadcast_lobby(room)


@sio.event
async def add_bot(sid: str, data: Any) -> None:
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    if member is None:
        return
    try:
        payload = BotPayload.model_validate(data or {})
        _get_manager().add_bot(room, member, payload.style)
    except ValidationError:
        return await _error(sid, "Невалиден стил на бот.")
    except RoomError as exc:
        return await _error(sid, str(exc))
    await _broadcast_lobby(room)


@sio.event
async def remove_bot(sid: str, data: Any) -> None:
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    if member is None:
        return
    try:
        payload = KickPayload.model_validate(data or {})
        _get_manager().remove_bot(room, member, payload.player_id)
    except ValidationError:
        return await _error(sid, "Невалиден бот.")
    except RoomError as exc:
        return await _error(sid, str(exc))
    await _broadcast_lobby(room)


@sio.event
async def update_settings(sid: str, data: Any) -> None:
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    if member is None:
        return
    try:
        payload = SettingsPayload.model_validate(data or {})
        _get_manager().update_settings(room, member, payload.settings)
    except ValidationError:
        return await _error(sid, "Невалидни настройки.")
    except RoomError as exc:
        return await _error(sid, str(exc))
    await _broadcast_lobby(room)


@sio.event
async def transfer_host(sid: str, data: Any) -> None:
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    if member is None:
        return
    try:
        payload = KickPayload.model_validate(data or {})
        _get_manager().transfer_host(room, member, payload.player_id)
    except ValidationError:
        return await _error(sid, "Невалидни данни.")
    except RoomError as exc:
        return await _error(sid, str(exc))
    await _broadcast_lobby(room)


@sio.event
async def start_game(sid: str, data: Any = None) -> None:
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    if member is None:
        return
    try:
        events = _get_manager().start_game(room, member)
    except RoomError as exc:
        return await _error(sid, str(exc))
    await sio.emit("game_started", {}, room=room.code)
    await _broadcast_lobby(room)
    await _broadcast_game(room, events)


@sio.event
async def rematch(sid: str, data: Any = None) -> None:
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    if member is None:
        return
    try:
        events = _get_manager().rematch(room, member)
    except RoomError as exc:
        return await _error(sid, str(exc))
    await sio.emit("game_started", {"rematch": True}, room=room.code)
    await _broadcast_lobby(room)
    await _broadcast_game(room, events)


# ----------------------------------------------------------------------
# Чат
# ----------------------------------------------------------------------
@sio.event
async def chat_message(sid: str, data: Any) -> None:
    if not _check_rate(sid):
        return await _error(sid, "Твърде много съобщения — изчакайте.")
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    if member is None:
        return
    try:
        payload = ChatPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидно съобщение.")
    text = sanitize_chat(payload.text)
    if text is None:
        return await _error(sid, "Невалидно съобщение.")
    await sio.emit("chat_message", {
        "from": member.name,
        "player_id": member.player_id,
        "text": text,
        "ts": time.time(),
    }, room=room.code)


# ----------------------------------------------------------------------
# Игрови действия
# ----------------------------------------------------------------------
@sio.event
async def roll_dice(sid: str, data: Any = None) -> None:
    if not _check_rate(sid):
        return await _error(sid, "Твърде много заявки.")
    await _run_action(sid, lambda eng, pid: eng.roll_dice(pid))


@sio.event
async def buy_property(sid: str, data: Any = None) -> None:
    await _run_action(sid, lambda eng, pid: eng.buy_property(pid))


@sio.event
async def decline_purchase(sid: str, data: Any = None) -> None:
    await _run_action(sid, lambda eng, pid: eng.decline_purchase(pid))


@sio.event
async def place_bid(sid: str, data: Any) -> None:
    if not _check_rate(sid):
        return await _error(sid, "Твърде много заявки.")
    try:
        payload = BidPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидна сума.")
    await _run_action(
        sid, lambda eng, pid: eng.place_bid(pid, payload.amount, payload.position)
    )


@sio.event
async def withdraw_auction(sid: str, data: Any = None) -> None:
    await _run_action(sid, lambda eng, pid: eng.withdraw_auction(pid))


@sio.event
async def build_improvement(sid: str, data: Any) -> None:
    try:
        payload = PositionPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидна позиция.")
    await _run_action(sid, lambda eng, pid: eng.build_improvement(pid, payload.position))


@sio.event
async def build_group(sid: str, data: Any) -> None:
    try:
        payload = GroupPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидна група.")
    await _run_action(sid, lambda eng, pid: eng.build_group(pid, payload.group))


@sio.event
async def sell_improvement(sid: str, data: Any) -> None:
    try:
        payload = PositionPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидна позиция.")
    await _run_action(sid, lambda eng, pid: eng.sell_improvement(pid, payload.position))


@sio.event
async def sell_group(sid: str, data: Any) -> None:
    try:
        payload = GroupPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидна група.")
    await _run_action(sid, lambda eng, pid: eng.sell_group(pid, payload.group))


@sio.event
async def take_loan(sid: str, data: Any) -> None:
    """Теглене на банков заем срещу залог на портфейла."""
    try:
        payload = LoanPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидна сума за заем.")
    await _run_action(sid, lambda eng, pid: eng.take_loan(pid, payload.amount))


@sio.event
async def repay_loan(sid: str, data: Any = None) -> None:
    """Погасяване на заема — цялата сума или зададена част."""
    amount = None
    if isinstance(data, dict) and data.get("amount") is not None:
        try:
            amount = LoanPayload.model_validate(data).amount
        except ValidationError:
            return await _error(sid, "Невалидна сума за погасяване.")
    await _run_action(sid, lambda eng, pid: eng.repay_loan(pid, amount))


@sio.event
async def sell_property_to_bank(sid: str, data: Any) -> None:
    """Продажба на имот обратно на банката за 80% от цената."""
    try:
        payload = PositionPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидна позиция.")
    await _run_action(
        sid, lambda eng, pid: eng.sell_property_to_bank(pid, payload.position)
    )


@sio.event
async def mortgage_property(sid: str, data: Any) -> None:
    try:
        payload = PositionPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидна позиция.")
    await _run_action(sid, lambda eng, pid: eng.mortgage_property(pid, payload.position))


@sio.event
async def unmortgage_property(sid: str, data: Any) -> None:
    try:
        payload = PositionPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидна позиция.")
    await _run_action(sid, lambda eng, pid: eng.unmortgage_property(pid, payload.position))


@sio.event
async def auction_own_property(sid: str, data: Any) -> None:
    try:
        payload = PositionPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидна позиция.")
    await _run_action(sid, lambda eng, pid: eng.auction_own_property(pid, payload.position))


@sio.event
async def pay_jail_fee(sid: str, data: Any = None) -> None:
    await _run_action(sid, lambda eng, pid: eng.pay_jail_fee(pid))


@sio.event
async def use_jail_card(sid: str, data: Any = None) -> None:
    await _run_action(sid, lambda eng, pid: eng.use_jail_card(pid))


@sio.event
async def settle_debt(sid: str, data: Any = None) -> None:
    await _run_action(sid, lambda eng, pid: eng.settle_debt(pid))


@sio.event
async def settle_debt_with_plan(sid: str, data: Any = None) -> None:
    await _run_action(sid, lambda eng, pid: eng.settle_debt_with_plan(pid))


@sio.event
async def raise_funds(sid: str, data: Any = None) -> None:
    """Изпълнява целия план за набавяне на средства, дори да не стига."""
    await _run_action(sid, lambda eng, pid: eng.raise_funds(pid))


@sio.event
async def declare_bankruptcy(sid: str, data: Any = None) -> None:
    await _run_action(sid, lambda eng, pid: eng.declare_bankruptcy(pid))


@sio.event
async def resolve_card_choice(sid: str, data: Any) -> None:
    """Избор по изтеглена карта: сигурният вариант или залогът на зара."""
    try:
        payload = CardChoicePayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалиден избор.")
    await _run_action(
        sid, lambda eng, pid: eng.resolve_card_choice(pid, payload.option)
    )


@sio.event
async def resolve_mortgage_transfer(sid: str, data: Any) -> None:
    try:
        payload = MortgageDecisionPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалиден избор на ипотеки.")
    await _run_action(
        sid,
        lambda eng, pid: eng.resolve_mortgage_transfer(pid, payload.positions),
    )


@sio.event
async def end_turn(sid: str, data: Any = None) -> None:
    await _run_action(sid, lambda eng, pid: eng.end_turn(pid))


# ----------------------------------------------------------------------
# Сделки
# ----------------------------------------------------------------------
@sio.event
async def create_trade(sid: str, data: Any) -> None:
    if not _check_rate(sid):
        return await _error(sid, "Твърде много заявки.")
    try:
        payload = TradePayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидна оферта.")
    await _run_action(
        sid,
        lambda eng, pid: eng.create_trade(
            pid,
            payload.to_player,
            offer_cash=payload.offer_cash,
            offer_properties=payload.offer_properties,
            offer_jail_cards=payload.offer_jail_cards,
            request_cash=payload.request_cash,
            request_properties=payload.request_properties,
            request_jail_cards=payload.request_jail_cards,
            counter_of=payload.counter_of,
        ),
    )


@sio.event
async def respond_trade(sid: str, data: Any) -> None:
    try:
        payload = TradeResponsePayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалиден отговор.")
    await _run_action(
        sid, lambda eng, pid: eng.respond_trade(pid, payload.trade_id, payload.accept)
    )


@sio.event
async def cancel_trade(sid: str, data: Any) -> None:
    try:
        payload = TradeCancelPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидни данни.")
    await _run_action(sid, lambda eng, pid: eng.cancel_trade(pid, payload.trade_id))


# ----------------------------------------------------------------------
# Действия на домакина по време на игра
# ----------------------------------------------------------------------
def _require_host(room: Room, player_id: str) -> bool:
    member = room.members.get(player_id)
    return member is not None and member.is_host


@sio.event
async def host_toggle_pause(sid: str, data: Any = None) -> None:
    """Домакинът поставя партията на пауза или я възобновява."""
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    member = room.members.get(player_id)
    if member is None or not member.is_host:
        return await _error(sid, "Само домакинът управлява паузата.")
    if room.engine is None:
        return await _error(sid, "Играта не е започнала.")
    mgr = _get_manager()
    try:
        events = (
            mgr.resume_game(room, member)
            if room.engine.state.paused else mgr.pause_game(room, member)
        )
    except RoomError as exc:
        return await _error(sid, str(exc))
    await _broadcast_game(room, events)
    await _persist_async(room, force=True)


@sio.event
async def host_skip_turn(sid: str, data: Any) -> None:
    """Домакинът пропуска хода на изключен играч."""
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    if not _require_host(room, player_id):
        return await _error(sid, "Само домакинът може да пропуска ходове.")
    if room.engine is None:
        return await _error(sid, "Играта не е започнала.")
    if room.engine.state.paused:
        return await _error(sid, "Първо възобновете играта.")
    try:
        payload = KickPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидни данни.")
    target = room.members.get(payload.player_id)
    if target is None:
        return await _error(sid, "Играчът не е в стаята.")
    # Обикновеният бутон върху картата важи само за изключен играч. От
    # администраторския панел домакинът пропуска и свързан играч (заспал,
    # отишъл до кухнята) — там действието минава през потвърждение.
    if target.connected and not payload.force:
        return await _error(sid, "Може да пропускате само хода на изключен играч.")
    try:
        events = room.engine.force_skip_turn(payload.player_id)
    except GameError as exc:
        return await _error(sid, str(exc))
    await _broadcast_game(room, events)
    await _persist_async(room)


@sio.event
async def host_remove_player(sid: str, data: Any) -> None:
    """Домакинът премахва изключен или два пъти неактивен играч."""
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    if not _require_host(room, player_id):
        return await _error(sid, "Само домакинът може да премахва играчи.")
    if room.engine is not None and room.engine.state.paused:
        return await _error(sid, "Първо възобновете играта.")
    try:
        payload = KickPayload.model_validate(data or {})
    except ValidationError:
        return await _error(sid, "Невалидни данни.")
    mgr = _get_manager()
    host = room.members.get(player_id)
    if host is None:
        return await _error(sid, "Домакинът не е в стаята.")
    try:
        target, events = mgr.remove_member_by_host(
            room, host, payload.player_id, force=payload.force,
        )
    except RoomError as exc:
        return await _error(sid, str(exc))
    room.record_connection(
        "kick", target, detail=f"премахнат от {host.name}",
    )
    _console("kick", room, target, target.sid, detail=f"премахнат от {host.name}")
    if target.sid:
        _sessions.pop(target.sid, None)
        _clients.pop(target.sid, None)
        await sio.emit("kicked", {}, to=target.sid)
        await sio.leave_room(target.sid, room.code)
    await _broadcast_lobby(room)
    await _send_connection_log(room)
    if room.started and events:
        await _broadcast_game(room, events)
        await _persist_async(room, force=True)


@sio.event
async def host_save_game(sid: str, data: Any = None) -> None:
    """Ръчно записване от домакина."""
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    if not _require_host(room, player_id):
        return await _error(sid, "Само домакинът може да записва играта.")
    if room.engine is None:
        return await _error(sid, "Няма активна игра за записване.")
    await _persist_async(room, force=True)
    await sio.emit("game_saved", {"ok": True}, to=sid)


@sio.event
async def host_connection_log(sid: str, data: Any = None) -> None:
    """Домакинът иска конзолата на връзките.

    Записите съдържат адреси, затова отговорът е само към заявителя и само
    ако той наистина е домакин.
    """
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    if not _require_host(room, player_id):
        return await _error(sid, "Конзолата е достъпна само за домакина.")
    await sio.emit(
        "connection_log",
        {"entries": room.connection_log[-120:]},
        to=sid,
    )


@sio.event
async def host_end_game(sid: str, data: Any = None) -> None:
    """Домакинът приключва партията предсрочно — печели най-богатият."""
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    if not _require_host(room, player_id):
        return await _error(sid, "Само домакинът може да приключи партията.")
    if room.engine is None:
        return await _error(sid, "Играта не е започнала.")
    if room.engine.state.paused:
        return await _error(sid, "Първо възобновете играта.")
    try:
        events = room.engine.end_game_early()
    except GameError as exc:
        return await _error(sid, str(exc))
    await _broadcast_game(room, events)
    await _persist_async(room)


@sio.event
async def request_state(sid: str, data: Any = None) -> None:
    """Клиентът иска пълна синхронизация на състоянието."""
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, player_id = info
    await sio.emit("lobby_state", room.lobby_to_client(), to=sid)
    if room.started:
        # Ръчна синхронизация — тук логът е нужен.
        state = _get_manager().game_state_for_client(room, player_id, full=True)
        await sio.emit("game_update", {"events": [], "state": state}, to=sid)


@sio.event
async def request_history(sid: str, data: Any = None) -> None:
    """Подробният протокол на партията — по заявка.

    Тежи около 21 KB и се чете само когато играчът отвори прозореца с
    историята. Изпращането му при всяко действие беше две трети от целия
    трафик на играта.
    """
    if not _check_rate(sid):
        return await _error(sid, "Твърде много заявки.")
    info = _session(sid)
    if info is None:
        return await _error(sid, "Не сте в стая.")
    room, _ = info
    if room.engine is None:
        return
    await sio.emit(
        "game_history",
        {"entries": list(room.engine.state.event_history[-250:])},
        to=sid,
    )
