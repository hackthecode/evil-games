"""Периодични глобални събития, които временно променят икономиката."""
from __future__ import annotations

import random
from typing import Any


GLOBAL_EVENT_DEFINITIONS: dict[str, dict[str, Any]] = {
    "property_boom": {
        "title": "Имотен бум",
        "icon": "📈",
        "description": "Всички наеми са увеличени с 25%.",
        "modifiers": {"rent_percent": 125},
    },
    "economic_crisis": {
        "title": "Икономическа криза",
        "icon": "📉",
        "description": "Строежите са с 50% по-скъпи.",
        "modifiers": {"build_cost_percent": 150},
    },
    "tourist_season": {
        "title": "Туристически сезон",
        "icon": "🧳",
        "description": "Транспортните наеми са удвоени.",
        "modifiers": {"transport_rent_percent": 200},
    },
    "tax_amnesty": {
        "title": "Данъчна амнистия",
        "icon": "🕊️",
        "description": "При стъпване на данъчно поле не се плаща данък.",
        "modifiers": {"tax_percent": 0},
    },
    "construction_boom": {
        "title": "Строителен подем",
        "icon": "🏗️",
        "description": "Строежите са с 25% по-евтини.",
        "modifiers": {"build_cost_percent": 75},
    },
    "energy_crisis": {
        "title": "Енергийна криза",
        "icon": "⚡",
        "description": "Наемите на комуналните предприятия са увеличени с 50%.",
        "modifiers": {"utility_rent_percent": 150},
    },
    "bank_incentive": {
        "title": "Банков стимул",
        "icon": "🏦",
        "description": "Доходът при преминаване през началото е увеличен с 50%.",
        "modifiers": {"start_income_percent": 150},
    },
    "rent_freeze": {
        "title": "Замразяване на наемите",
        "icon": "❄️",
        "description": "Всички наеми са намалени с 25%.",
        "modifiers": {"rent_percent": 75},
    },
    "luxury_demand": {
        "title": "Търсене на луксозни имоти",
        "icon": "💎",
        "description": "Всички наеми са увеличени с 50%.",
        "modifiers": {"rent_percent": 150},
    },
    "tax_reform": {
        "title": "Данъчна реформа",
        "icon": "🧾",
        "description": "Данъчните полета вземат с 50% повече.",
        "modifiers": {"tax_percent": 150},
    },
    "transport_strike": {
        "title": "Транспортна стачка",
        "icon": "🚧",
        "description": "Транспортните наеми са наполовина.",
        "modifiers": {"transport_rent_percent": 50},
    },
    "green_energy": {
        "title": "Зелена енергия",
        "icon": "🌱",
        "description": "Наемите на комуналните предприятия са наполовина.",
        "modifiers": {"utility_rent_percent": 50},
    },
    "austerity": {
        "title": "Бюджетни икономии",
        "icon": "✂️",
        "description": "Доходът при преминаване през началото е наполовина.",
        "modifiers": {"start_income_percent": 50},
    },
    "material_shortage": {
        "title": "Недостиг на материали",
        "icon": "🧱",
        "description": "Строежите струват двойно.",
        "modifiers": {"build_cost_percent": 200},
    },
    "eu_programme": {
        "title": "Европейска програма",
        "icon": "🛠️",
        "description": (
            "Строежите са с 40% по-евтини, а доходът от началото — с 25% по-висок."
        ),
        "modifiers": {"build_cost_percent": 60, "start_income_percent": 125},
    },
}


def choose_global_event(
    rng: random.Random, previous_id: str | None, round_number: int,
) -> dict[str, Any]:
    """Избира събитие, различно от последното, за два пълни рунда."""
    choices = [key for key in GLOBAL_EVENT_DEFINITIONS if key != previous_id]
    event_id = rng.choice(choices)
    definition = GLOBAL_EVENT_DEFINITIONS[event_id]
    return {
        "id": event_id,
        "title": definition["title"],
        "icon": definition["icon"],
        "description": definition["description"],
        "modifiers": dict(definition["modifiers"]),
        "started_round": round_number,
        "ends_round": round_number + 2,
    }
