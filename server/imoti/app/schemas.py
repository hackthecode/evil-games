"""Pydantic схеми за валидиране на входните данни от Socket.IO събития."""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class CreateRoomPayload(BaseModel):
    """Данни за създаване на стая."""

    name: str = Field(min_length=1, max_length=20)
    token: str = Field(default="red", max_length=20)
    gender: str = Field(default="male", pattern="^(male|female)$")
    settings: dict = Field(default_factory=dict, max_length=30)


class JoinRoomPayload(BaseModel):
    """Данни за присъединяване към стая."""

    room_code: str = Field(min_length=6, max_length=6)
    name: str = Field(min_length=1, max_length=20)
    token: str = Field(default="red", max_length=20)
    gender: str = Field(default="male", pattern="^(male|female)$")
    password: str = Field(default="", max_length=32)
    as_spectator: bool = False


class ReconnectPayload(BaseModel):
    """Повторно свързване чрез записан токен."""

    reconnect_token: str = Field(min_length=10, max_length=200)


class ChatPayload(BaseModel):
    """Чат съобщение."""

    text: str = Field(min_length=1, max_length=300)


class BidPayload(BaseModel):
    """Наддаване в търг."""

    amount: int = Field(ge=1, le=1_000_000)
    position: int | None = Field(default=None, ge=0, le=39)


class PositionPayload(BaseModel):
    """Действие върху конкретно поле (строеж, ипотека и т.н.)."""

    position: int = Field(ge=0, le=39)


class GroupPayload(BaseModel):
    """Действие върху цяла цветова група (напр. групово строене)."""

    group: str = Field(min_length=1, max_length=40)


class TradePayload(BaseModel):
    """Създаване на оферта за сделка."""

    to_player: str = Field(min_length=8, max_length=64)
    offer_cash: int = Field(default=0, ge=0, le=1_000_000)
    offer_properties: list[int] = Field(default_factory=list, max_length=40)
    offer_jail_cards: int = Field(default=0, ge=0, le=10)
    request_cash: int = Field(default=0, ge=0, le=1_000_000)
    request_properties: list[int] = Field(default_factory=list, max_length=40)
    request_jail_cards: int = Field(default=0, ge=0, le=10)
    counter_of: str | None = Field(default=None, max_length=32)

    @field_validator("offer_properties", "request_properties")
    @classmethod
    def _positions_in_range(cls, value: list[int]) -> list[int]:
        for pos in value:
            if not 0 <= pos <= 39:
                raise ValueError("Позицията е извън таблото.")
        return value


class TradeResponsePayload(BaseModel):
    """Отговор на оферта."""

    trade_id: str = Field(min_length=4, max_length=32)
    accept: bool


class TradeCancelPayload(BaseModel):
    """Оттегляне на оферта."""

    trade_id: str = Field(min_length=4, max_length=32)


class CardChoicePayload(BaseModel):
    """Избор по изтеглена карта: сигурният вариант или залогът."""

    option: str = Field(pattern="^(safe|risky)$")


class MortgageDecisionPayload(BaseModel):
    """Избор кои наследени ипотеки да се откупят незабавно."""

    positions: list[int] = Field(default_factory=list, max_length=40)

    @field_validator("positions")
    @classmethod
    def _valid_positions(cls, value: list[int]) -> list[int]:
        if any(not 0 <= pos <= 39 for pos in value):
            raise ValueError("Позицията е извън таблото.")
        return value


class SettingsPayload(BaseModel):
    """Актуализация на настройките на стаята от домакина (свободен речник,
    валидиран допълнително от rules.validate_settings_update)."""

    settings: dict = Field(default_factory=dict)


class LoanPayload(BaseModel):
    """Сума за теглене или погасяване на банков заем."""

    amount: int = Field(ge=1, le=1_000_000)


class KickPayload(BaseModel):
    """Премахване/пропускане на играч от домакина.

    ``force`` идва само от администраторския панел: там домакинът съзнателно
    действа и върху свързан играч, след изрично потвърждение.
    """

    player_id: str = Field(min_length=8, max_length=64)
    force: bool = False


class BotPayload(BaseModel):
    """Добавяне на компютърен играч с избран характер."""

    style: str = Field(default="balanced", pattern="^(cautious|balanced|aggressive)$")
