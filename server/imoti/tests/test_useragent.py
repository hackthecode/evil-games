"""Разчитане на User-Agent до браузър, система и устройство.

Редът на проверките е единствената трудност: Edge и Opera се представят и
като Chrome, а Chrome носи „Safari" в низа си. Тези тестове пазят точно
този ред.
"""
from __future__ import annotations

import pytest

from app.useragent import describe

CHROME_WIN = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
EDGE_WIN = CHROME_WIN + " Edg/131.0.2903.86"
OPERA_WIN = CHROME_WIN + " OPR/116.0.0.0"
FIREFOX_WIN = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) "
               "Gecko/20100101 Firefox/133.0")
SAFARI_MAC = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
              "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15")
CHROME_ANDROID = ("Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36")
SAFARI_IPHONE = ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) "
                 "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 "
                 "Mobile/15E148 Safari/604.1")
SAFARI_IPAD = ("Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) "
               "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 "
               "Mobile/15E148 Safari/604.1")
FIREFOX_LINUX = ("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) "
                 "Gecko/20100101 Firefox/133.0")


@pytest.mark.parametrize("ua, browser", [
    # Най-важното: по-специфичното бие по-общото.
    (EDGE_WIN, "Edge 131"),
    (OPERA_WIN, "Opera 116"),
    (CHROME_WIN, "Chrome 131"),
    (FIREFOX_WIN, "Firefox 133"),
    (SAFARI_MAC, "Safari 18"),
    # На телефон между „Version/" и „Safari" стои „Mobile/…" — първата
    # версия на израза го пропускаше и Safari на iPhone минаваше за
    # непознат браузър.
    (SAFARI_IPHONE, "Safari 18"),
    (SAFARI_IPAD, "Safari 17"),
    (CHROME_ANDROID, "Chrome 131"),
])
def test_browser_is_recognised(ua: str, browser: str) -> None:
    assert describe(ua)["browser"] == browser


@pytest.mark.parametrize("ua, system", [
    (CHROME_WIN, "Windows 10/11"),
    (SAFARI_MAC, "macOS 10.15"),
    # Android съдържа „Linux" в низа си и трябва да се хване първо.
    (CHROME_ANDROID, "Android 14"),
    (SAFARI_IPHONE, "iOS 18.1"),
    (SAFARI_IPAD, "iPadOS 17.6"),
    (FIREFOX_LINUX, "Linux"),
])
def test_system_is_recognised(ua: str, system: str) -> None:
    assert describe(ua)["system"] == system


@pytest.mark.parametrize("ua, device", [
    (CHROME_WIN, "компютър"),
    (CHROME_ANDROID, "телефон"),
    (SAFARI_IPHONE, "телефон"),
    (SAFARI_IPAD, "таблет"),
])
def test_device_is_recognised(ua: str, device: str) -> None:
    assert describe(ua)["device"] == device


def test_missing_user_agent_does_not_crash() -> None:
    for value in (None, "", "   "):
        result = describe(value)
        assert result["browser"] == "неизвестен"
        assert result["raw"] == ""


def test_unknown_user_agent_is_reported_honestly() -> None:
    """Непознат низ не бива да се представя за нещо познато."""
    result = describe("СъвсемНепознатКлиент/1.0")
    assert result["browser"] == "непознат браузър"
    assert result["system"] == "непозната система"
    # Суровият низ се пази, за да личи какво не е познато.
    assert "СъвсемНепознатКлиент" in result["raw"]


def test_raw_user_agent_is_capped() -> None:
    """Дълъг низ не бива да раздува нито лога, нито паметта."""
    assert len(describe("X" * 5000)["raw"]) == 300
