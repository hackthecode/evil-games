"""Състояние и логика на имотите (собственост, подобрения, ипотеки, наем)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .board import Board

# Максимално ниво на подобрение: 0=Незастроен .. 5=Гранд хотел.
# Нивата 1–4 се броят като „къщи"; ниво 5 е „хотел".
MAX_LEVEL = 5

# Банката изкупува имот обратно за този дял от цената му.
SELL_TO_BANK_PERCENT = 80

# Банков заем: таван спрямо стойността на активите и лихва на всеки ход
# на длъжника. Таванът се проверява само при отпускане.
LOAN_MAX_PERCENT = 50
LOAN_INTEREST_PERCENT = 20

# Строителен фонд на банката: ограничен брой къщи и хотели.
HOUSE_POOL = 32
HOTEL_POOL = 12


@dataclass
class PropertyState:
    """Динамично състояние на едно притежаемо поле."""

    position: int
    owner: str | None = None
    level: int = 0  # 0..MAX_LEVEL, само за имоти (не за транспорт/комунални)
    mortgaged: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "position": self.position,
            "owner": self.owner,
            "level": self.level,
            "mortgaged": self.mortgaged,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PropertyState":
        return cls(
            position=data["position"],
            owner=data.get("owner"),
            level=data.get("level", 0),
            mortgaged=data.get("mortgaged", False),
        )


def owns_full_group(
    board: Board, states: dict[int, PropertyState], owner: str, group: str
) -> bool:
    """Проверява дали ``owner`` притежава всички имоти от групата (без ипотека)."""
    positions = board.group_positions(group)
    if not positions:
        return False
    for pos in positions:
        state = states.get(pos)
        if state is None or state.owner != owner or state.mortgaged:
            return False
    return True


def count_group_owned(
    board: Board, states: dict[int, PropertyState], owner: str, group: str
) -> int:
    """Брой имоти от групата, притежавани от ``owner``."""
    total = 0
    for pos in board.group_positions(group):
        state = states.get(pos)
        if state and state.owner == owner:
            total += 1
    return total


def buildings_in_play(states: dict[int, PropertyState]) -> tuple[int, int]:
    """Брой (къщи, хотели) върху таблото в момента.

    Имот на ниво 1–4 държи толкова къщи; ниво 5 държи един хотел.
    """
    houses = 0
    hotels = 0
    for state in states.values():
        if 1 <= state.level <= 4:
            houses += state.level
        elif state.level == 5:
            hotels += 1
    return houses, hotels


def bank_stock(states: dict[int, PropertyState]) -> tuple[int, int]:
    """Свободни (къщи, хотели) в банката."""
    houses, hotels = buildings_in_play(states)
    return HOUSE_POOL - houses, HOTEL_POOL - hotels


def group_has_buildings(
    board: Board, states: dict[int, PropertyState], group: str | None
) -> bool:
    """Дали някой имот от групата има постройки (пречи на ипотека/размяна)."""
    if not group:
        return False
    for pos in board.group_positions(group):
        state = states.get(pos)
        if state and state.level > 0:
            return True
    return False


def count_type_owned(
    board: Board, states: dict[int, PropertyState], owner: str, space_type: str
) -> int:
    """Брой полета от даден тип (transport/utility), притежавани от ``owner``."""
    total = 0
    for space in board.spaces:
        if space.type != space_type:
            continue
        state = states.get(space.position)
        if state and state.owner == owner:
            total += 1
    return total


def calculate_rent(
    board: Board,
    states: dict[int, PropertyState],
    position: int,
    dice_total: int,
) -> int:
    """Изчислява дължимия наем за стъпване на дадено поле.

    Обхваща имоти (с нива на подобрение и бонус за пълна група), транспортни
    предприятия (наем според броя притежавани) и комунални предприятия (наем
    като кратно на резултата от заровете).
    """
    state = states.get(position)
    if state is None or state.owner is None or state.mortgaged:
        return 0

    space = board.space(position)
    owner = state.owner

    if space.type == "property":
        rent_table: list[int] = space.data["rent"]
        if state.level == 0:
            base = rent_table[0]
            # Бонус за пълна група без подобрения: удвоен базов наем.
            if owns_full_group(board, states, owner, space.group):
                return base * 2
            return base
        return rent_table[state.level]

    if space.type == "transport":
        owned = count_type_owned(board, states, owner, "transport")
        rent_table = space.data["rent"]
        idx = max(0, min(owned - 1, len(rent_table) - 1))
        return rent_table[idx]

    if space.type == "utility":
        owned = count_type_owned(board, states, owner, "utility")
        multipliers: list[int] = space.data["rent_multiplier"]
        idx = max(0, min(owned - 1, len(multipliers) - 1))
        return multipliers[idx] * max(dice_total, 1)

    return 0


def can_build(
    board: Board, states: dict[int, PropertyState], owner: str, position: int,
    check_stock: bool = True,
) -> tuple[bool, str]:
    """Проверява дали може да се построи подобрение (равномерно разпределение)."""
    space = board.space(position)
    if space.type != "property":
        return False, "Само имоти могат да се подобряват."
    state = states.get(position)
    if state is None or state.owner != owner:
        return False, "Не притежавате този имот."
    if state.mortgaged:
        return False, "Ипотекиран имот не може да се подобрява."
    if not owns_full_group(board, states, owner, space.group):
        return False, "Нужна е пълна група без ипотеки."
    if state.level >= MAX_LEVEL:
        return False, "Достигнато е максималното ниво."
    # Равномерно разпределение: не може да строите, ако друг имот в групата
    # е с по-ниско ниво.
    for pos in board.group_positions(space.group):
        other = states.get(pos)
        other_level = other.level if other else 0
        if other_level < state.level:
            return False, "Подобренията в групата трябва да са равномерни."
    # Строителен фонд на банката.
    if check_stock:
        houses_free, hotels_free = bank_stock(states)
        target = state.level + 1
        if target <= 4 and houses_free < 1:
            return False, "В банката няма свободни къщи."
        if target == 5 and hotels_free < 1:
            return False, "В банката няма свободни хотели."
    return True, ""


def can_sell_improvement(
    board: Board, states: dict[int, PropertyState], owner: str, position: int
) -> tuple[bool, str]:
    """Проверява дали може да се продаде подобрение (равномерно разпределение)."""
    space = board.space(position)
    if space.type != "property":
        return False, "Само имоти имат подобрения."
    state = states.get(position)
    if state is None or state.owner != owner:
        return False, "Не притежавате този имот."
    if state.level <= 0:
        return False, "Няма подобрения за продажба."
    # Равномерно разпределение: не може да продавате, ако друг имот е с по-високо ниво.
    for pos in board.group_positions(space.group):
        other = states.get(pos)
        other_level = other.level if other else 0
        if other_level > state.level:
            return False, "Продажбата трябва да пази равномерност в групата."
    # Разваляне на хотел: нужни са 4 свободни къщи от банката.
    if state.level == 5:
        houses_free, _ = bank_stock(states)
        if houses_free < 4:
            return False, "За разваляне на хотела са нужни 4 свободни къщи в банката."
    return True, ""
