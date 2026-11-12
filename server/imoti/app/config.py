"""Централна конфигурация на приложението.

Името на играта и другите настройки се четат от променливи на средата
(файл ``.env`` по избор) с разумни стойности по подразбиране.
"""
from __future__ import annotations

import os
from pathlib import Path

# Базова директория на проекта (папката, съдържаща start.py).
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "app" / "static"
TEMPLATES_DIR = BASE_DIR / "app" / "templates"


def _load_dotenv(path: Path) -> None:
    """Минимално зареждане на .env файл (без външна зависимост)."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_dotenv(BASE_DIR / ".env")


class Settings:
    """Настройки на сървъра, четени от средата."""

    # Името на играта — конфигурируемо от едно място.
    GAME_NAME: str = os.environ.get("GAME_NAME", "Имоти и Империи")
    HOST: str = os.environ.get("HOST", "0.0.0.0")
    PORT: int = int(os.environ.get("PORT", "8000"))
    # Таен ключ за подписване на reconnect токени. Ако липсва, генерира се
    # случаен при всяко стартиране (токените се анулират при рестарт).
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "")
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL", f"sqlite:///{(DATA_DIR / 'game.db').as_posix()}"
    )
    BOARD_CONFIG: Path = DATA_DIR / "board_config.json"
    # Колко секунди пазим мястото на изключен играч.
    DISCONNECT_GRACE_SECONDS: int = int(os.environ.get("DISCONNECT_GRACE_SECONDS", "180"))
    # Rate limiting: максимален брой събития за прозорец от време.
    RATE_LIMIT_EVENTS: int = int(os.environ.get("RATE_LIMIT_EVENTS", "20"))
    RATE_LIMIT_WINDOW: float = float(os.environ.get("RATE_LIMIT_WINDOW", "5"))
    # Максимална дължина на потребителски имена и чат съобщения.
    MAX_NAME_LENGTH: int = 20
    MAX_CHAT_LENGTH: int = 300
    # Колко празни стаи пазим в паметта, преди да ги почистим.
    ROOM_IDLE_SECONDS: int = int(os.environ.get("ROOM_IDLE_SECONDS", "3600"))
    # През колко секунди се върти чистенето на изоставени стаи и стари
    # записи. Задачата се пуска при стартиране на сървъра.
    CLEANUP_INTERVAL_SECONDS: int = int(
        os.environ.get("CLEANUP_INTERVAL_SECONDS", "900")
    )
    # Записи по-стари от това не се възстановяват при стартиране: никой
    # няма да се върне в игра отпреди седмица, а всяка такава стая заема
    # място в паметта и се брои към лимита от 50 възстановявания.
    RESTORE_MAX_AGE_DAYS: float = float(
        os.environ.get("RESTORE_MAX_AGE_DAYS", "3")
    )
    # Изтриване на стари записи. Незавършените се пазят дълго, защото
    # може да са прекъсната партия; паузираните не се трият по възраст.
    SAVE_RETENTION_DAYS: float = float(
        os.environ.get("SAVE_RETENTION_DAYS", "30")
    )
    # Завършените се пазят кратко: резултатът им вече е архивиран в
    # отделна таблица, а пълното състояние тежи по над 100 KB.
    FINISHED_RETENTION_DAYS: float = float(
        os.environ.get("FINISHED_RETENTION_DAYS", "3")
    )


settings = Settings()
