"""Разчитане на ``User-Agent`` до четим вид: браузър, система, устройство.

Нарочно без външна библиотека: нужни са няколко реда за случаите, които
реално се срещат при игра в приятелски кръг, а всяка зависимост тук се
плаща при всяко инсталиране.

Редът на проверките е важен и е единствената трудност в модула:
Edge се представя и като Chrome, Opera — също, а Chrome носи „Safari" в
низа си. Затова по-специфичното се проверява първо.
"""
from __future__ import annotations

import re

# (име, регулярен израз за версията). Редът е от по-специфично към по-общо.
_BROWSERS: tuple[tuple[str, str], ...] = (
    ("Edge", r"Edg(?:e|A|iOS)?/(\d+)"),
    ("Opera", r"OPR/(\d+)"),
    ("Samsung Internet", r"SamsungBrowser/(\d+)"),
    ("Vivaldi", r"Vivaldi/(\d+)"),
    ("Brave", r"Brave/(\d+)"),
    ("Yandex", r"YaBrowser/(\d+)"),
    ("Firefox", r"(?:Firefox|FxiOS)/(\d+)"),
    ("Chrome", r"(?:Chrome|CriOS)/(\d+)"),
    # На телефон между „Version/" и „Safari" стои „Mobile/…", затова тази
    # част е по избор — иначе Safari на iPhone минава за непознат браузър.
    ("Safari", r"Version/(\d+)[\d.]*(?: Mobile/\S+)? Safari"),
)

_OS_PATTERNS: tuple[tuple[str, str], ...] = (
    # Android се проверява преди Linux — той съдържа „Linux" в низа си.
    ("Android", r"Android (\d+(?:\.\d+)?)"),
    ("iPadOS", r"iPad.*?OS (\d+)[_.](\d+)"),
    ("iOS", r"(?:iPhone|iPod).*?OS (\d+)[_.](\d+)"),
    ("Windows", r"Windows NT (\d+\.\d+)"),
    ("macOS", r"Mac OS X (\d+)[_.](\d+)"),
    ("Chrome OS", r"CrOS \S+ (\d+)"),
    ("Linux", r"(Linux)"),
)

# Windows NT няма пряко съответствие с търговското име.
_WINDOWS_NAMES = {
    "10.0": "10/11",   # двете са неразличими от User-Agent
    "6.3": "8.1",
    "6.2": "8",
    "6.1": "7",
}


def _browser(ua: str) -> str:
    for name, pattern in _BROWSERS:
        match = re.search(pattern, ua)
        if match:
            return f"{name} {match.group(1)}"
    return "непознат браузър"


def _system(ua: str) -> str:
    for name, pattern in _OS_PATTERNS:
        match = re.search(pattern, ua)
        if not match:
            continue
        if name == "Windows":
            return f"Windows {_WINDOWS_NAMES.get(match.group(1), match.group(1))}"
        if name == "Linux":
            return "Linux"
        if name in ("macOS", "iOS", "iPadOS"):
            return f"{name} {match.group(1)}.{match.group(2)}"
        return f"{name} {match.group(1)}"
    return "непозната система"


def _device(ua: str) -> str:
    if re.search(r"iPad|Tablet|PlayBook|Silk", ua):
        return "таблет"
    if re.search(r"Mobi|Android.*Mobile|iPhone|iPod|Windows Phone", ua):
        return "телефон"
    if re.search(r"TV|SmartTV|Console|PlayStation|Xbox", ua):
        return "телевизор/конзола"
    return "компютър"


def describe(user_agent: str | None) -> dict[str, str]:
    """Браузър, система и вид устройство от ``User-Agent``."""
    ua = (user_agent or "").strip()
    if not ua:
        return {
            "browser": "неизвестен",
            "system": "неизвестна",
            "device": "неизвестно",
            "raw": "",
        }
    return {
        "browser": _browser(ua),
        "system": _system(ua),
        "device": _device(ua),
        # Пълният низ се пази за случаите, в които разчитането не е познало.
        "raw": ua[:300],
    }
