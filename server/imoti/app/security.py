"""Сигурност: кодове на стаи, reconnect токени, rate limiting, валидиране."""
from __future__ import annotations

import hashlib
import hmac
import html
import secrets
import string
import time

from .config import DATA_DIR, settings


def _load_or_create_secret() -> str:
    """Пази автоматичния ключ между рестарти, за да важат reconnect токените."""
    if settings.SECRET_KEY:
        return settings.SECRET_KEY
    path = DATA_DIR / ".secret_key"
    try:
        existing = path.read_text(encoding="utf-8").strip()
        if len(existing) >= 32:
            return existing
    except OSError:
        pass
    generated = secrets.token_hex(32)
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(generated, encoding="utf-8")
    except OSError:
        # Играта остава работеща и при директория само за четене, но токените
        # тогава няма как да оцелеят след рестарт.
        pass
    return generated


_SECRET = _load_or_create_secret()

ROOM_CODE_ALPHABET = string.ascii_uppercase + string.digits
ROOM_CODE_LENGTH = 6

ALLOWED_TOKENS = (
    "red", "black", "green", "pink", "yellow", "blue", "white",
    "orange", "purple", "turquoise", "brown", "silver",
)
ALLOWED_GENDERS = ("male", "female")

# Външност на човечето — избира се в лобито независимо от цвета на фигурката.
# Цветовете на кожата и косата живеят в common.js; тук пазим само кои
# идентификатори са позволени, за да не се подава произволен низ в SVG-то.
ALLOWED_SKINS = ("light", "fair", "tan", "olive", "brown", "dark")
ALLOWED_HAIR_COLORS = ("black", "brown", "blond", "ginger", "gray", "white")
ALLOWED_HAIRSTYLES = ("short", "long", "bun", "curly", "bald")

DEFAULT_APPEARANCE = {"skin": "fair", "hair": "brown", "hairstyle": "short"}

APPEARANCE_OPTIONS: dict[str, tuple[str, ...]] = {
    "skin": ALLOWED_SKINS,
    "hair": ALLOWED_HAIR_COLORS,
    "hairstyle": ALLOWED_HAIRSTYLES,
}

LEGACY_TOKEN_COLORS = {
    "owl": "red",
    "fox": "black",
    "bulb": "yellow",
    "ship": "blue",
    "mountain": "green",
    "solar": "pink",
    "gear": "white",
    "backpack": "red",
    "tractor": "green",
    "rocket": "blue",
}


def generate_room_code() -> str:
    """Криптографски случаен код на стая: 6 главни букви/цифри."""
    return "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(ROOM_CODE_LENGTH))


def generate_player_id() -> str:
    """Стабилен идентификатор на играч (не е обвързан с IP или sid)."""
    return secrets.token_hex(16)


def make_reconnect_token(room_code: str, player_id: str) -> str:
    """Подписан токен за повторно свързване, съхраняван в localStorage."""
    nonce = secrets.token_hex(8)
    payload = f"{room_code}:{player_id}:{nonce}"
    signature = hmac.new(
        _SECRET.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()[:32]
    return f"{payload}:{signature}"


def verify_reconnect_token(token: str) -> tuple[str, str] | None:
    """Проверява токен; връща (room_code, player_id) или None."""
    if not isinstance(token, str) or len(token) > 200:
        return None
    parts = token.split(":")
    if len(parts) != 4:
        return None
    room_code, player_id, nonce, signature = parts
    payload = f"{room_code}:{player_id}:{nonce}"
    expected = hmac.new(
        _SECRET.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()[:32]
    if not hmac.compare_digest(signature, expected):
        return None
    return room_code, player_id


def client_ip(environ: dict) -> str:
    """Адресът на клиента от ASGI средата.

    ``REMOTE_ADDR`` НЕ става за целта: ASGI слоят на engineio го записва
    твърдо като ``127.0.0.1``. Истинският адрес е в ASGI scope-а
    (``scope["client"]``). При работа зад обратен прокси първо се гледа
    ``X-Forwarded-For`` — първият адрес там е оригиналният клиент.
    """
    forwarded = environ.get("HTTP_X_FORWARDED_FOR")
    if isinstance(forwarded, str) and forwarded.strip():
        first = forwarded.split(",")[0].strip()
        if first:
            return first[:45]           # място и за пълен IPv6 адрес
    real = environ.get("HTTP_X_REAL_IP")
    if isinstance(real, str) and real.strip():
        return real.strip()[:45]
    scope = environ.get("asgi.scope")
    if isinstance(scope, dict):
        client = scope.get("client")
        if isinstance(client, (tuple, list)) and client and client[0]:
            return str(client[0])[:45]
    address = environ.get("REMOTE_ADDR")
    return str(address)[:45] if address else "неизвестен"


def sanitize_name(raw: object) -> str | None:
    """Валидира и почиства име на играч; None при невалидно."""
    if not isinstance(raw, str):
        return None
    name = " ".join(raw.split())  # нормализира празните символи
    if not 1 <= len(name) <= settings.MAX_NAME_LENGTH:
        return None
    # HTML escaping — името се показва на всички клиенти.
    return html.escape(name, quote=True)


def sanitize_chat(raw: object) -> str | None:
    """Валидира и почиства чат съобщение."""
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if not 1 <= len(text) <= settings.MAX_CHAT_LENGTH:
        return None
    return html.escape(text, quote=True)


def sanitize_room_code(raw: object) -> str | None:
    """Валидира код на стая."""
    if not isinstance(raw, str):
        return None
    code = raw.strip().upper()
    if len(code) != ROOM_CODE_LENGTH:
        return None
    if any(ch not in ROOM_CODE_ALPHABET for ch in code):
        return None
    return code


def sanitize_token_choice(raw: object) -> str | None:
    """Валидира избор на фигурка."""
    if isinstance(raw, str) and raw in ALLOWED_TOKENS:
        return raw
    if isinstance(raw, str):
        return LEGACY_TOKEN_COLORS.get(raw)
    return None


def sanitize_gender_choice(raw: object) -> str | None:
    """Валидира избора на пол за човешката фигурка."""
    if isinstance(raw, str) and raw in ALLOWED_GENDERS:
        return raw
    return None


def sanitize_appearance(raw: object) -> dict[str, str]:
    """Нормализира външността (кожа, коса, прическа) до пълен речник.

    Непознатите и липсващите стойности падат към подразбирането — така
    старите записи и клиентите от друга версия не чупят рисуването.
    """
    data = raw if isinstance(raw, dict) else {}
    result: dict[str, str] = {}
    for key, allowed in APPEARANCE_OPTIONS.items():
        value = data.get(key)
        result[key] = (
            value if isinstance(value, str) and value in allowed
            else DEFAULT_APPEARANCE[key]
        )
    return result


class RateLimiter:
    """Прост плъзгащ се прозорец за ограничаване на събития по връзка."""

    def __init__(self, max_events: int | None = None, window: float | None = None) -> None:
        self.max_events = max_events or settings.RATE_LIMIT_EVENTS
        self.window = window or settings.RATE_LIMIT_WINDOW
        self._events: dict[str, list[float]] = {}

    def allow(self, key: str) -> bool:
        """Връща True, ако събитието е позволено за този ключ."""
        now = time.monotonic()
        history = self._events.setdefault(key, [])
        cutoff = now - self.window
        while history and history[0] < cutoff:
            history.pop(0)
        if len(history) >= self.max_events:
            return False
        history.append(now)
        return True

    def forget(self, key: str) -> None:
        """Изчиства историята на връзка (при disconnect)."""
        self._events.pop(key, None)
