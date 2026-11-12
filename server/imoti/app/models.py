"""SQLAlchemy модели за трайно съхранение на игри."""
from __future__ import annotations

import time

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Базов клас за всички модели."""


class SavedGame(Base):
    """Запис на игра — автоматично или ръчно записано състояние.

    Състоянието се пази като JSON текст (сериализиран чрез
    :mod:`app.game.serialization`) с версия на формата вътре в данните.
    """

    __tablename__ = "saved_games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_code: Mapped[str] = mapped_column(String(6), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | finished
    state_json: Mapped[str] = mapped_column(Text)
    # Данни за стаята (играчи, токени за reconnect), също JSON.
    room_json: Mapped[str] = mapped_column(Text, default="{}")
    updated_at: Mapped[float] = mapped_column(Float, default=time.time, index=True)


class GameResult(Base):
    """Резултатът от завършена партия — малък и траен.

    Пълното състояние на завършена игра тежи над 100 KB и не служи за
    нищо, освен да се показва класацията. Затова изводът се записва тук
    (около килобайт), а самото състояние подлежи на изчистване. Така
    базата не расте, а историята на партиите остава.
    """

    __tablename__ = "game_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_code: Mapped[str] = mapped_column(String(6), index=True)
    finished_at: Mapped[float] = mapped_column(Float, default=time.time, index=True)
    winner_id: Mapped[str] = mapped_column(String(64), default="")
    winner_name: Mapped[str] = mapped_column(String(64), default="")
    rounds: Mapped[int] = mapped_column(Integer, default=0)
    # Класацията в реда, в който е показана на финалния екран: име, жетон,
    # богатство, отпаднал ли е и няколко ключови числа. JSON, защото броят
    # играчи е променлив, а данните се четат наведнъж.
    players_json: Mapped[str] = mapped_column(Text, default="[]")
