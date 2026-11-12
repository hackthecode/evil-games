"""Сървърни стратегии за компютърни играчи."""
from __future__ import annotations

import math
from typing import Any

from .cards import jail_card_mode
from .engine import GameEngine, GameError
from .properties import can_build, can_sell_improvement, group_has_buildings
from .state import Phase, TradeOffer
from .trading import (
    TRADE_PREMIUM_LIMIT_PCT,
    TRADE_PREMIUM_MIN,
    TRADE_PREMIUM_TAX_PCT,
    property_trade_value,
)


# „sweetener" е надценката (като дял от стойността на имота), която ботът е
# готов да добави над цената, за да убеди противника да се раздели с имот,
# затварящ група. Агресивният плаща скъпо за монопол, предпазливият — не.
BOT_STYLES = {
    "cautious": {"reserve": 500, "buy_factor": 0.9, "trade_factor": 1.12, "sweetener": 0.35},
    "balanced": {"reserve": 300, "buy_factor": 1.05, "trade_factor": 1.0, "sweetener": 0.6},
    "aggressive": {"reserve": 120, "buy_factor": 1.25, "trade_factor": 0.9, "sweetener": 0.9},
}


def _style(engine: GameEngine, player_id: str) -> dict[str, float]:
    player = engine.state.players[player_id]
    return BOT_STYLES.get(player.bot_style, BOT_STYLES["balanced"])


def _property_value(engine: GameEngine, position: int, receiver: str) -> int:
    space = engine.board.space(position)
    # Имотът може да е изчезнал, откакто офертата е създадена — например
    # продаден обратно на банката. Стойността му тогава е нула и ботът
    # просто отказва сделката, вместо да се счупи.
    prop = engine.state.properties.get(position)
    if prop is None:
        return 0
    value = int(space.data.get("price", 0) * (0.55 if prop.mortgaged else 1.0))
    value += prop.level * space.data.get("improve_cost", 0)
    if space.type == "property" and space.group:
        group = engine.board.group_positions(space.group)
        owned = sum(
            1 for pos in group
            if engine.state.properties.get(pos)
            and engine.state.properties[pos].owner == receiver
        )
        if owned + 1 == len(group):
            value += int(space.data.get("price", 0) * 0.8)
    return value


def _trade_value(engine: GameEngine, trade: TradeOffer, for_player: str) -> tuple[int, int]:
    if for_player == trade.to_player:
        received_cash, given_cash = trade.offer_cash, trade.request_cash
        received_props, given_props = trade.offer_properties, trade.request_properties
        received_cards, given_cards = trade.offer_jail_cards, trade.request_jail_cards
    else:
        received_cash, given_cash = trade.request_cash, trade.offer_cash
        received_props, given_props = trade.request_properties, trade.offer_properties
        received_cards, given_cards = trade.request_jail_cards, trade.offer_jail_cards
    received = received_cash + received_cards * 100 + sum(
        _property_value(engine, pos, for_player) for pos in received_props
    )
    given = given_cash + given_cards * 100 + sum(
        _property_value(engine, pos, trade.from_player if for_player == trade.to_player else trade.to_player)
        for pos in given_props
    )
    return received, given


def _counter_extra_cost(
    engine: GameEngine, incoming: TradeOffer, counter_cash: int
) -> int:
    """Какво ОСВЕН исканата сума ще плати насрещната страна по контраофертата.

    Правилата облагат надплащащия с данък и начисляват ипотечна такса на
    получателя на ипотекиран имот. Ботът проверяваше само чистата сума и
    затова понякога предлагаше сделка, която правилата отхвърлят — това
    прекъсваше целия му ход.
    """
    state = engine.state
    if state.settings.free_trading:
        return 0
    # Насрещната страна получава имотите, които тя първоначално е поискала.
    fee = sum(
        engine.board.space(pos).data.get("mortgage", 0) // 10
        for pos in incoming.request_properties
        if state.properties.get(pos) and state.properties[pos].mortgaged
    )
    # Стойност на двете страни на контраофертата (огледало на trading.py).
    given_value = sum(
        property_trade_value(state, engine.board, pos)
        for pos in incoming.request_properties
    ) + incoming.request_cash + incoming.request_jail_cards * 100
    got_value = sum(
        property_trade_value(state, engine.board, pos)
        for pos in incoming.offer_properties
    ) + counter_cash + incoming.offer_jail_cards * 100
    # Данък плаща този, който дава повече стойност — тук насрещната страна.
    premium = max(0, got_value - given_value)
    return fee + premium * TRADE_PREMIUM_TAX_PCT // 100


