"""Подробен изход в терминала за свързванията.

Сървърът се пуска с ``log_level="warning"`` (start.py), затова обичайният
``logger.info`` не стига до екрана. Тук се настройва собствен именуван
логер със свой обработчик — така редовете се показват независимо от
нивото на uvicorn и не зависят от това как е стартиран сървърът.

Изходът е предназначен за човек пред терминала, не за машинен разбор:
всяко събитие е блок от два-три реда с дата, час и всичко известно за
госта.
"""
from __future__ import annotations

import logging
import sys
import time

LOGGER_NAME = "imoti.connections"

# Кратък знак и дума за всяко събитие. Знакът дава бърза ориентация при
# превъртане на дълъг терминал.
_EVENTS: dict[str, tuple[str, str]] = {
    "create": ("[+]", "СЪЗДАДЕ СТАЯ"),
    "join": ("[>]", "ПРИСЪЕДИНЯВАНЕ"),
    "reconnect": ("[~]", "ВРЪЩАНЕ"),
    "disconnect": ("[!]", "ЗАГУБЕНА ВРЪЗКА"),
    # Прекъсване веднага след свързване — смяна на страница или опресняване,
    # а не истински проблем с мрежата.
    "reload": ("[.]", "СМЯНА НА СТРАНИЦА"),
    "leave": ("[-]", "НАПУСКАНЕ"),
    "kick": ("[x]", "ПРЕМАХНАТ"),
}


class _PlainFormatter(logging.Formatter):
    """Без префикси — съобщението вече носи своята дата и подредба."""

    def format(self, record: logging.LogRecord) -> str:
        return record.getMessage()


def get_logger() -> logging.Logger:
    """Логерът за конзолата, настроен веднъж."""
    logger = logging.getLogger(LOGGER_NAME)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_PlainFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        # Собствен обработчик — иначе редът излиза и през root логера.
        logger.propagate = False
    return logger


def _stamp(when: float | None = None) -> str:
    return time.strftime("%d.%m.%Y %H:%M:%S", time.localtime(when or time.time()))


def log_connection(
    event: str,
    *,
    name: str = "—",
    ip: str = "неизвестен",
    room: str = "—",
    browser: str = "",
    system: str = "",
    device: str = "",
    language: str = "",
    transport: str = "",
    players: int | None = None,
    detail: str = "",
) -> None:
    """Отпечатва блок за едно събитие по свързването.

    Показва всичко известно, но пропуска празните полета — при изключване
    например не се повтарят браузърът и системата, защото те вече са били
    изписани при влизането.
    """
    icon, title = _EVENTS.get(event, ("[*]", event.upper()))
    logger = get_logger()

    head = f"[{_stamp()}]  {icon} {title:<16} {name}"
    second: list[str] = [f"стая {room}"]
    if players is not None:
        second.append(f"{players} " + ("играч" if players == 1 else "играча"))
    second.append(f"IP {ip}")
    lines = [head, "      " + "  ·  ".join(second)]

    third = [part for part in (browser, system, device) if part]
    if language:
        third.append(f"език {language}")
    if transport:
        third.append(transport)
    if third:
        lines.append("      " + "  ·  ".join(third))
    if detail:
        lines.append(f"      {detail}")

    logger.info("\n".join(lines))


def log_server_event(text: str) -> None:
    """Ред за събитие на сървъра (изчистване, възстановяване и подобни)."""
    get_logger().info(f"[{_stamp()}]  [i] {text}")
