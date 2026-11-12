"""Съветник за набавяне на средства при неплатено задължение."""
from __future__ import annotations

from typing import Any

from .board import Board
from .properties import (
    PropertyState, can_sell_improvement, group_has_buildings, owns_full_group,
)
from .state import GameState

# Ликвидацията върви от НАЙ-ЕВТИНИЯ имот нагоре. Скъпите имоти носят
# най-високите наеми и точно те трябва да оцелеят най-дълго, а и играчът
# очаква да загуби първо дребното.
#
# Ключът е нареден изрично, а не оставен на подредбата на кортежи: при
# равенство редът трябва да е решение, а не страничен ефект от това как се
# сравняват низовете „mortgage" и „sell".
#
# 1. цена на имота (възходящо) — носещото правило;
# 2. защита на завършена група — при равна цена първо пада имот, който не
#    разваля монопол;
# 3. по-голяма сума (низходящо) — по-малко на брой стъпки;
# 4. вид действие и 5. позиция — само за да е резултатът повторим.
ACTION_ORDER = {"sell": 0, "mortgage": 1, "sell_property": 2}

# Наказание при равна цена, ако имотът е част от завършена цветова група.
MONOPOLY_TIEBREAK = 1


def build_auto_mortgage_plan(
    state: GameState, board: Board,
) -> dict[str, Any] | None:
    """Избира допустими ипотеки до покриване на текущото задължение.

    Постройки не се продават. Имотите вървят от най-евтиния нагоре, а при
    равна цена завършените цветови групи се пазят.
    """
    debt = state.debt
    if debt is None or debt.debtor not in state.players:
        return None
    player = state.players[debt.debtor]
    shortfall = max(0, debt.amount - player.cash)
    options: list[tuple[int, int, int, int, int]] = []
    for position, prop in state.properties.items():
        if prop.owner != player.player_id or prop.mortgaged or prop.level:
            continue
        space = board.space(position)
        if (
            space.type == "property"
            and group_has_buildings(board, state.properties, space.group)
        ):
            continue
        amount = int(space.data.get("mortgage", 0))
        if amount <= 0:
            continue
        monopoly = MONOPOLY_TIEBREAK if (
            space.type == "property"
            and owns_full_group(
                board, state.properties, player.player_id, space.group
            )
        ) else 0
        options.append((
            int(space.data.get("price", 0)), monopoly, -amount,
            ACTION_ORDER["mortgage"], position,
        ))

    actions: list[dict[str, Any]] = []
    raised = 0
    for _, _, neg_amount, _, position in sorted(options):
        if raised >= shortfall:
            break
        amount = -neg_amount
        raised += amount
        actions.append({
            "type": "mortgage",
            "position": position,
            "name": board.space(position).name,
            "amount": amount,
            "cash_after": player.cash + raised,
        })
    return {
        "player_id": player.player_id,
        "debt": debt.amount,
        "cash": player.cash,
        "shortfall": shortfall,
        "raised": raised,
        "covers": player.cash + raised >= debt.amount,
        "actions": actions,
    }


def build_debt_advice(state: GameState, board: Board) -> dict[str, Any] | None:
    """Предлага последователност, започваща от най-евтините имоти."""
    debt = state.debt
    if debt is None or debt.debtor not in state.players:
        return None
    player = state.players[debt.debtor]
    shortfall = max(0, debt.amount - player.cash)
    simulated = {
        pos: PropertyState.from_dict(prop.to_dict())
        for pos, prop in state.properties.items()
    }
    actions: list[dict[str, Any]] = []
    raised = 0

    while raised < shortfall:
        options: list[tuple[int, int, int, int, int, str]] = []
        for pos, prop in simulated.items():
            if prop.owner != player.player_id:
                continue
            space = board.space(pos)
            price = int(space.data.get("price", 0))
            monopoly = MONOPOLY_TIEBREAK if (
                space.type == "property"
                and owns_full_group(board, simulated, player.player_id, space.group)
            ) else 0
            if not prop.mortgaged and prop.level == 0 and not (
                space.type == "property"
                and group_has_buildings(board, simulated, space.group)
            ):
                amount = space.data.get("mortgage", 0)
                if amount:
                    options.append((
                        price, monopoly, -amount,
                        ACTION_ORDER["mortgage"], pos, "mortgage",
                    ))
            ok, _ = can_sell_improvement(
                board, simulated, player.player_id, pos
            )
            if ok:
                amount = space.data.get("improve_cost", 0) // 2
                options.append((
                    price, monopoly, -amount,
                    ACTION_ORDER["sell"], pos, "sell",
                ))

        if not options and state.settings.sell_to_bank_enabled:
            # Последна мярка: продажба на банката. Добавя се чак когато
            # ипотеките и постройките са изчерпани, защото имотът се губи
            # безвъзвратно, докато ипотеката може да се откупи.
            for pos, prop in simulated.items():
                if prop.owner != player.player_id or prop.level:
                    continue
                space = board.space(pos)
                if space.type == "property" and group_has_buildings(
                    board, simulated, space.group
                ):
                    continue
                amount = (int(space.data.get("price", 0))
                          * int(state.settings.sell_to_bank_percent) // 100)
                if prop.mortgaged:
                    # Банката удържа главницата — вече е изплатена.
                    amount -= int(space.data.get("mortgage", 0))
                if amount <= 0:
                    continue
                monopoly = MONOPOLY_TIEBREAK if (
                    space.type == "property"
                    and owns_full_group(
                        board, simulated, player.player_id, space.group
                    )
                ) else 0
                options.append((
                    int(space.data.get("price", 0)), monopoly, -amount,
                    ACTION_ORDER["sell_property"], pos, "sell_property",
                ))
        if not options:
            break
        _, _, neg_amount, _, position, action_type = min(options)
        amount = -neg_amount
        prop = simulated[position]
        if action_type == "mortgage":
            prop.mortgaged = True
        elif action_type == "sell_property":
            del simulated[position]   # имотът напуска портфейла
        else:
            prop.level -= 1
        raised += amount
        actions.append({
            "type": action_type,
            "position": position,
            "name": board.space(position).name,
            "amount": amount,
            "cash_after": player.cash + raised,
        })

    return {
        "player_id": player.player_id,
        "debt": debt.amount,
        "cash": player.cash,
        "shortfall": shortfall,
        "raised": raised,
        "covers": player.cash + raised >= debt.amount,
        "actions": actions,
    }