def _max_bid(engine: GameEngine, player_id: str, position: int) -> int:
    player = engine.state.players[player_id]
    cfg = _style(engine, player_id)
    auction = engine.state.auction
    if auction and auction.kind in ("house", "hotel"):
        target = auction.targets[player_id]
        space = engine.board.space(target)
        strategic = int(space.data["improve_cost"] * cfg["buy_factor"] * 1.35)
    else:
        space = engine.board.space(position)
        strategic = _property_value_for_free(engine, position, player_id)
    affordable = max(0, player.cash - int(cfg["reserve"]))
    ceiling = space.data.get("price", space.data.get("improve_cost", strategic)) * 2
    return min(affordable, int(strategic * cfg["buy_factor"]), ceiling)


def _property_value_for_free(engine: GameEngine, position: int, player_id: str) -> int:
    space = engine.board.space(position)
    value = space.price
    if space.type == "property" and space.group:
        group = engine.board.group_positions(space.group)
        owned = sum(
            1 for pos in group
            if engine.state.properties.get(pos)
            and engine.state.properties[pos].owner == player_id
        )
        if owned + 1 == len(group):
            value = int(value * 1.75)
    return value


def _pick_unmortgage(engine: GameEngine, player_id: str) -> int | None:
    """Най-полезната ипотека за откупуване, ако ботът може да си я позволи.

    Ипотекираният имот не носи наем и блокира строежа в групата си, така че
    свободните пари над резерва се връщат първо в имот от завършена група,
    а после в най-скъпия — там спреният приход е най-голям.
    """
    state = engine.state
    player = state.players[player_id]
    budget = player.cash - int(_style(engine, player_id)["reserve"])
    if budget <= 0:
        return None

    candidates: list[tuple[int, int, int]] = []
    for pos, prop in state.properties.items():
        if prop.owner != player_id or not prop.mortgaged:
            continue
        space = engine.board.space(pos)
        principal = space.data.get("mortgage", 0)
        cost = principal + principal // 10
        if cost > budget:
            continue
        complete = False
        if space.type == "property" and space.group:
            group = engine.board.group_positions(space.group)
            complete = all(
                state.properties.get(item) and state.properties[item].owner == player_id
                for item in group
            )
        # Сортиране: първо завършените групи, после по-скъпите имоти.
        candidates.append((0 if complete else 1, -space.data.get("price", 0), pos))
    if not candidates:
        return None
    return min(candidates)[2]


def _monopoly_targets(engine: GameEngine, player_id: str) -> list[tuple[int, int, str]]:
    """Чужди имоти, всеки от които сам затваря група на бота.

    Връща (позиция, стойност за сделка, собственик), подредени по стойност —
    най-евтиният монопол се преследва пръв.
    """
    state = engine.state
    targets: list[tuple[int, int, str]] = []
    for pos, prop in state.properties.items():
        space = engine.board.space(pos)
        if space.type != "property" or not space.group:
            continue
        owner = state.players.get(prop.owner) if prop.owner else None
        if owner is None or owner.player_id == player_id or owner.bankrupt:
            continue
        group = engine.board.group_positions(space.group)
        mine = sum(
            1 for item in group
            if state.properties.get(item) and state.properties[item].owner == player_id
        )
        if mine != len(group) - 1:
            continue
        # Имот от група с постройки не може да се разменя (правило на играта).
        if group_has_buildings(engine.board, state.properties, space.group):
            continue
        targets.append((pos, property_trade_value(state, engine.board, pos), prop.owner))
    targets.sort(key=lambda item: item[1])
    return targets


