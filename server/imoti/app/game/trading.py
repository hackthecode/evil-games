"""Търговия между играчи — валидация и атомарно изпълнение на сделки."""
from __future__ import annotations

import time

from .board import Board
from .properties import group_has_buildings
from .state import GameState, TradeOffer


class TradeError(Exception):
    """Невалидна сделка."""


JAIL_CARD_TRADE_VALUE = 100

# --- Надценка при сделки -------------------------------------------------
# Имот никога не се прехвърля под стойността си (пода). Над нея се допуска
# надценка — така се убеждава насрещната страна — но тя е с таван и се
# облага, за да не се превърне сделката в прикрит подарък между съюзници.
TRADE_PREMIUM_LIMIT_PCT = 200  # таван: до 200% надценка върху разменяните активи
TRADE_PREMIUM_MIN = 150        # свобода за дребни услуги и евтини имоти (10% от началната сума)
TRADE_PREMIUM_TAX_PCT = 30     # данък към банката върху надценката


def property_trade_value(state: GameState, board: Board, position: int) -> int:
    """Стойност на имот за сделка, еднаква с показваната от клиента."""
    prop = state.properties[position]
    space = board.space(position)
    price = int(space.price or 0)
    if prop.mortgaged:
        # Math.round(price * 0.55), без банковото закръгляне на Python.
        price = (price * 55 + 50) // 100
    return price + prop.level * int(space.data.get("improve_cost", 0))


def _side_trade_value(
    state: GameState,
    board: Board,
    cash: int,
    properties: list[int],
    jail_cards: int,
) -> int:
    """Обща изчислена стойност на едната страна на офертата."""
    return (
        cash
        + jail_cards * JAIL_CARD_TRADE_VALUE
        + sum(property_trade_value(state, board, pos) for pos in properties)
    )


def _properties_value(state: GameState, board: Board, properties: list[int]) -> int:
    """Стойност само на имотите от едната страна (без пари и карти)."""
    return sum(property_trade_value(state, board, pos) for pos in properties)


def trade_premium(state: GameState, board: Board, trade: TradeOffer) -> tuple[str | None, int]:
    """Кой надплаща и с колко. Връща (player_id, надценка) или (None, 0)."""
    offered = _side_trade_value(
        state, board, trade.offer_cash, trade.offer_properties, trade.offer_jail_cards,
    )
    requested = _side_trade_value(
        state, board, trade.request_cash, trade.request_properties, trade.request_jail_cards,
    )
    if offered > requested:
        return trade.from_player, offered - requested
    if requested > offered:
        return trade.to_player, requested - offered
    return None, 0


