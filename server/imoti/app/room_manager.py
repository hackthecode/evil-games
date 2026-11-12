"""Управление на стаите: лоби, играчи, reconnect, запис и възстановяване."""
from __future__ import annotations

import json
import random
import time
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import text

from .config import settings
from .database import get_session
from .game.board import Board
from .game.engine import GameEngine, GameError
from .game.player import Player
from .game.rules import GameSettings, apply_rules_preset, validate_settings_update
from .game.serialization import (
    SaveFormatError,
    state_from_dict,
    state_to_client,
    state_to_dict,
)
from .models import GameResult, SavedGame
from .security import (
    ALLOWED_GENDERS,
    ALLOWED_TOKENS,
    APPEARANCE_OPTIONS,
    generate_player_id,
    generate_room_code,
    make_reconnect_token,
    sanitize_appearance,
    sanitize_token_choice,
)


# Имена на компютърните играчи. Стилът („търговец“, „предпазлив“...) вече се
# изписва на отделен ред под името, затова името е лично и кратко — иначе
# всички ботове се изрязват до „Търговец б…“ и стават неразличими.
BOT_NAMES_MALE = (
    "Борис", "Георги", "Петър", "Стефан", "Николай", "Тодор",
    "Иван", "Асен", "Момчил", "Владимир",
)
BOT_NAMES_FEMALE = (
    "Мария", "Елена", "Ния", "Дора", "Ралица", "Веска",
    "Калина", "Ивайла", "Стефка", "Лиляна",
)


@dataclass
class RoomMember:
    """Член на стая (в лобито и в играта)."""

    player_id: str
    name: str
    token: str = "red"
    gender: str = "male"
    # Външност на човечето — вж. security.APPEARANCE_OPTIONS.
    skin: str = "fair"
    hair: str = "brown"
    hairstyle: str = "short"
    ready: bool = False
    is_host: bool = False
    is_spectator: bool = False
    connected: bool = True
    sid: str | None = None  # текущата Socket.IO връзка
    disconnected_at: float | None = None
    paused_disconnect_remaining: float | None = None
    is_bot: bool = False
    bot_style: str = "balanced"
    # Последният видян адрес и данни за връзката. Нарочно НЕ влизат в
    # ``to_client`` — лобито се излъчва към всички играчи и тези данни не
    # бива да стигат до тях. Виждат се само от домакина, през отделното
    # събитие за конзолата, и в терминала на сървъра.
    ip: str | None = None
    browser: str = ""
    system: str = ""
    device: str = ""
    language: str = ""
    # Кога е установена текущата връзка. Служи само на конзолата: преходът
    # от лобито към игровата страница затваря сокета и веднага отваря нов,
    # което иначе се отпечатва като „загубена връзка" при всяко влизане.
    connected_at: float = field(default_factory=time.time)

    def to_client(self) -> dict[str, Any]:
        return {
            "player_id": self.player_id,
            "name": self.name,
            "token": self.token,
            "gender": self.gender,
            "skin": self.skin,
            "hair": self.hair,
            "hairstyle": self.hairstyle,
            "ready": self.ready,
            "is_host": self.is_host,
            "is_spectator": self.is_spectator,
            "connected": self.connected,
            "is_bot": self.is_bot,
            "bot_style": self.bot_style,
        }


@dataclass
class Room:
    """Една стая: лоби + (по избор) активна игра."""

    code: str
    members: dict[str, RoomMember] = field(default_factory=dict)
    game_settings: GameSettings = field(default_factory=GameSettings)
    engine: GameEngine | None = None
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    # Конзола на връзките: кой, кога и от кой адрес се е свързал или разкачил.
    # Достъпна е САМО за домакина през ``host_connection_log`` — затова не
    # участва нито в ``lobby_to_client``, нито в игровото състояние.
    connection_log: list[dict[str, Any]] = field(default_factory=list)
    # Резултатът се архивира веднъж на партия. Записът се прави при всяко
    # персистиране след края, а без този флаг класацията щеше да събере по
    # десетина еднакви реда за една игра. Реваншът го връща на False.
    result_archived: bool = False

    def record_connection(
        self, event: str, member: "RoomMember | None" = None, *,
        name: str | None = None, ip: str | None = None,
        detail: str | None = None,
    ) -> dict[str, Any]:
        """Добавя запис в конзолата на връзките и го връща."""
        entry = {
            "ts": time.time(),
            "event": event,
            "player_id": member.player_id if member else None,
            "name": name or (member.name if member else "—"),
            "ip": ip or (member.ip if member else None) or "неизвестен",
            "detail": detail or "",
        }
        self.connection_log.append(entry)
        if len(self.connection_log) > 300:
            self.connection_log = self.connection_log[-300:]
        return entry

    @property
    def started(self) -> bool:
        """Дали играта е започнала."""
        return self.engine is not None

    @property
    def host(self) -> RoomMember | None:
        for member in self.members.values():
            if member.is_host:
                return member
        return None

    def touch(self) -> None:
        self.last_activity = time.time()

    def players(self) -> list[RoomMember]:
        """Членове, които не са зрители."""
        return [m for m in self.members.values() if not m.is_spectator]

    def lobby_to_client(self) -> dict[str, Any]:
        """Проекция на лобито за клиента."""
        return {
            "room_code": self.code,
            "started": self.started,
            "members": [m.to_client() for m in self.members.values()],
            "settings": self.game_settings.to_client(),
            "host_id": self.host.player_id if self.host else None,
        }


