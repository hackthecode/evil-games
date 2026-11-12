"""Тайни лични мисии и изчисляване на напредъка им."""
from __future__ import annotations

import random
from typing import Any

from .properties import MAX_LEVEL, owns_full_group


# Бонусите следват трудността, а не темата. Скалата е:
#   200–250  минава почти от само себе си за няколко обиколки;
#   300–350  иска насочена игра, но е по силите на всеки;
#   400–500  зависи от това какво позволят съперниците;
#   600      практически решава партията, ако се получи.
MISSION_DEFINITIONS: dict[str, dict[str, Any]] = {
    # --- Лесни -------------------------------------------------------
    "traveller": {
        "title": "Обиколка на империята",
        "description": "Направете 2 пълни обиколки на таблото.",
        "target": 2,
        "unit": "обиколки",
        "bonus": 200,
    },
    "portfolio": {
        "title": "Растящо портфолио",
        "description": "Притежавайте общо 4 имота или предприятия.",
        "target": 4,
        "unit": "обекта",
        "bonus": 250,
    },
    "trader": {
        "title": "Майстор на сделките",
        "description": "Завършете успешно 2 сделки.",
        "target": 2,
        "unit": "сделки",
        "bonus": 250,
    },
    "lucky": {
        "title": "Ръка за зарове",
        "description": "Хвърлете 3 двойки през партията.",
        "target": 3,
        "unit": "двойки",
        "bonus": 250,
    },
    # --- Средни ------------------------------------------------------
    "transport": {
        "title": "Транспортен магнат",
        "description": "Притежавайте 2 транспортни предприятия.",
        "target": 2,
        "unit": "транспорта",
        "bonus": 300,
    },
    "utilities": {
        "title": "Комунален монопол",
        "description": "Притежавайте и двете комунални предприятия.",
        "target": 2,
        "unit": "предприятия",
        "bonus": 300,
    },
    "landlord": {
        "title": "Доходоносен наемодател",
        "description": "Съберете общо 250 € от наеми.",
        "target": 250,
        "unit": "€ наеми",
        "bonus": 300,
    },
    "collector": {
        "title": "Пъстро портфолио",
        "description": "Притежавайте имоти от 3 различни цветови групи.",
        "target": 3,
        "unit": "групи",
        "bonus": 300,
    },
    "globetrotter": {
        "title": "Неуморен пътешественик",
        "description": "Направете 5 пълни обиколки на таблото.",
        "target": 5,
        "unit": "обиколки",
        "bonus": 300,
    },
    "builder": {
        "title": "Градски строител",
        "description": "Постройте общо 3 нива подобрения върху имотите си.",
        "target": 3,
        "unit": "нива",
        "bonus": 350,
    },
    "cash_king": {
        "title": "Пълна каса",
        "description": "Достигнете 2000 € в брой.",
        "target": 2000,
        "unit": "€ в брой",
        "bonus": 350,
    },
    "clean_books": {
        "title": "Чисти сметки",
        "description": "Притежавайте 5 обекта, без нито един ипотекиран.",
        "target": 5,
        "unit": "неипотекирани",
        "bonus": 350,
    },
    # --- Трудни ------------------------------------------------------
    "monopoly": {
        "title": "Пълен квартал",
        "description": "Притежавайте цяла цветова група без ипотеки.",
        "target": 1,
        "unit": "група",
        "bonus": 400,
    },
    "tycoon": {
        "title": "Едра риба",
        "description": "Притежавайте общо 8 имота или предприятия.",
        "target": 8,
        "unit": "обекта",
        "bonus": 400,
    },
    "dealmaker": {
        "title": "Роден преговарящ",
        "description": "Завършете успешно 4 сделки.",
        "target": 4,
        "unit": "сделки",
        "bonus": 400,
    },
    "transport_master": {
        "title": "Господар на релсите",
        "description": "Притежавайте 3 транспортни предприятия.",
        "target": 3,
        "unit": "транспорта",
        "bonus": 400,
    },
    "rent_baron": {
        "title": "Наемен барон",
        "description": "Съберете общо 600 € от наеми.",
        "target": 600,
        "unit": "€ наеми",
        "bonus": 450,
    },
    "skyscraper": {
        "title": "Гранд хотел",
        "description": "Издигнете един имот до най-високото ниво.",
        "target": 1,
        "unit": "имот",
        "bonus": 450,
    },
    "developer": {
        "title": "Голямото строителство",
        "description": "Постройте общо 8 нива подобрения върху имотите си.",
        "target": 8,
        "unit": "нива",
        "bonus": 500,
    },
    # --- Много трудна ------------------------------------------------
    "empire": {
        "title": "Империя",
        "description": "Притежавайте 2 цели цветови групи без ипотеки.",
        "target": 2,
        "unit": "групи",
        "bonus": 600,
    },
}


