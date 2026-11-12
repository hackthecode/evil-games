"""Сглобява статичната версия на интерфейса за GitHub Pages.

GitHub Pages не може да пуска Python, затова там стоят само страниците,
стиловете и скриптовете. Играта се води от сървъра (start.py), пуснат
другаде — например в Render — и браузърът се свързва към него по сокет.

Използване:
    python build_pages.py --server-url https://imoti-i-imperii.onrender.com
    python build_pages.py --server-url ... --out _site
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

# Windows конзолата често е cp1252 — без това кирилицата гърми при print.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass

from app.config import STATIC_DIR, TEMPLATES_DIR, settings  # noqa: E402
from app.game.board import Board  # noqa: E402


def static_version() -> str:
    """Версия за кеша — последната промяна сред статичните файлове."""
    return str(max(
        int(item.stat().st_mtime) for item in STATIC_DIR.rglob("*") if item.is_file()
    ))


def render(env: Environment, name: str, context: dict) -> str:
    """Рендира шаблон и го пренасочва към относителни пътища.

    Pages обслужва проекта от подпапка (потребител.github.io/хранилище/),
    затова абсолютните /static/ пътища на сървъра не биха се намерили.
    Адресът на сървъра идва от config.js до страниците.
    """
    html = env.get_template(name).render(**context)
    html = html.replace('"/static/', '"static/')
    config_tag = '<script src="config.js"></script>\n  '
    return html.replace('<script src="static/vendor/', config_tag + '<script src="static/vendor/', 1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Статична версия за GitHub Pages.")
    parser.add_argument("--server-url", required=True,
                        help="Адрес на сървъра на играта, напр. https://....onrender.com")
    parser.add_argument("--out", default="_site", help="Изходна папка (по подразбиране _site)")
    args = parser.parse_args()

    server_url = args.server_url.strip().rstrip("/")
    if not server_url.startswith(("http://", "https://")):
        parser.error("--server-url трябва да започва с http:// или https://")

    out = (BASE_DIR / args.out).resolve()
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(STATIC_DIR, out / "static")

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    config = {"serverUrl": server_url, "homeUrl": "./", "gameUrl": "game.html"}
    version = static_version()
    board = Board.from_file(settings.BOARD_CONFIG)

    pages = {
        "index.html": ("index.html", {}),
        "game.html": ("game.html", {"board_json": board.to_client()}),
    }
    for target, (template, extra) in pages.items():
        context = {"game_name": settings.GAME_NAME, "static_version": version, **extra}
        (out / target).write_text(render(env, template, context), encoding="utf-8")

    # Отделен файл: смяна на сървъра е редакция на един ред, без ново сглобяване.
    (out / "config.js").write_text(
        "// Адрес на сървъра на играта. Сглобено от build_pages.py.\n"
        f"window.IE_CONFIG = {json.dumps(config, indent=2)};\n",
        encoding="utf-8",
    )

    # Без него Pages пуска Jekyll, който пропуска файлове и забавя публикуването.
    (out / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Готово: {out}  (сървър: {server_url})")


if __name__ == "__main__":
    main()