def trade_premium_allowance(state: GameState, board: Board, trade: TradeOffer) -> int:
    """Таван на допустимата надценка.

    Базата са реалните активи (имоти и карти), които сменят собственика си.
    Чисто паричното прехвърляне има база 0 и остава в рамките на
    TRADE_PREMIUM_MIN — дребна услуга минава, финансиране на съюзник не.
    """
    substance = (
        _properties_value(state, board, trade.offer_properties)
        + trade.offer_jail_cards * JAIL_CARD_TRADE_VALUE
        + _properties_value(state, board, trade.request_properties)
        + trade.request_jail_cards * JAIL_CARD_TRADE_VALUE
    )
    return max(TRADE_PREMIUM_MIN, substance * TRADE_PREMIUM_LIMIT_PCT // 100)


def trade_premium_tax(premium: int) -> int:
    """Данък към банката върху надценката."""
    return premium * TRADE_PREMIUM_TAX_PCT // 100


def _validate_side(
    state: GameState,
    board: Board,
    player_id: str,
    cash: int,
    properties: list[int],
    jail_cards: int,
) -> None:
    """Проверява дали играчът действително разполага с предлаганите активи."""
    player = state.players.get(player_id)
    if player is None or player.bankrupt:
        raise TradeError("Играчът не е активен.")
    if cash < 0 or jail_cards < 0:
        raise TradeError("Невалидни стойности в офертата.")
    if cash > player.cash:
        raise TradeError(f"{player.name} не разполага с тази сума.")
    if jail_cards > player.get_out_cards:
        raise TradeError(f"{player.name} няма толкова карти за освобождаване.")
    seen: set[int] = set()
    for pos in properties:
        if pos in seen:
            raise TradeError("Имот е включен два пъти в офертата.")
        seen.add(pos)
        prop = state.properties.get(pos)
        if prop is None or prop.owner != player_id:
            raise TradeError(f"{player.name} не притежава имот на позиция {pos}.")
        space = board.space(pos)
        if space.type == "property" and group_has_buildings(
            board, state.properties, space.group
        ):
            raise TradeError(
                f'В групата на „{space.name}" има постройки — '
                "продайте ги преди размяна."
            )


def validate_trade(state: GameState, board: Board, trade: TradeOffer) -> None:
    """Пълна проверка на офертата спрямо текущото състояние.

    Извиква се и при създаване, и непосредствено преди изпълнение, защото
    активите може да са се променили междувременно.
    """
    if trade.from_player == trade.to_player:
        raise TradeError("Не може да сключите сделка със себе си.")
    if (
        trade.offer_cash == 0
        and not trade.offer_properties
        and trade.offer_jail_cards == 0
        and trade.request_cash == 0
        and not trade.request_properties
        and trade.request_jail_cards == 0
    ):
        raise TradeError("Офертата е празна.")
    _validate_side(
        state, board, trade.from_player,
        trade.offer_cash, trade.offer_properties, trade.offer_jail_cards,
    )
    _validate_side(
        state, board, trade.to_player,
        trade.request_cash, trade.request_properties, trade.request_jail_cards,
    )
    overlap = set(trade.offer_properties) & set(trade.request_properties)
    if overlap:
        raise TradeError("Един и същ имот не може да е в двете страни на сделката.")

    # Свободна търговия: без под на цената, без таван/данък на надценката,
    # без ипотечни такси — проверяваме само наличните пари за самата сделка.
    if state.settings.free_trading:
        return

    offered_value = _side_trade_value(
        state, board,
        trade.offer_cash, trade.offer_properties, trade.offer_jail_cards,
    )
    requested_value = _side_trade_value(
        state, board,
        trade.request_cash, trade.request_properties, trade.request_jail_cards,
    )
    # Под: който дава имоти, трябва да получи поне тяхната стойност.
    # Мери се срещу стойността на САМИТЕ имоти, а не срещу целия пакет —
    # иначе собствената ви парична добавка се брои срещу вас и надценката
    # при размяна имот↔имот става невъзможна.
    offered_properties_value = _properties_value(state, board, trade.offer_properties)
    requested_properties_value = _properties_value(state, board, trade.request_properties)
    if trade.offer_properties and requested_value < offered_properties_value:
        difference = offered_properties_value - requested_value
        raise TradeError(
            "Предлаганите имоти не могат да се прехвърлят под собствената "
            f"им стойност. Добавете още поне {difference} € към насрещната оферта."
        )
    if trade.request_properties and offered_value < requested_properties_value:
        difference = requested_properties_value - offered_value
        raise TradeError(
            "Исканите имоти не могат да се прехвърлят под собствената им "
            f"стойност. Добавете още поне {difference} € към вашата оферта."
        )

    # Таван: надценката над стойността е допустима, но ограничена.
    premium_payer, premium = trade_premium(state, board, trade)
    allowance = trade_premium_allowance(state, board, trade)
    if premium > allowance:
        raise TradeError(
            f"Надценката от {premium} € надхвърля допустимата ({allowance} €). "
            "Сделката прилича на прикрит подарък — намалете разликата."
        )

    # При придобиване на ипотекиран имот се плаща незабавно 10% лихва.
    sender_fee = sum(
        board.space(pos).data.get("mortgage", 0) // 10
        for pos in trade.request_properties
        if state.properties[pos].mortgaged
    )
    receiver_fee = sum(
        board.space(pos).data.get("mortgage", 0) // 10
        for pos in trade.offer_properties
        if state.properties[pos].mortgaged
    )
    sender_cash_after = (
        state.players[trade.from_player].cash - trade.offer_cash + trade.request_cash
    )
    receiver_cash_after = (
        state.players[trade.to_player].cash - trade.request_cash + trade.offer_cash
    )
    # Данъкът върху надценката се плаща от надплащащия.
    tax = trade_premium_tax(premium)
    sender_due = sender_fee + (tax if premium_payer == trade.from_player else 0)
    receiver_due = receiver_fee + (tax if premium_payer == trade.to_player else 0)
    if sender_cash_after < sender_due or receiver_cash_after < receiver_due:
        raise TradeError(
            "Няма достатъчно средства за таксите по сделката "
            "(ипотечна такса и/или данък върху надценката)."
        )


def execute_trade(state: GameState, board: Board, trade: TradeOffer) -> list[str]:
    """Изпълнява приета сделка атомарно. Връща списък с описания за лога.

    Валидацията се извършва преди каквато и да е промяна, така че или цялата
    сделка минава, или нищо не се променя.
    """
    validate_trade(state, board, trade)
    free = bool(state.settings.free_trading)

    # Изчислява се преди всякакви промени по състоянието.
    premium_payer, premium = (None, 0) if free else trade_premium(state, board, trade)

    sender = state.players[trade.from_player]
    receiver = state.players[trade.to_player]
    descriptions: list[str] = []

    # Пари
    if trade.offer_cash:
        sender.cash -= trade.offer_cash
        receiver.cash += trade.offer_cash
        descriptions.append(f"{sender.name} дава {trade.offer_cash} €")
        state.bank_transactions.append({"from": sender.player_id, "to": receiver.player_id,
                                        "amount": trade.offer_cash, "reason": "Сделка", "ts": time.time()})
    if trade.request_cash:
        receiver.cash -= trade.request_cash
        sender.cash += trade.request_cash
        descriptions.append(f"{receiver.name} дава {trade.request_cash} €")
        state.bank_transactions.append({"from": receiver.player_id, "to": sender.player_id,
                                        "amount": trade.request_cash, "reason": "Сделка", "ts": time.time()})

    # Имоти (ипотекираните се прехвърлят с ипотеката)
    for pos in trade.offer_properties:
        state.properties[pos].owner = trade.to_player
        descriptions.append(f'„{board.space(pos).name}" преминава към {receiver.name}')
    for pos in trade.request_properties:
        state.properties[pos].owner = trade.from_player
        descriptions.append(f'„{board.space(pos).name}" преминава към {sender.name}')

    sender_fee = 0 if free else sum(
        board.space(pos).data.get("mortgage", 0) // 10
        for pos in trade.request_properties
        if state.properties[pos].mortgaged
    )
    receiver_fee = 0 if free else sum(
        board.space(pos).data.get("mortgage", 0) // 10
        for pos in trade.offer_properties
        if state.properties[pos].mortgaged
    )
    if sender_fee:
        sender.cash -= sender_fee
        sender.stats["bank_paid"] = sender.stats.get("bank_paid", 0) + sender_fee
        descriptions.append(f"{sender.name} плаща {sender_fee} € ипотечна такса")
        state.bank_transactions.append({"from": sender.player_id, "to": None,
                                        "amount": sender_fee, "reason": "Ипотечна такса", "ts": time.time()})
    if receiver_fee:
        receiver.cash -= receiver_fee
        receiver.stats["bank_paid"] = receiver.stats.get("bank_paid", 0) + receiver_fee
        descriptions.append(f"{receiver.name} плаща {receiver_fee} € ипотечна такса")
        state.bank_transactions.append({"from": receiver.player_id, "to": None,
                                        "amount": receiver_fee, "reason": "Ипотечна такса", "ts": time.time()})

    # Карти за освобождаване — местят се конкретните листове, не просто брой.
    if trade.offer_jail_cards:
        moved = sender.jail_card_ids[:trade.offer_jail_cards]
        del sender.jail_card_ids[:trade.offer_jail_cards]
        receiver.jail_card_ids.extend(moved)
        descriptions.append(
            f"{sender.name} дава {trade.offer_jail_cards} карта/и за освобождаване"
        )
    if trade.request_jail_cards:
        moved = receiver.jail_card_ids[:trade.request_jail_cards]
        del receiver.jail_card_ids[:trade.request_jail_cards]
        sender.jail_card_ids.extend(moved)
        descriptions.append(
            f"{receiver.name} дава {trade.request_jail_cards} карта/и за освобождаване"
        )

    # Данък върху надценката — плаща се от този, който е дал повече стойност.
    tax = trade_premium_tax(premium)
    if premium_payer and tax:
        payer = state.players[premium_payer]
        payer.cash -= tax
        payer.stats["bank_paid"] = payer.stats.get("bank_paid", 0) + tax
        descriptions.append(
            f"{payer.name} плаща {tax} € данък върху надценката от {premium} €"
        )
        state.bank_transactions.append({"from": premium_payer, "to": None,
                                        "amount": tax, "reason": "Данък върху надценката",
                                        "ts": time.time()})

    trade.status = "accepted"
    state.bank_transactions = state.bank_transactions[-80:]
    return descriptions