class RoomError(Exception):
    """Грешка при операция със стая — съобщението е за играча."""


class RoomManager:
    """Държи всички стаи в паметта и координира записа в SQLite."""

    def __init__(self, board: Board) -> None:
        self.board = board
        self.rooms: dict[str, Room] = {}

    # ------------------------------------------------------------------
    # Създаване и присъединяване
    # ------------------------------------------------------------------
    def create_room(
        self,
        name: str,
        token: str,
        gender: str = "male",
        initial_settings: dict[str, Any] | None = None,
    ) -> tuple[Room, RoomMember, str]:
        """Създава стая с уникален код; връща (стая, домакин, reconnect токен)."""
        for _ in range(50):
            code = generate_room_code()
            if code not in self.rooms:
                break
        else:
            raise RoomError("Няма свободни кодове за стаи — опитайте отново.")

        room = Room(code=code)
        if initial_settings:
            self._apply_settings(room, initial_settings)
        member = RoomMember(
            player_id=generate_player_id(),
            name=name,
            token=sanitize_token_choice(token) or ALLOWED_TOKENS[0],
            gender=gender if gender in ALLOWED_GENDERS else "male",
            is_host=True,
            ready=True,  # домакинът е винаги готов
        )
        room.members[member.player_id] = member
        self.rooms[code] = room
        reconnect = make_reconnect_token(code, member.player_id)
        return room, member, reconnect

    def join_room(
        self,
        code: str,
        name: str,
        token: str,
        gender: str = "male",
        password: str = "",
        as_spectator: bool = False,
    ) -> tuple[Room, RoomMember, str]:
        """Присъединяване към съществуваща стая."""
        room = self.rooms.get(code)
        if room is None:
            raise RoomError("Стая с този код не съществува.")
        if room.game_settings.room_password and password != room.game_settings.room_password:
            raise RoomError("Грешна парола за стаята.")

        if as_spectator or (room.started and not as_spectator):
            if not room.game_settings.allow_spectators:
                raise RoomError("Тази стая не допуска зрители.")
            as_spectator = True
        if not as_spectator:
            if room.started:
                raise RoomError("Играта вече е започнала.")
            if len(room.players()) >= room.game_settings.max_players:
                raise RoomError("Стаята е пълна.")

        # Имената трябва да са уникални в стаята.
        lowered = {m.name.lower() for m in room.members.values()}
        if name.lower() in lowered:
            raise RoomError("Име с това изписване вече се използва в стаята.")

        member = RoomMember(
            player_id=generate_player_id(),
            name=name,
            token=self._free_token(room, token),
            gender=gender if gender in ALLOWED_GENDERS else "male",
            is_spectator=as_spectator,
        )
        room.members[member.player_id] = member
        room.touch()
        reconnect = make_reconnect_token(code, member.player_id)
        return room, member, reconnect

    def _free_token(self, room: Room, wanted: str) -> str:
        """Връща исканата фигурка или първата свободна."""
        wanted = sanitize_token_choice(wanted) or ALLOWED_TOKENS[0]
        taken = {m.token for m in room.members.values() if not m.is_spectator}
        if wanted not in taken:
            return wanted
        for candidate in ALLOWED_TOKENS:
            if candidate not in taken:
                return candidate
        return wanted  # повече играчи от фигурки няма как да има (10 < 12)

    # ------------------------------------------------------------------
    # Reconnect
    # ------------------------------------------------------------------
    def find_member(self, code: str, player_id: str) -> tuple[Room, RoomMember] | None:
        """Намира стая и член по код и идентификатор (за reconnect)."""
        room = self.rooms.get(code)
        if room is None:
            return None
        member = room.members.get(player_id)
        if member is None:
            return None
        return room, member

    def mark_disconnected(self, room: Room, member: RoomMember) -> None:
        """Отбелязва член като временно изключен."""
        member.connected = False
        member.sid = None
        member.disconnected_at = time.time()
        member.paused_disconnect_remaining = (
            float(room.game_settings.disconnect_grace_seconds)
            if room.engine is not None and room.engine.state.paused else None
        )
        if room.engine is not None:
            player = room.engine.state.players.get(member.player_id)
            if player is not None:
                player.connected = False
        room.touch()

    def mark_reconnected(self, room: Room, member: RoomMember, sid: str) -> None:
        """Отбелязва член като отново свързан."""
        member.connected = True
        member.sid = sid
        member.disconnected_at = None
        member.paused_disconnect_remaining = None
        if room.engine is not None:
            player = room.engine.state.players.get(member.player_id)
            if player is not None:
                player.connected = True
        room.touch()

    def pause_game(self, room: Room, member: RoomMember) -> list[dict[str, Any]]:
        """Поставя партията на пауза и замразява сроковете за reconnect."""
        if not member.is_host:
            raise RoomError("Само домакинът може да поставя играта на пауза.")
        if room.engine is None:
            raise RoomError("Играта не е започнала.")
        try:
            events = room.engine.pause_game(member.player_id)
        except GameError as exc:
            raise RoomError(str(exc)) from exc
        now = room.engine.state.paused_at
        grace = room.game_settings.disconnect_grace_seconds
        for candidate in room.members.values():
            if candidate.connected:
                candidate.paused_disconnect_remaining = None
                continue
            deadline = (candidate.disconnected_at or now) + grace
            candidate.paused_disconnect_remaining = max(0.0, deadline - now)
        room.touch()
        return events

    def resume_game(self, room: Room, member: RoomMember) -> list[dict[str, Any]]:
        """Възобновява партията и продължава reconnect сроковете от същото място."""
        if not member.is_host:
            raise RoomError("Само домакинът може да възобнови играта.")
        if room.engine is None:
            raise RoomError("Играта не е започнала.")
        try:
            events = room.engine.resume_game(member.player_id)
        except GameError as exc:
            raise RoomError(str(exc)) from exc
        now = time.time()
        grace = room.game_settings.disconnect_grace_seconds
        for candidate in room.members.values():
            remaining = candidate.paused_disconnect_remaining
            if candidate.connected:
                candidate.paused_disconnect_remaining = None
                continue
            if remaining is None:
                remaining = float(grace)
            remaining = max(0.0, min(float(grace), remaining))
            candidate.disconnected_at = now - (grace - remaining)
            candidate.paused_disconnect_remaining = None
        room.touch()
        return events

    # ------------------------------------------------------------------
    # Лоби операции
    # ------------------------------------------------------------------
    def set_ready(self, room: Room, member: RoomMember, ready: bool) -> None:
        if room.started:
            raise RoomError("Играта вече е започнала.")
        if member.is_spectator:
            raise RoomError("Зрителите нямат статус на готовност.")
        member.ready = bool(ready) or member.is_host
        room.touch()

    def set_token(self, room: Room, member: RoomMember, token: str) -> None:
        if room.started:
            raise RoomError("Фигурката не може да се сменя след старта.")
        taken = {
            m.token for m in room.members.values()
            if m.player_id != member.player_id and not m.is_spectator
        }
        if token in taken:
            raise RoomError("Тази фигурка е заета.")
        member.token = token
        room.touch()

    def set_gender(self, room: Room, member: RoomMember, gender: str) -> None:
        if room.started:
            raise RoomError("Полът на фигурката не може да се сменя след старта.")
        if gender not in ALLOWED_GENDERS:
            raise RoomError("Невалиден избор на пол.")
        member.gender = gender
        room.touch()

    def set_appearance(self, room: Room, member: RoomMember, changes: dict[str, Any]) -> None:
        """Сменя кожа, коса и/или прическа. Подават се само променените полета.

        За разлика от цвета външността не е уникална за стаята — двама
        играча може да си приличат, различава ги цветът на фигурката.
        """
        if room.started:
            raise RoomError("Външността не може да се сменя след старта.")
        picked = {
            key: value for key, value in (changes or {}).items()
            if key in APPEARANCE_OPTIONS and value in APPEARANCE_OPTIONS[key]
        }
        if not picked:
            raise RoomError("Невалиден избор на външност.")
        # Ключовете са от APPEARANCE_OPTIONS и съвпадат с имената на полетата.
        for key, value in picked.items():
            setattr(member, key, value)
        room.touch()

    def add_bot(self, room: Room, member: RoomMember, style: str) -> RoomMember:
        if not member.is_host:
            raise RoomError("Само домакинът може да добавя бот.")
        if room.started:
            raise RoomError("Бот може да се добави само преди старта.")
        if len(room.players()) >= room.game_settings.max_players:
            raise RoomError("Стаята е пълна.")
        if style not in ("cautious", "balanced", "aggressive"):
            raise RoomError("Непознат стил на бот.")
        taken = {m.name for m in room.members.values()}
        # Полът се редува спрямо броя вече добавени ботове.
        bot_index = sum(1 for m in room.members.values() if m.is_bot)
        gender = "female" if bot_index % 2 else "male"
        pool = BOT_NAMES_FEMALE if gender == "female" else BOT_NAMES_MALE
        name = next((n for n in pool if n not in taken), None)
        if name is None:
            # Всички имена от пула са заети (напр. играч с такова име) —
            # падаме към номериран вариант, който пак остава кратък.
            counter = 1
            while f"Бот {counter}" in taken:
                counter += 1
            name = f"Бот {counter}"
        # Ботовете получават случайна външност, за да не изглеждат еднакво.
        look = {key: random.choice(values) for key, values in APPEARANCE_OPTIONS.items()}
        bot = RoomMember(
            player_id=generate_player_id(), name=name,
            token=self._free_token(room, "blue"),
            gender=gender,
            skin=look["skin"], hair=look["hair"], hairstyle=look["hairstyle"],
            ready=True, connected=True,
            is_bot=True, bot_style=style,
        )
        room.members[bot.player_id] = bot
        room.touch()
        return bot

    def remove_bot(self, room: Room, member: RoomMember, bot_id: str) -> None:
        if not member.is_host:
            raise RoomError("Само домакинът може да премахва бот.")
        if room.started:
            raise RoomError("Бот може да се премахне само преди старта.")
        bot = room.members.get(bot_id)
        if bot is None or not bot.is_bot:
            raise RoomError("Ботът не е намерен.")
        room.members.pop(bot_id)
        room.touch()

    def remove_member_by_host(
        self, room: Room, host: RoomMember, player_id: str, *, force: bool = False,
    ) -> tuple[RoomMember, list[dict[str, Any]]]:
        """Премахва играч по решение на домакина при позволените условия.

        ``force`` идва от администраторския панел: там домакинът съзнателно
        изгонва и свързан играч. Обикновеният път (бутоните върху картите на
        играчите) остава ограничен до изключен или двукратно неактивен, за да
        не се маха някой с един случаен клик.
        """
        if not host.is_host:
            raise RoomError("Само домакинът може да премахва играчи.")
        if player_id == host.player_id:
            raise RoomError('Не може да премахнете себе си — използвайте „Напусни".')
        target = room.members.get(player_id)
        if target is None:
            raise RoomError("Играчът не е в стаята.")
        if room.started and target.connected and not force:
            game_player = (
                room.engine.state.players.get(player_id) if room.engine else None
            )
            timeouts = (
                game_player.stats.get("consecutive_timeouts", 0)
                if game_player else 0
            )
            if timeouts < 2:
                raise RoomError(
                    "Свързан играч може да бъде премахнат след два "
                    "поредни неактивни хода."
                )
        return target, self.leave_room(room, target)

    def update_settings(self, room: Room, member: RoomMember, data: dict[str, Any]) -> None:
        if not member.is_host:
            raise RoomError("Само домакинът променя настройките.")
        if room.started:
            raise RoomError("Настройките са заключени след старта.")
        self._apply_settings(room, data)
        room.touch()

    @staticmethod
    def _apply_settings(room: Room, data: dict[str, Any]) -> None:
        """Валидира и прилага настройки, включително при нова стая."""
        clean = validate_settings_update(data)
        preset = clean.get("rules_preset")
        if preset:
            apply_rules_preset(room.game_settings, preset)
        for key, value in clean.items():
            setattr(room.game_settings, key, value)

    def leave_room(self, room: Room, member: RoomMember) -> list[dict[str, Any]]:
        """Напускане; връща игрови събития, ако играта е активна."""
        events: list[dict[str, Any]] = []
        if room.engine is not None and not member.is_spectator:
            events = room.engine.remove_player(member.player_id)
            state = room.engine.state
            if state.paused:
                # Доброволното напускане остава позволено, но ако промени
                # хода или търга, новите срокове също остават замразени.
                state.paused_turn_remaining = (
                    float(state.settings.turn_time_limit)
                    if state.settings.turn_time_limit > 0 else -1.0
                )
                state.paused_auction_remaining = (
                    float(state.settings.auction_seconds)
                    if state.auction is not None else -1.0
                )
        room.members.pop(member.player_id, None)
        # Предаване на ролята на домакин.
        if member.is_host:
            remaining = [
                m for m in room.members.values()
                if not m.is_spectator and not m.is_bot
            ]
            if not remaining:
                remaining = [m for m in room.members.values() if not m.is_spectator]
            candidates = remaining or list(room.members.values())
            if candidates:
                new_host = min(candidates, key=lambda m: 0 if m.connected else 1)
                new_host.is_host = True
                new_host.ready = True
                if room.engine is not None:
                    player = room.engine.state.players.get(new_host.player_id)
                    if player is not None:
                        player.is_host = True
        room.touch()
        if not room.members:
            self.rooms.pop(room.code, None)
        return events

    def transfer_host(self, room: Room, member: RoomMember, target_id: str) -> None:
        """Домакинът предава ролята си на друг член."""
        if not member.is_host:
            raise RoomError("Само домакинът може да предаде ролята.")
        target = room.members.get(target_id)
        if target is None:
            raise RoomError("Играчът не е в стаята.")
        member.is_host = False
        target.is_host = True
        target.ready = True
        if room.engine is not None:
            for pid, is_host in ((member.player_id, False), (target_id, True)):
                player = room.engine.state.players.get(pid)
                if player is not None:
                    player.is_host = is_host
        room.touch()

    # ------------------------------------------------------------------
    # Старт на играта
    # ------------------------------------------------------------------
    def start_game(self, room: Room, member: RoomMember) -> list[dict[str, Any]]:
        """Домакинът стартира играта; всички играчи трябва да са готови."""
        if not member.is_host:
            raise RoomError("Само домакинът може да стартира играта.")
        if room.started:
            raise RoomError("Играта вече е започнала.")
        players = room.players()
        if not 2 <= len(players) <= 10:
            raise RoomError("Нужни са от 2 до 10 играчи.")
        if not all(m.ready for m in players):
            raise RoomError("Всички играчи трябва да са готови.")

        engine = GameEngine(self.board, room.game_settings, rng=random.Random())
        game_players = [
            Player(
                player_id=m.player_id,
                name=m.name,
                token=m.token,
                gender=m.gender,
                skin=m.skin,
                hair=m.hair,
                hairstyle=m.hairstyle,
                cash=0,  # start_game задава началната сума
                is_host=m.is_host,
                is_bot=m.is_bot,
                bot_style=m.bot_style,
            )
            for m in players
        ]
        events = engine.start_game(game_players)
        room.engine = engine
        # Всяка нова партия си има собствен резултат за архива.
        room.result_archived = False
        room.touch()
        self.save_room(room)
        return events

    def rematch(self, room: Room, member: RoomMember) -> list[dict[str, Any]]:
        """Реванш: нова игра със същите играчи и настройки, без ново лоби."""
        if not member.is_host:
            raise RoomError("Само домакинът може да започне реванш.")
        if room.engine is None:
            raise RoomError("Няма приключила игра за реванш.")
        players = room.players()
        if not 2 <= len(players) <= 10:
            raise RoomError("Нужни са от 2 до 10 играчи за реванш.")

        engine = GameEngine(self.board, room.game_settings, rng=random.Random())
        game_players = [
            Player(
                player_id=m.player_id,
                name=m.name,
                token=m.token,
                gender=m.gender,
                skin=m.skin,
                hair=m.hair,
                hairstyle=m.hairstyle,
                cash=0,
                is_host=m.is_host,
                is_bot=m.is_bot,
                bot_style=m.bot_style,
            )
            for m in players
        ]
        for m in players:
            m.ready = True
        events = engine.start_game(game_players)
        room.engine = engine
        # Всяка нова партия си има собствен резултат за архива.
        room.result_archived = False
        room.touch()
        self.save_room(room)
        return events

    # ------------------------------------------------------------------
    # Запис и възстановяване
    # ------------------------------------------------------------------
    def serialize_room(
        self, room: Room, status: str = "active"
    ) -> tuple[str, str, str, str] | None:
        """Прави моментна снимка на стаята като JSON низове.

        Изпълнява се синхронно в event loop-а, за да е консистентна спрямо
        игровото състояние: така никоя мутация не може да се вклини между
        четенето на играчите и на имотите. Готовите низове после се записват
        в отделна нишка (виж ``write_saved_game``), без да пипат живото
        състояние — иначе сериализацията в нишка може да улови „разкъсана"
        снимка (пари преди трансфер, собственост след него).
        """
        if room.engine is None:
            return None
        state_json = json.dumps(
            state_to_dict(room.engine.state), ensure_ascii=False
        )
        room_json = json.dumps(
            {
                "members": {
                    pid: {
                        "player_id": m.player_id,
                        "name": m.name,
                        "token": m.token,
                        "gender": m.gender,
                        "skin": m.skin,
                        "hair": m.hair,
                        "hairstyle": m.hairstyle,
                        "is_host": m.is_host,
                        "is_spectator": m.is_spectator,
                        "is_bot": m.is_bot,
                        "bot_style": m.bot_style,
                        "paused_disconnect_remaining": m.paused_disconnect_remaining,
                    }
                    for pid, m in room.members.items()
                },
            },
            ensure_ascii=False,
        )
        return room.code, state_json, room_json, status

    def write_saved_game(
        self, room_code: str, state_json: str, room_json: str, status: str
    ) -> None:
        """Записва вече сериализирана снимка в SQLite (само I/O, безопасно за нишка)."""
        session = get_session()
        try:
            record = (
                session.query(SavedGame)
                .filter(SavedGame.room_code == room_code, SavedGame.status == "active")
                .one_or_none()
            )
            if record is None:
                record = SavedGame(room_code=room_code)
                session.add(record)
            record.state_json = state_json
            record.room_json = room_json
            record.status = status
            record.updated_at = time.time()
            session.commit()
        finally:
            session.close()

    # ------------------------------------------------------------------
    # Архив на резултатите
    # ------------------------------------------------------------------
    def build_result(self, room: Room) -> tuple[str, float, str, str, int, str] | None:
        """Изважда малкия резултат от завършена партия.

        Изпълнява се синхронно в event loop-а, както и ``serialize_room`` —
        чете живото състояние и не бива да тече успоредно с мутациите му.
        Връща ``None``, ако партията още не е приключила или вече е
        архивирана.
        """
        if room.engine is None or room.result_archived:
            return None
        state = room.engine.state
        if state.winner is None:
            return None
        view = state_to_client(state, self.board)
        report = view.get("final_report") or []
        players = [
            {
                "name": row["name"],
                "token": row["token"],
                "net_worth": row["net_worth"],
                "properties": row["properties"],
                "bankrupt": row["bankrupt"],
                "rent_collected": row.get("stats", {}).get("rent_collected", 0),
                "trades": row.get("stats", {}).get("trades_completed", 0),
                "laps": row.get("stats", {}).get("laps", 0),
            }
            for row in report
        ]
        winner = state.players.get(state.winner)
        room.result_archived = True
        return (
            room.code,
            time.time(),
            state.winner,
            winner.name if winner else "",
            int(state.round_number),
            json.dumps(players, ensure_ascii=False),
        )

    def write_game_result(
        self, room_code: str, finished_at: float, winner_id: str,
        winner_name: str, rounds: int, players_json: str,
    ) -> None:
        """Записва резултата (само I/O, безопасно за отделна нишка)."""
        session = get_session()
        try:
            session.add(GameResult(
                room_code=room_code,
                finished_at=finished_at,
                winner_id=winner_id,
                winner_name=winner_name,
                rounds=rounds,
                players_json=players_json,
            ))
            session.commit()
        finally:
            session.close()

    def save_room(self, room: Room, status: str = "active") -> None:
        """Записва състоянието на стаята в SQLite (създава или обновява).

        Синхронен вариант — сериализира и записва в едно. За запис от event
        loop използвайте ``serialize_room`` + ``write_saved_game``, за да не
        тече сериализацията успоредно с мутациите на състоянието.
        """
        snapshot = self.serialize_room(room, status)
        if snapshot is not None:
            self.write_saved_game(*snapshot)

    def restore_active_games(self) -> int:
        """Възстановява активните игри от базата при стартиране на сървъра.

        Само скорошните: в игра отпреди седмица никой няма да се върне, а
        всяка такава стая заемаше място в паметта и изяждаше от лимита от
        50 възстановявания. Прагът е ``RESTORE_MAX_AGE_DAYS``.
        """
        session = get_session()
        restored = 0
        cutoff = time.time() - settings.RESTORE_MAX_AGE_DAYS * 86400
        try:
            records = (
                session.query(SavedGame)
                .filter(
                    SavedGame.status == "active",
                    SavedGame.updated_at >= cutoff,
                )
                .order_by(SavedGame.updated_at.desc())
                .limit(50)
                .all()
            )
        finally:
            session.close()

        for record in records:
            if record.room_code in self.rooms:
                continue
            try:
                state = state_from_dict(json.loads(record.state_json))
                room_data = json.loads(record.room_json or "{}")
            except (SaveFormatError, json.JSONDecodeError, KeyError):
                continue  # повреден запис — пропускаме го
            if state.winner is not None:
                continue

            self._normalize_restored_avatars(state)

            room = Room(code=record.room_code, game_settings=state.settings)
            engine = GameEngine(self.board, state.settings, rng=random.Random())
            engine.state = state
            engine.ensure_secret_missions()
            # Непаузирана игра получава нов пълен срок след рестарт. При
            # пауза пазим точно записаното оставащо време до възобновяването.
            if not state.paused:
                engine.touch_turn_clock()
            if state.auction is not None and not state.paused:
                # И търгът получава пълен нов срок след възстановяване.
                state.auction.ends_at = time.time() + state.settings.auction_seconds
            room.engine = engine
            for pid, m in (room_data.get("members") or {}).items():
                player = state.players.get(pid)
                member = RoomMember(
                    player_id=pid,
                    name=str(m.get("name", "Играч")),
                    token=(
                        player.token if player is not None
                        else sanitize_token_choice(m.get("token")) or "red"
                    ),
                    gender=(
                        player.gender if player is not None
                        else str(m.get("gender", "male"))
                    ),
                    # Играчът е меродавен: _normalize_restored_avatars вече е
                    # изчистил стойностите му. Записите без външност падат към
                    # подразбирането чрез sanitize_appearance.
                    **(
                        {"skin": player.skin, "hair": player.hair, "hairstyle": player.hairstyle}
                        if player is not None else sanitize_appearance(m)
                    ),
                    ready=True,
                    is_host=bool(m.get("is_host")),
                    is_spectator=bool(m.get("is_spectator")),
                    connected=bool(m.get("is_bot")),
                    is_bot=bool(m.get("is_bot")),
                    bot_style=str(m.get("bot_style", "balanced")),
                )
                member.disconnected_at = time.time()
                if state.paused and not member.is_bot:
                    saved_remaining = m.get("paused_disconnect_remaining")
                    member.paused_disconnect_remaining = (
                        float(saved_remaining)
                        if saved_remaining is not None
                        else float(state.settings.disconnect_grace_seconds)
                    )
                room.members[pid] = member
                if player is not None:
                    player.connected = False
            self.rooms[record.room_code] = room
            restored += 1
        return restored

    def checkpoint_active_games(self) -> int:
        """Записва синхронно всички активни игри при нормално спиране."""
        saved = 0
        for room in list(self.rooms.values()):
            if room.engine is None:
                continue
            status = "finished" if room.engine.state.winner else "active"
            try:
                self.save_room(room, status=status)
            except Exception:  # noqa: BLE001 — останалите стаи също се записват
                continue
            else:
                saved += 1
        return saved

    @staticmethod
    def _normalize_restored_avatars(state: Any) -> None:
        """Преобразува стари фигурки и гарантира различен цвят за всеки играч."""
        used: set[str] = set()
        ordered_ids = list(state.turn_order) + [
            pid for pid in state.players if pid not in state.turn_order
        ]
        for player_id in ordered_ids:
            player = state.players[player_id]
            color = sanitize_token_choice(player.token) or ALLOWED_TOKENS[0]
            if color in used:
                color = next(candidate for candidate in ALLOWED_TOKENS if candidate not in used)
            player.token = color
            player.gender = player.gender if player.gender in ALLOWED_GENDERS else "male"
            look = sanitize_appearance(
                {"skin": player.skin, "hair": player.hair, "hairstyle": player.hairstyle}
            )
            player.skin, player.hair, player.hairstyle = (
                look["skin"], look["hair"], look["hairstyle"]
            )
            if not player.is_spectator:
                used.add(color)

    def list_saved_games(self, limit: int = 10) -> list[dict[str, Any]]:
        """Последните запазени игри (за информация на домакина)."""
        session = get_session()
        try:
            records = (
                session.query(SavedGame)
                .order_by(SavedGame.updated_at.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "room_code": r.room_code,
                    "status": r.status,
                    "updated_at": r.updated_at,
                }
                for r in records
            ]
        finally:
            session.close()

    # ------------------------------------------------------------------
    # Изчистване
    # ------------------------------------------------------------------
    def cleanup_idle_rooms(self) -> int:
        """Премахва отдавна неактивни стаи от паметта.

        Записът в базата НЕ се опреснява при изхвърляне. Преди тук се
        викаше ``save_room`` и това правеше стаите безсмъртни: всеки старт
        връщаше по 50 от тях в паметта, изчистването ги записваше наново
        като „active" с прясна дата и следващият старт ги връщаше пак.
        Състоянието и без това вече е записано след всяко действие.
        """
        now = time.time()
        stale = [
            code
            for code, room in self.rooms.items()
            if now - room.last_activity > settings.ROOM_IDLE_SECONDS
            and all(not m.connected for m in room.members.values())
        ]
        for code in stale:
            self.rooms.pop(code)
        return len(stale)

    def purge_old_saves(self) -> dict[str, int]:
        """Изтрива излишните записи. Връща броя по вид.

        Три предпазни правила, всяко от които сам по себе си стига:

        * стая, която в момента е в паметта, не се пипа никога — независимо
          какво показва датата ѝ;
        * паузирана партия не се трие по възраст: при пауза часовниците
          спират и нищо не се записва, така че датата ѝ остарява, докато
          играчите просто ги няма няколко дни;
        * завършените се трият чак след като резултатът им е архивиран —
          иначе класацията би загубила партии.
        """
        now = time.time()
        live = set(self.rooms)
        removed = {"finished": 0, "active": 0}
        session = get_session()
        try:
            archived = {
                code for (code,) in session.query(GameResult.room_code).distinct()
            }
            finished_cutoff = now - settings.FINISHED_RETENTION_DAYS * 86400
            active_cutoff = now - settings.SAVE_RETENTION_DAYS * 86400
            for record in session.query(SavedGame).all():
                if record.room_code in live:
                    continue
                if record.status == "finished":
                    if (
                        record.updated_at < finished_cutoff
                        and record.room_code in archived
                    ):
                        session.delete(record)
                        removed["finished"] += 1
                    continue
                if record.updated_at >= active_cutoff:
                    continue
                try:
                    paused = bool(json.loads(record.state_json).get("paused"))
                except (json.JSONDecodeError, TypeError, AttributeError):
                    paused = False
                if paused:
                    continue
                session.delete(record)
                removed["active"] += 1
            session.commit()
        finally:
            session.close()
        if removed["finished"] or removed["active"]:
            self._reclaim_space()
        return removed

    @staticmethod
    def _reclaim_space() -> None:
        """Свива файла на базата след изтриване.

        SQLite маркира изтритите страници като свободни, но не смалява
        файла — без това чистенето освобождава редове, а мястото на диска
        си остава заето. VACUUM не може да тече в транзакция, затова се
        изпълнява на собствена връзка.
        """
        from .database import engine

        try:
            with engine.connect().execution_options(
                isolation_level="AUTOCOMMIT"
            ) as connection:
                connection.execute(text("VACUUM"))
        except Exception:  # noqa: BLE001 — свиването е удобство, не задължение
            pass

    def game_state_for_client(
        self, room: Room, viewer_id: str | None = None, full: bool = False,
    ) -> dict[str, Any] | None:
        """Клиентска проекция на игровото състояние.

        ``full`` добавя игровия лог — нужен е само при влизане и връщане,
        не при всяко обновяване.
        """
        if room.engine is None:
            return None
        data = state_to_client(room.engine.state, self.board, viewer_id, full=full)
        # Информация за прекъснати играчи: откога и колко остава до изтичане.
        grace = room.game_settings.disconnect_grace_seconds
        disconnections: dict[str, Any] = {}
        for pid, member in room.members.items():
            if not member.connected and member.disconnected_at:
                disconnections[pid] = {
                    "since": member.disconnected_at,
                    "grace": grace,
                    "deadline": member.disconnected_at + grace,
                    "paused_remaining": (
                        member.paused_disconnect_remaining
                        if room.engine.state.paused else None
                    ),
                }
        data["disconnections"] = disconnections
        data["server_time"] = time.time()
        return data
