"""Конфигурируеми правила и настройки на една игра „Имоти и Империи"."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class GameSettings:
    """Настройки на стаята/играта, задавани от домакина преди старта.

    След началото на играта настройките се заключват.
    """

    max_players: int = 10
    starting_cash: int = 1500
    start_income: int = 200  # доход при преминаване през началния площад
    eu_subsidies_enabled: bool = False
    eu_subsidy_amount: int = 100  # допълнителна сума при преминаване през Старт
    trading_enabled: bool = True
    # Свободна търговия: без под на цената, без таван и данък върху
    # надценката, без ипотечна такса — пари и имоти се разменят свободно.
    free_trading: bool = False
    rules_preset: str = "classic"  # classic | quick | custom
    auctions_enabled: bool = True
    auction_seconds: int = 30  # срок, който се подновява след всяко наддаване
    auction_min_step: int = 10  # минимална стъпка при наддаване
    # Начална цена на търга за имот: пазарната стойност или мин. стъпка.
    auction_start_market: bool = False
    turn_time_limit: int = 60  # лимит на хода в секунди (0 = без лимит)
    victory_condition: str = "last_standing"  # или "round_limit"
    victory_rounds: int = 50  # брой рундове при victory_condition="round_limit"
    free_parking_jackpot: bool = False
    allow_spectators: bool = True
    room_password: str = ""  # празно = без парола
    is_public: bool = False
    # Административна проверка
    jail_fee: int = 50  # такса за излизане
    jail_max_turns: int = 3  # автоматично освобождаване след толкова хода
    doubles_to_jail: int = 3  # поредни двойни хвърляния за изпращане
    # Банков заем
    loans_enabled: bool = True
    loan_max_percent: int = 50      # таван спрямо стойността на активите
    loan_interest_percent: int = 20  # лихва за всяка пълна обиколка
    # Обиколки, през които неплатена лихва само се добавя към заема. След
    # тях недостигът минава по обичайния път за задължения (продай,
    # ипотекирай или фалирай).
    loan_grace_laps: int = 10
    # Обратно изкупуване от банката
    sell_to_bank_enabled: bool = True
    sell_to_bank_percent: int = 80
    # Прекъснали играчи
    disconnect_grace_seconds: int = 180  # период за повторно свързване

    def to_dict(self) -> dict[str, Any]:
        return {
            "max_players": self.max_players,
            "starting_cash": self.starting_cash,
            "start_income": self.start_income,
            "eu_subsidies_enabled": self.eu_subsidies_enabled,
            "eu_subsidy_amount": self.eu_subsidy_amount,
            "rules_preset": self.rules_preset,
            "trading_enabled": self.trading_enabled,
            "free_trading": self.free_trading,
            "auctions_enabled": self.auctions_enabled,
            "auction_seconds": self.auction_seconds,
            "auction_min_step": self.auction_min_step,
            "auction_start_market": self.auction_start_market,
            "turn_time_limit": self.turn_time_limit,
            "victory_condition": self.victory_condition,
            "victory_rounds": self.victory_rounds,
            "free_parking_jackpot": self.free_parking_jackpot,
            "allow_spectators": self.allow_spectators,
            "room_password": self.room_password,
            "is_public": self.is_public,
            "loans_enabled": self.loans_enabled,
            "loan_max_percent": self.loan_max_percent,
            "loan_interest_percent": self.loan_interest_percent,
            "loan_grace_laps": self.loan_grace_laps,
            "sell_to_bank_enabled": self.sell_to_bank_enabled,
            "sell_to_bank_percent": self.sell_to_bank_percent,
            "jail_fee": self.jail_fee,
            "jail_max_turns": self.jail_max_turns,
            "doubles_to_jail": self.doubles_to_jail,
            "disconnect_grace_seconds": self.disconnect_grace_seconds,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "GameSettings":
        settings = cls()
        for key, value in data.items():
            if hasattr(settings, key):
                setattr(settings, key, value)
        return settings

    def to_client(self) -> dict[str, Any]:
        """Проекция за клиента — без паролата."""
        data = self.to_dict()
        data["room_password"] = bool(self.room_password)
        return data

    # Граници за валидиране на входа от домакина.
    LIMITS: dict[str, tuple[int, int]] = None  # type: ignore[assignment]


GameSettings.LIMITS = {
    "max_players": (2, 10),
    "starting_cash": (500, 5000),
    "start_income": (0, 1000),
    "eu_subsidy_amount": (0, 2000),
    "auction_seconds": (10, 120),
    "auction_min_step": (1, 100),
    "turn_time_limit": (0, 600),
    "victory_rounds": (10, 200),
    "loan_max_percent": (10, 90),
    "loan_interest_percent": (0, 100),
    "loan_grace_laps": (0, 50),
    "sell_to_bank_percent": (30, 100),
    "jail_fee": (0, 500),
    "jail_max_turns": (1, 10),
    "doubles_to_jail": (2, 5),
    "disconnect_grace_seconds": (30, 900),
}


def validate_settings_update(data: dict[str, Any]) -> dict[str, Any]:
    """Валидира и нормализира настройки от клиента; връща само валидните ключове."""
    clean: dict[str, Any] = {}
    for key, value in data.items():
        if key in GameSettings.LIMITS:
            try:
                num = int(value)
            except (TypeError, ValueError):
                continue
            low, high = GameSettings.LIMITS[key]
            clean[key] = max(low, min(high, num))
        elif key in (
            "trading_enabled", "auctions_enabled", "allow_spectators",
            "is_public", "free_parking_jackpot", "eu_subsidies_enabled",
            "free_trading", "auction_start_market", "loans_enabled",
            "sell_to_bank_enabled",
        ):
            clean[key] = bool(value)
        elif key == "rules_preset":
            if value in ("classic", "quick", "custom"):
                clean[key] = value
        elif key == "victory_condition":
            if value in ("last_standing", "round_limit"):
                clean[key] = value
        elif key == "room_password":
            if isinstance(value, str):
                clean[key] = value[:32]
    return clean


def apply_rules_preset(settings: GameSettings, preset: str) -> None:
    """Прилага готов набор от правила, без да засяга стая/парола."""
    if preset == "classic":
        settings.rules_preset = preset
        settings.starting_cash = 1500
        settings.start_income = 200
        settings.eu_subsidies_enabled = False
        settings.eu_subsidy_amount = 100
        settings.trading_enabled = True
        settings.free_trading = False
        settings.auctions_enabled = True
        settings.auction_start_market = False
        settings.turn_time_limit = 0
        settings.victory_condition = "last_standing"
        settings.free_parking_jackpot = False
    elif preset == "quick":
        settings.rules_preset = preset
        settings.starting_cash = 1200
        settings.start_income = 200
        settings.eu_subsidies_enabled = False
        settings.eu_subsidy_amount = 100
        settings.trading_enabled = True
        settings.free_trading = False
        settings.auctions_enabled = True
        settings.auction_start_market = False
        settings.turn_time_limit = 45
        settings.victory_condition = "round_limit"
        settings.victory_rounds = 30
        settings.free_parking_jackpot = True
    elif preset == "custom":
        settings.rules_preset = preset