def _already_negotiated(engine: GameEngine, player_id: str, to_player: str, position: int) -> bool:
    """Дали ботът вече е предлагал този имот на този играч.

    Пази от повтаряне на една и съща оферта всеки ход. Историята се пази до
    20 оферти, така че след време ботът може да опита отново — както би
    направил и жив играч.
    """
    return any(
        trade.from_player == player_id
        and trade.to_player == to_player
        and position in trade.request_properties
        for trade in engine.state.trades.values()
    )


def _plan_monopoly_offer(engine: GameEngine, player_id: str) -> dict[str, Any] | None:
    """Подготвя парична оферта за имот, който затваря група на бота.

    Цената трябва да мине през правилата за търговия: поне стойността на
    имота (под), плюс надценка в рамките на допустимия таван, като ботът
    покрива и данъка върху надценката, и ипотечната такса.
    """
    state = engine.state
    player = state.players[player_id]
    cfg = _style(engine, player_id)
    reserve = int(cfg["reserve"])
    free = bool(state.settings.free_trading)

    # Една активна оферта наведнъж — иначе ботът затрупва противника.
    if any(
        trade.from_player == player_id and trade.status == "pending"
        for trade in state.trades.values()
    ):
        return None

    for position, value, owner_id in _monopoly_targets(engine, player_id):
        if _already_negotiated(engine, player_id, owner_id, position):
            continue
        space = engine.board.space(position)
        fee = 0
        if not free and state.properties[position].mortgaged:
            fee = space.data.get("mortgage", 0) // 10

        allowance = (
            value * 10 if free
            else max(TRADE_PREMIUM_MIN, value * TRADE_PREMIUM_LIMIT_PCT // 100)
        )
        premium = min(int(value * cfg["sweetener"]), allowance)
        # Смъква надценката, докато офертата се побере в резерва.
        while premium > 0:
            tax = 0 if free else premium * TRADE_PREMIUM_TAX_PCT // 100
            if player.cash - (value + premium + tax + fee) >= reserve:
                break
            premium = premium * 3 // 4 if premium > 20 else 0
        tax = 0 if free else premium * TRADE_PREMIUM_TAX_PCT // 100
        total = value + premium + tax + fee
        if value <= 0 or player.cash - total < reserve:
            continue
        # Монополът трябва да си струва цената.
        if total > _property_value_for_free(engine, position, player_id) * cfg["buy_factor"]:
            continue
        return {"to_player": owner_id, "position": position, "cash": value + premium}
    return None


def choose_bot(engine: GameEngine) -> str | None:
    """Избира бот, който има действие в текущото състояние."""
    state = engine.state
    if state.phase == Phase.AWAITING_PAYMENT and state.debt:
        debtor = state.players.get(state.debt.debtor)
        if debtor and debtor.is_bot and not debtor.bankrupt:
            return debtor.player_id
    if state.phase == Phase.AWAITING_MORTGAGE_DECISION and state.pending_mortgage_transfer:
        player = state.players.get(state.pending_mortgage_transfer.player_id)
        if player and player.is_bot and not player.bankrupt:
            return player.player_id
    if state.phase == Phase.AWAITING_CARD_CHOICE and state.pending_card_choice:
        player = state.players.get(state.pending_card_choice.player_id)
        if player and player.is_bot and not player.bankrupt:
            return player.player_id
    if state.phase in (Phase.WAITING_FOR_ROLL, Phase.MANAGEMENT):
        for trade in state.trades.values():
            player = state.players.get(trade.to_player)
            if trade.status == "pending" and player and player.is_bot and not player.bankrupt:
                return player.player_id
    if state.phase == Phase.AWAITING_AUCTION and state.auction:
        for pid in state.auction.participants:
            player = state.players.get(pid)
            if not player or not player.is_bot or player.bankrupt:
                continue
            if state.auction.highest_bidder == pid:
                continue
            return pid
        return None
    current = state.current_player
    return current.player_id if current and current.is_bot and not current.bankrupt else None


def play_bot_step(engine: GameEngine, player_id: str) -> list[dict[str, Any]]:
    """Изпълнява едно решение. Повтарящият цикъл е в socket слоя."""
    state = engine.state
    player = state.players[player_id]
    cfg = _style(engine, player_id)

    incoming = next((
        trade for trade in state.trades.values()
        if state.phase in (Phase.WAITING_FOR_ROLL, Phase.MANAGEMENT)
        and trade.status == "pending" and trade.to_player == player_id
    ), None)
    if incoming:
        received, given = _trade_value(engine, incoming, player_id)
        accept = received >= given * cfg["trade_factor"]
        if player.cash - incoming.request_cash < cfg["reserve"] // 2:
            accept = False
        if accept:
            try:
                return engine.respond_trade(player_id, incoming.trade_id, True)
            except GameError:
                # Активите може да са се променили след създаването на
                # офертата; отказът винаги е допустим и пази хода жив.
                return engine.respond_trade(player_id, incoming.trade_id, False)
        target = state.players[incoming.from_player]
        desired = max(0, math.ceil(given * cfg["trade_factor"] - received))
        # Контраоферта се прави само срещу първоначално предложение — иначе
        # два бота могат да се пингпонгират с насрещни оферти без край.
        counter_cash = incoming.offer_cash + desired
        if (
            incoming.counter_of is None
            and received >= given * 0.65
            and desired
            and target.cash >= counter_cash + _counter_extra_cost(
                engine, incoming, counter_cash
            )
        ):
            try:
                return engine.create_trade(
                    player_id, incoming.from_player,
                    offer_cash=incoming.request_cash,
                    offer_properties=incoming.request_properties,
                    offer_jail_cards=incoming.request_jail_cards,
                    request_cash=counter_cash,
                    request_properties=incoming.offer_properties,
                    request_jail_cards=incoming.offer_jail_cards,
                    counter_of=incoming.trade_id,
                )
            except GameError:
                # Правилата за сделки са по-строги от преценката на бота;
                # отказът е винаги допустим и не спира хода му.
                pass
        return engine.respond_trade(player_id, incoming.trade_id, False)

    if state.phase == Phase.AWAITING_AUCTION and state.auction:
        minimum = max(
            state.auction.minimum_bid,
            state.auction.highest_bid + state.settings.auction_min_step,
        )
        target = state.auction.targets.get(player_id)
        if target is not None:
            minimum = max(minimum, engine.current_build_cost(target))
        maximum = _max_bid(engine, player_id, state.auction.position)
        if minimum <= maximum:
            jump = max(state.settings.auction_min_step, min(50, (maximum - minimum) // 3))
            return engine.place_bid(
                player_id, min(maximum, minimum + jump), target
            )
        return engine.withdraw_auction(player_id)

    if state.phase == Phase.AWAITING_CARD_CHOICE and state.pending_card_choice:
        choice = state.pending_card_choice
        if choice.player_id == player_id:
            # Характерът решава: предпазливият никога не залага, агресивният
            # почти винаги. Балансираният сравнява очакваната стойност —
            # зарът дава четно в половината случаи, тоест средно (win+lose)/2.
            expected = (choice.risky_win + choice.risky_lose) / 2
            if player.bot_style == "cautious":
                gamble = False
            elif player.bot_style == "aggressive":
                gamble = expected >= choice.safe_amount
            else:
                gamble = expected > choice.safe_amount
            # Залог, който при лош изход не може да се плати, се пропуска:
            # ботът не влиза доброволно във фалит заради една карта.
            worst = min(choice.risky_win, choice.risky_lose)
            if worst < 0 and player.cash + worst < int(cfg["reserve"]) // 2:
                gamble = False
            return engine.resolve_card_choice(
                player_id, "risky" if gamble else "safe",
            )

    if state.phase == Phase.AWAITING_MORTGAGE_DECISION and state.pending_mortgage_transfer:
        pending = state.pending_mortgage_transfer
        selected: list[int] = []
        available = max(0, player.cash - int(cfg["reserve"]))
        if player.bot_style != "cautious":
            for pos in sorted(
                pending.positions,
                key=lambda item: engine.board.space(item).data["mortgage"],
            ):
                principal = engine.board.space(pos).data["mortgage"]
                if principal <= available:
                    selected.append(pos)
                    available -= principal
        return engine.resolve_mortgage_transfer(player_id, selected)

    if state.phase == Phase.AWAITING_PAYMENT and state.debt and state.debt.debtor == player_id:
        if player.cash >= state.debt.amount:
            return engine.settle_debt(player_id)
        # Като при живите играчи: от най-евтиния имот нагоре. Дотук редът
        # беше този на речника, тоест случаен, и ботът понякога ипотекираше
        # скъп имот, докато има евтин.
        owned = sorted(
            (pos for pos, prop in state.properties.items()
             if prop.owner == player_id),
            key=lambda pos: (engine.board.space(pos).data.get("price", 0), pos),
        )
        for pos in owned:
            ok, _ = can_sell_improvement(engine.board, state.properties, player_id, pos)
            if ok:
                return engine.sell_improvement(player_id, pos)
        for pos in owned:
            if not state.properties[pos].mortgaged:
                try:
                    return engine.mortgage_property(player_id, pos)
                except GameError:
                    continue
        return engine.declare_bankruptcy(player_id)

    if state.current_player_id != player_id:
        return []

    if state.phase == Phase.WAITING_FOR_ROLL:
        # Само чиновническата карта освобождава; адвокатската се е задействала
        # още преди изпращането и в затвора е безполезна.
        has_release = any(
            jail_card_mode(cid) == "release" for cid in player.jail_card_ids
        )
        if player.in_jail and has_release:
            return engine.use_jail_card(player_id)
        if player.in_jail and player.cash > state.settings.jail_fee + cfg["reserve"]:
            return engine.pay_jail_fee(player_id)
        return engine.roll_dice(player_id)

    if state.phase == Phase.AWAITING_PURCHASE:
        space = engine.board.space(player.position)
        reserve = int(cfg["reserve"])
        value = _property_value_for_free(engine, player.position, player_id)
        if player.cash - space.price >= reserve and space.price <= value * cfg["buy_factor"]:
            return engine.buy_property(player_id)
        return engine.decline_purchase(player_id)

    if state.phase == Phase.MANAGEMENT:
        # 1. Мъртвият капитал се връща в игра преди новите разходи.
        release = _pick_unmortgage(engine, player_id)
        if release is not None:
            try:
                return engine.unmortgage_property(player_id, release)
            except GameError:
                pass

        # 2. Строеж по най-изостаналия имот.
        buildable: list[tuple[int, int]] = []
        for pos, prop in state.properties.items():
            if prop.owner != player_id:
                continue
            ok, _ = can_build(engine.board, state.properties, player_id, pos)
            if ok:
                buildable.append((prop.level, pos))
        if buildable:
            _, pos = min(buildable)
            cost = engine.current_build_cost(pos)
            if player.cash - cost >= cfg["reserve"]:
                return engine.build_improvement(player_id, pos)

        # 3. Оферта за имота, който затваря група — с останалите пари, за да
        #    е валидна и когато противникът я приеме по-късно.
        if state.settings.trading_enabled and state.auction is None:
            plan = _plan_monopoly_offer(engine, player_id)
            if plan is not None:
                try:
                    return engine.create_trade(
                        player_id,
                        plan["to_player"],
                        offer_cash=plan["cash"],
                        request_properties=[plan["position"]],
                    )
                except GameError:
                    pass

        return engine.end_turn(player_id)
    return []
