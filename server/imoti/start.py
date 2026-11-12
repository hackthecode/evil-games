"""Стартиране на „Имоти и Империи" — единственият файл, който потребителят пуска.

Използване:
    python start.py
    python start.py --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import argparse
import socket
import sys
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

# Windows конзолата често е cp1252 — превключваме към UTF-8, за да се
# показва правилно българският текст.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass


def find_local_ip() -> str:
    """Открива локалния IPv4 адрес на компютъра (без реален трафик)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.168.255.255", 1))
            return probe.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return "127.0.0.1"


def ensure_directories() -> None:
    """Създава задължителните папки, ако липсват."""
    for folder in ("data", "app/static", "app/templates"):
        (BASE_DIR / folder).mkdir(parents=True, exist_ok=True)


def autosave_version() -> str | None:
    """Запазва версия, ако кодът се е променил от последното пускане.

    Така всяко пускане на играта оставя точка, към която може да се върнете.
    Нищо тук не бива да спре стартирането: при липсващ git или каквато и да
    е грешка просто се пропуска.
    """
    try:
        import version

        import io
        import contextlib

        # Изходът на помощника се поглъща — тук показваме свой ред.
        with contextlib.redirect_stdout(io.StringIO()):
            saved = version.save(
                f"Автоматично при пускане на играта — "
                f"{datetime.now().strftime('%d.%m.%Y %H:%M')}",
                quiet=True,
            )
        if not saved:
            return None
        return "Кодът се е променил — запазена е нова версия."
    except Exception:  # noqa: BLE001 — версиите са удобство, не условие
        return None


def ensure_board_config() -> None:
    """Проверява, че конфигурацията на таблото е налична и валидна."""
    import json

    config_path = BASE_DIR / "data" / "board_config.json"
    if not config_path.exists():
        print("ГРЕШКА: Липсва data/board_config.json — таблото не може да се зареди.")
        sys.exit(1)
    try:
        with open(config_path, encoding="utf-8") as handle:
            config = json.load(handle)
        assert config["size"] == len(config["spaces"])
    except (json.JSONDecodeError, KeyError, AssertionError) as exc:
        print(f"ГРЕШКА: Повреден board_config.json: {exc}")
        sys.exit(1)


def main() -> None:
    """Разбор на аргументите и стартиране на Uvicorn."""
    parser = argparse.ArgumentParser(description="Стартира сървъра на играта.")
    parser.add_argument("--host", default=None, help="Адрес за слушане (по подразбиране 0.0.0.0)")
    parser.add_argument("--port", type=int, default=None, help="Порт (по подразбиране 8000)")
    args = parser.parse_args()

    ensure_directories()
    ensure_board_config()

    # Импортите са тук, за да може съобщението за липсващи пакети да е ясно.
    try:
        import uvicorn

        from app.config import settings
        from app.database import init_db
    except ImportError as exc:
        print("ГРЕШКА: Липсват необходими пакети.")
        print(f"Подробност: {exc}")
        print("Изпълнете:  pip install -r requirements.txt")
        sys.exit(1)

    host = args.host or settings.HOST
    port = args.port or settings.PORT

    # Създава SQLite базата при първо стартиране.
    init_db()

    local_ip = find_local_ip()
    line = "─" * 46
    print()
    print(line)
    print(f"  {settings.GAME_NAME} — играта е стартирана.")
    print(line)
    print()
    print("  На този компютър:")
    print(f"    http://127.0.0.1:{port}")
    print()
    print("  От локалната мрежа:")
    print(f"    http://{local_ip}:{port}")
    print()
    print("  Спиране: натиснете Ctrl+C")
    note = autosave_version()
    if note:
        print()
        print(f"  {note}")
        print("  Всички версии:  python version.py")
    print(line)
    print()

    try:
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            log_level="warning",
        )
    except KeyboardInterrupt:
        pass
    finally:
        print("\nСървърът е спрян. Довиждане!")


if __name__ == "__main__":
    main()
