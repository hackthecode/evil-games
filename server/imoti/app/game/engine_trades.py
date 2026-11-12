"""Създаване, приемане и оттегляне на сделки между играчи.

Миксин към :class:`~app.game.engine.GameEngine`. Самото
изпълнение и правилата за оценка живеят в ``trading.py``.
"""
from __future__ import annotations

import uuid
from typing import Any

from .errors import GameError
from .state import Phase, TradeOffer
from .trading import TradeError, execute_trade, validate_trade


class TradesMixin:
    """Част от игровия двигател; вижте модулния низ."""

    # ------------------------------------------------------------------
    # Сделки
    # ------------------------------------------------------------------
    def _trades_allowed(self) -> None:
        if not self.state.settings.trading_enabled:
            raise GameError("Сделките са изключени в тази стая.")
        if self.state.phase not in (Phase.WAITING_FOR_ROLL, Phase.MANAGEMENT):
            raise GameError("Сделки не са позволени по време на друго действие.")
        if self.state.auction is not None:
            raise GameError("Изчакайте края на търга.")

    def create_trade(
        self,
        player_id: str,
        to_player: str,
        offer_cash: int = 0,
        offer_properties: list[int] | None = None,
        offer_jail_cards: int = 0,
        request_cash: int = 0,
        request_properties: list[int] | None = None,
        request_jail_cards: int = 0,
        counter_of: str | None = None,
    ) -> list[dict[str, Any]]:
        """Създава оферта за сделка (или контраоферта)."""
        self._trades_allowed()
        sender = self._require_player(player_id)
        target = self._require_player(to_player)

        trade = TradeOffer(
            trade_id=uuid.uuid4().hex[:12],
            from_player=player_id,
            to_player=to_player,
            offer_cash=int(offer_cash),
            offer_properties=list(offer_properties or []),
            offer_jail_cards=int(offer_jail_cards),
            request_cash=int(request_cash),
            request_properties=list(request_properties or []),
            request_jail_cards=int(request_jail_cards),
            counter_of=counter_of,
        )
        try:
            validate_trade(self.state, self.board, trade)
        except TradeError as exc:
            raise GameError(str(exc)) from exc

        # Контраоферта: старата оферта се маркира.
        if counter_of and counter_of in self.state.trades:
            original = self.state.trades[counter_of]
            if original.status == "pending" and player_id in (
                original.from_player, original.to_player
            ):
                original.status = "countered"

        self.state.trades[trade.trade_id] = trade
        # Пазим само последните 20 оферти.
        if len(self.state.trades) > 20:
            for tid in list(self.state.trades):
                if self.state.trades[tid].status != "pending":
                    del self.state.trades[tid]
                if len(self.state.trades) <= 20:
                    break
        return [
            self._log(
                f"{sender.name} предлага сделка на {target.name}.", "trade"
            ),
            {"type": "trade_offer", "trade": trade.to_dict()},
        ]

    def respond_trade(
        self, player_id: str, trade_id: str, accept: bool
    ) -> list[dict[str, Any]]:
        """Приемане или отказ на оферта. Изпълнението е атомарно."""
        self._trades_allowed()
        state = self.state
        trade = state.trades.get(trade_id)
        if trade is None or trade.status != "pending":
            raise GameError("Офертата вече не е активна.")
        if trade.to_player != player_id:
            raise GameError("Тази оферта не е за вас.")
        responder = self._require_player(player_id)
        sender = state.players.get(trade.from_player)

        if not accept:
            trade.status = "declined"
            return [
                self._log(f"{responder.name} отказва сделката.", "trade"),
                {"type": "trade_declined", "trade_id": trade_id},
            ]

        try:
            descriptions = execute_trade(state, self.board, trade)
        except TradeError as exc:
            trade.status = "cancelled"
            raise GameError(f"Сделката е невалидна: {exc}") from exc

        events = [
            self._log(
                f"Сделка между {sender.name if sender else '?'} и {responder.name}: "
                + "; ".join(descriptions) + ".",
                "trade",
            ),
            {"type": "trade_accepted", "trade": trade.to_dict()},
        ]
        if trade.offer_cash:
            events.append({"type": "payment", "from": trade.from_player,
                           "to": trade.to_player, "amount": trade.offer_cash})
        if trade.request_cash:
            events.append({"type": "payment", "from": trade.to_player,
                           "to": trade.from_player, "amount": trade.request_cash})
        sender_fee = sum(
            self.board.space(pos).data.get("mortgage", 0) // 10
            for pos in trade.request_properties
            if state.properties[pos].mortgaged
        )
        receiver_fee = sum(
            self.board.space(pos).data.get("mortgage", 0) // 10
            for pos in trade.offer_properties
            if state.properties[pos].mortgaged
        )
        if sender_fee:
            events.append({"type": "payment", "from": trade.from_player,
                           "to": None, "amount": sender_fee})
        if receiver_fee:
            events.append({"type": "payment", "from": trade.to_player,
                           "to": None, "amount": receiver_fee})
        self._stat(responder, "trades_completed")
        if sender:
            self._stat(sender, "trades_completed")
        return events

    def cancel_trade(self, player_id: str, trade_id: str) -> list[dict[str, Any]]:
        """Оттегляне на собствена оферта."""
        trade = self.state.trades.get(trade_id)
        if trade is None or trade.status != "pending":
            raise GameError("Офертата вече не е активна.")
        if trade.from_player != player_id:
            raise GameError("Може да оттегляте само собствени оферти.")
        trade.status = "cancelled"
        player = self.state.players[player_id]
        return [
            self._log(f"{player.name} оттегля офертата си.", "trade"),
            {"type": "trade_cancelled", "trade_id": trade_id},
        ]
