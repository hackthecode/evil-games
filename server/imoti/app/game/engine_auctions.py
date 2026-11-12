"""Търгове: имоти, последна къща/хотел и активи на фалирал.

Миксин към :class:`~app.game.engine.GameEngine` — методите тук
работят със същите ``self.state`` и ``self.board``.
"""
from __future__ import annotations

import time
from typing import Any

from .errors import GameError
from .properties import PropertyState, can_build, group_has_buildings
from .state import AuctionState, Phase


class AuctionMixin:
    """Част от игровия двигател; вижте модулния низ."""

    # ------------------------------------------------------------------
    # Търг
    # ------------------------------------------------------------------
    def _start_auction(
        self, position: int, resume_phase: Phase, *, kind: str = "property",
        participants: list[str] | None = None,
        targets: dict[str, int] | None = None,
        minimum_bid: int = 0,
        seller: str | None = None,
    ) -> list[dict[str, Any]]:
        """Открива търг със сървърен таймер, подновяван при наддаване.

        Ако е зададен ``seller``, това е търг, обявен от собственика — печалбата
        отива при него, а той не участва в наддаването. Ако никой не наддаде,
        имотът остава негов.
        """
        state = self.state
        space = self.board.space(position)
        # При търг от собственик участниците са всички без продавача.
        if participants is None:
            participants = [
                p.player_id for p in state.active_players()
                if p.player_id != seller
            ]
        # Търговете от собственик подават началната цена изрично (стойността на
        # имота). За банковите търгове домакинът може да избере старт от
        # пазарната цена вместо от минималната стъпка.
        if (
            kind == "property"
            and minimum_bid <= 0
            and seller is None
            and state.settings.auction_start_market
        ):
            minimum_bid = int(space.price or 0)
        state.auction = AuctionState(
            position=position,
            ends_at=time.time() + state.settings.auction_seconds,
            participants=participants,
            kind=kind,
            minimum_bid=minimum_bid,
            targets=dict(targets or {}),
            seller=seller,
            resume_phase=resume_phase.value,
        )
        state.phase = Phase.AWAITING_AUCTION
        asset = (
            f'„{space.name}"'
            if kind == "property"
            else "последната къща" if kind == "house" else "последния хотел"
        )
        start_note = (
            f"Начална цена: {state.auction.minimum_bid} €. "
            if state.auction.minimum_bid > 0 else ""
        )
        seller_note = ""
        if seller is not None:
            seller_name = state.players[seller].name
            seller_note = f"{seller_name} обявява своя имот на търг. "
        return [
            self._log(
                f"{seller_note}Търг за {asset}! Участниците наддават или се отказват "
                f"окончателно. {start_note}Минимална стъпка: "
                f"{state.settings.auction_min_step} €.",
                "auction",
            ),
            {"type": "auction_start", "auction": state.auction.to_dict()},
        ]

    def auction_own_property(
        self, player_id: str, position: int
    ) -> list[dict[str, Any]]:
        """Собственикът обявява свой имот на търг; печалбата отива при него."""
        self._require_phase(Phase.MANAGEMENT, Phase.WAITING_FOR_ROLL)
        player = self._require_current(player_id)
        state = self.state
        if state.auction is not None:
            raise GameError("Вече тече търг.")
        if state.debt is not None:
            raise GameError("Първо уредете задължението си.")
        prop = state.properties.get(position)
        space = self.board.space(position)
        if prop is None or prop.owner != player_id:
            raise GameError("Не притежавате този имот.")
        if not space.is_ownable:
            raise GameError("Това поле не може да се продава.")
        if prop.mortgaged:
            raise GameError("Ипотекиран имот не може да се обяви на търг.")
        if space.type == "property" and group_has_buildings(
            self.board, state.properties, space.group
        ):
            raise GameError("Първо продайте всички постройки в групата.")
        bidders = [
            p.player_id for p in state.active_players()
            if p.player_id != player_id
        ]
        if not bidders:
            raise GameError("Няма други играчи, които да наддават.")
        # Търгът започва от стойността на имота (пазарната му цена).
        return self._start_auction(
            position, Phase(state.phase.value), seller=player_id,
            minimum_bid=int(space.price or 0),
        )

    def _maybe_start_queued_auction(self) -> list[dict[str, Any]]:
        """Стартира следващия чакащ търг от опашката (активи на фалирал)."""
        state = self.state
        if (
            not state.settings.auctions_enabled
            or state.auction is not None
            or state.phase == Phase.GAME_OVER
            or not state.auction_queue
        ):
            return []
        position = state.auction_queue.pop(0)
        return self._start_auction(position, state.phase)

    def place_bid(
        self, player_id: str, amount: int, position: int | None = None
    ) -> list[dict[str, Any]]:
        """Наддаване в активния търг."""
        self._require_phase(Phase.AWAITING_AUCTION)
        state = self.state
        auction = state.auction
        if auction is None:
            raise GameError("Няма активен търг.")
        if auction.ends_at and auction.ends_at <= time.time():
            raise GameError("Времето за този търг изтече.")
        player = self._require_player(player_id)
        if player_id not in auction.participants:
            raise GameError("Не участвате в този търг.")
        if not isinstance(amount, int) or amount <= 0:
            raise GameError("Невалидна сума.")
        min_bid = max(
            auction.minimum_bid,
            auction.highest_bid + state.settings.auction_min_step,
        )
        if auction.kind in ("house", "hotel"):
            target = position if position is not None else auction.targets.get(player_id)
            if target is None:
                raise GameError("Изберете имот за постройката.")
            ok, why = can_build(
                self.board, state.properties, player_id, target, check_stock=False
            )
            prop = state.properties.get(target)
            expected = 5 if auction.kind == "hotel" else None
            if not ok or prop is None or (
                expected == 5 and prop.level + 1 != 5
            ) or (
                auction.kind == "house" and prop.level + 1 > 4
            ):
                raise GameError(why or "Имотът не е подходящ за тази постройка.")
            auction.targets[player_id] = target
            min_bid = max(min_bid, self.current_build_cost(target))
        if amount < min_bid:
            raise GameError(f"Минималното наддаване е {min_bid} €.")
        if amount > player.cash:
            raise GameError("Нямате толкова средства.")
        auction.highest_bid = amount
        auction.highest_bidder = player_id
        auction.ends_at = time.time() + state.settings.auction_seconds
        auction.bid_history.append({
            "player_id": player_id,
            "amount": amount,
            "ts": time.time(),
            "position": auction.targets.get(player_id, auction.position),
        })
        space = self.board.space(auction.position)
        asset_name = space.name if auction.kind == "property" else (
            "къща" if auction.kind == "house" else "хотел"
        )
        return [
            self._log(f'{player.name} наддава {amount} € за „{asset_name}".', "auction"),
            {"type": "auction_bid", "auction": auction.to_dict()},
        ]

    def withdraw_auction(self, player_id: str) -> list[dict[str, Any]]:
        """Окончателно отказва играч от текущия търг."""
        self._require_phase(Phase.AWAITING_AUCTION)
        state = self.state
        auction = state.auction
        if auction is None or player_id not in auction.participants:
            raise GameError("Не участвате в този търг.")
        if auction.highest_bidder == player_id:
            raise GameError("Водещият участник не може да се откаже, докато не бъде наддаден.")
        player = self._require_player(player_id)
        auction.participants.remove(player_id)
        auction.withdrawn.append(player_id)
        events = [
            self._log(f"{player.name} се отказва от търга.", "auction"),
            {"type": "auction_withdraw", "player_id": player_id,
             "auction": auction.to_dict()},
        ]
        # При банков търг последният останал участник печели автоматично на
        # минимума — активът трябва да отиде някъде. При доброволен търг от
        # собственик това НЕ важи: ако никой не наддаде, имотът остава при
        # продавача, вместо да принуждаваме последния да го купи.
        if (
            auction.seller is None
            and len(auction.participants) == 1
            and auction.highest_bidder is None
        ):
            remaining_id = auction.participants[0]
            remaining = state.players[remaining_id]
            target = auction.targets.get(remaining_id)
            target_cost = self.current_build_cost(target) if target is not None else 0
            automatic_bid = max(
                auction.minimum_bid,
                state.settings.auction_min_step,
                target_cost,
            )
            if remaining.cash >= automatic_bid:
                auction.highest_bidder = remaining_id
                auction.highest_bid = automatic_bid
                auction.bid_history.append({
                    "player_id": remaining_id,
                    "amount": automatic_bid,
                    "ts": time.time(),
                    "position": auction.targets.get(remaining_id, auction.position),
                    "automatic": True,
                })
                events.append(self._log(
                    f"{remaining.name} остава единствен участник с оферта "
                    f"{automatic_bid} €.", "auction",
                ))
        if len(auction.participants) <= 1:
            events.extend(self.finish_auction())
        return events

    def resolve_mortgage_transfer(
        self, player_id: str, unmortgage_positions: list[int]
    ) -> list[dict[str, Any]]:
        """Приключва избора след фалит: запазване или незабавно откупуване."""
        self._require_phase(Phase.AWAITING_MORTGAGE_DECISION)
        state = self.state
        pending = state.pending_mortgage_transfer
        if pending is None or pending.player_id != player_id:
            raise GameError("Нямате чакащо решение за ипотекирани имоти.")
        selected = list(dict.fromkeys(int(pos) for pos in unmortgage_positions))
        if any(pos not in pending.positions for pos in selected):
            raise GameError("Избран е имот извън получените ипотеки.")
        player = self._require_player(player_id)
        principal = sum(self.board.space(pos).data["mortgage"] for pos in selected)
        if player.cash < principal:
            raise GameError(f"Нужни са {principal} € за незабавно откупуване.")
        events: list[dict[str, Any]] = []
        if principal:
            player.cash -= principal
            self._stat(player, "bank_paid", principal)
            self._bank_record(player, None, principal, "Незабавно откупуване на ипотеки")
            for pos in selected:
                self.state.properties[pos].mortgaged = False
            events.extend([
                self._log(
                    f"{player.name} откупува незабавно {len(selected)} ипотекиран/и "
                    f"имот/а за {principal} €.", "mortgage",
                ),
                {"type": "payment", "from": player_id, "to": None,
                 "amount": principal},
            ])
        kept = len(pending.positions) - len(selected)
        if kept:
            events.append(self._log(
                f"{player.name} запазва {kept} имот/а ипотекирани.", "mortgage"
            ))
        state.pending_mortgage_transfer = None
        events.extend(self._check_victory())
        if state.phase != Phase.GAME_OVER:
            if state.current_player and state.current_player.bankrupt:
                events.extend(self._advance_turn())
            else:
                state.phase = Phase.MANAGEMENT
            events.extend(self._maybe_start_queued_auction())
        return events

    def finish_auction(self) -> list[dict[str, Any]]:
        """Приключва търга след отказите на останалите участници."""
        self._require_phase(Phase.AWAITING_AUCTION)
        state = self.state
        auction = state.auction
        if auction is None:
            raise GameError("Няма активен търг.")
        space = self.board.space(auction.position)
        events: list[dict[str, Any]] = []

        seller = state.players.get(auction.seller) if auction.seller else None

        if auction.highest_bidder is not None:
            winner = state.players[auction.highest_bidder]
            price = min(auction.highest_bid, max(winner.cash, 0))
            winner.cash -= price
            if auction.kind == "property" and seller is not None:
                # Търг от собственик: парите отиват при продавача, не в банката.
                self._stat(winner, "properties_bought")
                self._stat(winner, "bank_paid", price)
                seller.cash += price
                self._stat(seller, "cash_received", price)
                self._track_cash(seller)
                self._bank_record(
                    winner, seller, price, f'Търг за „{space.name}"'
                )
                state.properties[auction.position] = PropertyState(
                    position=auction.position, owner=winner.player_id
                )
                events.append(self._log(
                    f'{winner.name} печели търга за „{space.name}" с {price} € — '
                    f"сумата отива при {seller.name}!", "auction",
                ))
                events.append({
                    "type": "auction_end", "winner": winner.player_id,
                    "position": auction.position, "price": price,
                    "kind": auction.kind,
                })
                events.append({
                    "type": "payment", "from": winner.player_id,
                    "to": seller.player_id, "amount": price,
                })
                state.auction = None
                state.phase = Phase(auction.resume_phase)
                events.extend(self._maybe_start_queued_auction())
                return events
            self._stat(winner, "bank_paid", price)
            self._bank_record(winner, None, price, "Плащане по търг")
            if auction.kind == "property":
                self._stat(winner, "properties_bought")
                state.properties[auction.position] = PropertyState(
                    position=auction.position, owner=winner.player_id
                )
                events.append(self._log(
                    f'{winner.name} печели търга за „{space.name}" с {price} €!',
                    "auction",
                ))
                result_position = auction.position
            else:
                result_position = auction.targets[winner.player_id]
                prop = state.properties[result_position]
                prop.level += 1
                level_name = self.board.improvement_levels[prop.level]
                events.append(self._log(
                    f'{winner.name} печели {"къщата" if auction.kind == "house" else "хотела"} '
                    f'за „{self.board.space(result_position).name}" с {price} € '
                    f'и достига „{level_name}"!', "auction",
                ))
                events.append({"type": "build", "player_id": winner.player_id,
                               "position": result_position, "level": prop.level})
            events.append({
                "type": "auction_end", "winner": winner.player_id,
                "position": result_position, "price": price,
                "kind": auction.kind,
            })
            events.append({
                "type": "payment", "from": winner.player_id,
                "to": None, "amount": price,
            })
        elif seller is not None:
            events.append(self._log(
                f'Никой не наддава за „{space.name}" — имотът остава при {seller.name}.',
                "auction",
            ))
            events.append({
                "type": "auction_end", "winner": None,
                "position": auction.position, "price": 0, "kind": auction.kind,
            })
        else:
            events.append(self._log(
                f'Никой не наддава за „{space.name}" — активът остава в банката.',
                "auction",
            ))
            events.append({
                "type": "auction_end", "winner": None,
                "position": auction.position, "price": 0, "kind": auction.kind,
            })

        state.auction = None
        state.phase = Phase(auction.resume_phase)
        events.extend(self._maybe_start_queued_auction())
        return events