def assign_secret_missions(players: list[Any], rng: random.Random) -> None:
    """Раздава по една различна мисия, доколкото наборът позволява."""
    mission_ids = list(MISSION_DEFINITIONS)
    rng.shuffle(mission_ids)
    for index, player in enumerate(players):
        player.secret_mission = mission_ids[index % len(mission_ids)]
        player.mission_completed = False


def assign_missing_secret_missions(players: list[Any], rng: random.Random) -> None:
    """Допълва мисии при възстановяване на по-стар запис, без да сменя наличните."""
    used = {player.secret_mission for player in players if player.secret_mission}
    available = [mission_id for mission_id in MISSION_DEFINITIONS if mission_id not in used]
    rng.shuffle(available)
    for player in players:
        if player.secret_mission in MISSION_DEFINITIONS:
            continue
        if not available:
            available = list(MISSION_DEFINITIONS)
            rng.shuffle(available)
        player.secret_mission = available.pop()
        player.mission_completed = False


def _colour_groups(board: Any) -> list[str]:
    """Само цветовите групи имоти.

    ``board.groups`` съдържа и „transport"/„utility". Мисиите за квартал
    говорят за цветова група, а пълният набор транспорт е отделна мисия.
    """
    groups: list[str] = []
    for group in board.groups:
        positions = board.group_positions(group)
        if positions and board.space(positions[0]).type == "property":
            groups.append(group)
    return groups


def mission_progress(
    mission_id: str, player: Any, state: Any, board: Any,
) -> tuple[int, int]:
    """Връща текущ и целеви напредък за мисията."""
    definition = MISSION_DEFINITIONS.get(mission_id)
    if definition is None:
        return 0, 1
    target = int(definition["target"])
    owned = [
        prop for prop in state.properties.values()
        if prop.owner == player.player_id
    ]
    if mission_id in ("monopoly", "empire"):
        current = sum(
            1 for group in _colour_groups(board)
            if owns_full_group(board, state.properties, player.player_id, group)
        )
    elif mission_id in ("portfolio", "tycoon"):
        current = len(owned)
    elif mission_id in ("transport", "transport_master"):
        current = sum(
            1 for prop in owned if board.space(prop.position).type == "transport"
        )
    elif mission_id == "utilities":
        current = sum(
            1 for prop in owned if board.space(prop.position).type == "utility"
        )
    elif mission_id in ("trader", "dealmaker"):
        current = int(player.stats.get("trades_completed", 0))
    elif mission_id in ("landlord", "rent_baron"):
        current = int(player.stats.get("rent_collected", 0))
    elif mission_id in ("builder", "developer"):
        current = sum(int(prop.level) for prop in owned)
    elif mission_id in ("traveller", "globetrotter"):
        current = int(player.stats.get("laps", 0))
    elif mission_id == "lucky":
        current = int(player.stats.get("doubles", 0))
    elif mission_id == "cash_king":
        # Върхът на касата, не текущата ѝ стойност: иначе мисията се губи
        # в мига, в който парите бъдат вложени в строеж.
        current = max(int(player.stats.get("max_cash", 0)), int(player.cash))
    elif mission_id == "collector":
        current = len({
            board.space(prop.position).group
            for prop in owned
            if board.space(prop.position).type == "property"
        })
    elif mission_id == "clean_books":
        # Броим само докато няма нито една ипотека — иначе целта е изпълнима
        # с 5 чисти и колкото си иска заложени обекта.
        if any(prop.mortgaged for prop in owned):
            current = 0
        else:
            current = len(owned)
    elif mission_id == "skyscraper":
        current = sum(1 for prop in owned if int(prop.level) >= MAX_LEVEL)
    else:
        current = 0
    return min(current, target), target


def mission_for_client(player: Any, state: Any, board: Any) -> dict[str, Any] | None:
    """Лична клиентска проекция; никога не се влага в чужд играч."""
    mission_id = player.secret_mission
    definition = MISSION_DEFINITIONS.get(mission_id or "")
    if definition is None:
        return None
    current, target = mission_progress(mission_id, player, state, board)
    return {
        "id": mission_id,
        "title": definition["title"],
        "description": definition["description"],
        "bonus": definition["bonus"],
        "unit": definition["unit"],
        "current": current,
        "target": target,
        "completed": bool(player.mission_completed),
    }
