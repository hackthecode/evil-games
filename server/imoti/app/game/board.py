"""Дефиниция на игровото табло за „Имоти и Империи".

Таблото се зарежда от ``data/board_config.json`` — напълно оригинален набор от
36 полета с българска тематика (град, икономика, туризъм, предприемачество).
Модулът предоставя удобен достъп до полетата, цветовите групи и членството на
имотите в групи.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Space:
    """Едно поле от таблото (неизменяема статична дефиниция)."""

    position: int
    type: str  # corner | property | transport | utility | tax | card
    name: str
    data: dict[str, Any] = field(default_factory=dict)

    @property
    def group(self) -> str | None:
        """Цветова/логическа група, ако полето е притежаемо."""
        return self.data.get("group")

    @property
    def price(self) -> int | None:
        """Цена за покупка, ако полето е притежаемо."""
        return self.data.get("price")

    @property
    def is_ownable(self) -> bool:
        """Дали полето може да бъде притежавано."""
        return self.type in ("property", "transport", "utility")


class Board:
    """Игровото табло — зарежда конфигурацията и предлага справки за полетата."""

    def __init__(self, config: dict[str, Any]) -> None:
        self._config = config
        self.size: int = config["size"]
        self.improvement_levels: list[str] = config["improvement_levels"]
        self.groups: dict[str, dict[str, Any]] = config["groups"]

        self._spaces: list[Space] = []
        for raw in config["spaces"]:
            data = {k: v for k, v in raw.items() if k not in ("position", "type", "name")}
            self._spaces.append(
                Space(position=raw["position"], type=raw["type"], name=raw["name"], data=data)
            )
        self._spaces.sort(key=lambda s: s.position)

        # Предварително изчислени членства в групи (позиции по група).
        self._group_members: dict[str, list[int]] = {}
        for space in self._spaces:
            if space.group:
                self._group_members.setdefault(space.group, []).append(space.position)

    @classmethod
    def from_file(cls, path: str | Path) -> "Board":
        """Създава табло от JSON файл с конфигурация."""
        with open(path, "r", encoding="utf-8") as handle:
            config = json.load(handle)
        return cls(config)

    def space(self, position: int) -> Space:
        """Връща полето на дадена позиция."""
        return self._spaces[position % self.size]

    @property
    def spaces(self) -> list[Space]:
        """Всички полета в ред на позициите."""
        return list(self._spaces)

    def group_positions(self, group: str) -> list[int]:
        """Всички позиции, принадлежащи на дадена група."""
        return list(self._group_members.get(group, []))

    def group_size(self, group: str) -> int:
        """Брой имоти в дадена група (нужни за пълна група)."""
        return len(self._group_members.get(group, []))

    def find_corner(self, subtype: str) -> int | None:
        """Намира позицията на ъглово поле по неговия подтип."""
        for space in self._spaces:
            if space.type == "corner" and space.data.get("subtype") == subtype:
                return space.position
        return None

    def to_client(self) -> dict[str, Any]:
        """Сериализира статичното табло за изпращане към клиента."""
        return {
            "size": self.size,
            "improvement_levels": self.improvement_levels,
            "groups": self.groups,
            "spaces": [
                {"position": s.position, "type": s.type, "name": s.name, **s.data}
                for s in self._spaces
            ],
        }
