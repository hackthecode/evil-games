"""Състояние на играч в „Имоти и Империи"."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


def _restore_jail_cards(data: dict[str, Any]) -> list[str]:
    """Чете държаните jail карти, приемайки и стария формат с брояч.

    Записите отпреди въвеждането на ``jail_card_ids`` пазят само число. От
    него не личи коя карта е била в ръката, затова допълваме по реда на
    дефинициите; ``GameState.from_dict`` след това разчиства евентуалните
    съвпадения между двама играчи.
    """
    from .cards import JAIL_FREE_CARD_IDS

    stored = data.get("jail_card_ids")
    if stored is not None:
        return [cid for cid in stored if cid in JAIL_FREE_CARD_IDS]
    count = int(data.get("get_out_cards", 0))
    return list(JAIL_FREE_CARD_IDS[:max(0, count)])


@dataclass
class Player:
    """Динамично състояние на един играч в текущата игра.

    ``player_id`` е стабилен идентификатор, който не се променя при повторно
    свързване. Той не е базиран на IP адрес или sid.
    """

    player_id: str
    name: str
    token: str  # цвят на избраната човешка фигурка
    cash: int
    gender: str = "male"  # male | female
    # Външност на човечето — идентификатори от security.APPEARANCE_OPTIONS.
    # Цветовете стоят само в common.js; тук пътува единствено изборът.
    skin: str = "fair"
    hair: str = "brown"
    hairstyle: str = "short"
    position: int = 0
    in_jail: bool = False
    jail_turns: int = 0
    # Конкретните карти „освобождаване от проверка", които играчът държи.
    # Пазим идентификаторите, а не брой: двете карти в играта не са
    # взаимозаменяеми и всяка трябва да се върне в своето тесте. С брояч
    # използването на едната връщаше произволната „липсваща" карта в тестето
    # и тя можеше да бъде изтеглена, докато друг играч още я държи.
    jail_card_ids: list[str] = field(default_factory=list)
    # Държани карти с ефект (cards.KEEPABLE_POWERS). Прилагат се сами
    # при следващото подходящо действие и тогава напускат ръката.
    held_cards: list[str] = field(default_factory=list)
    # Остатък по банков заем. Расте с лихва на всяка пълна обиколка на
    # длъжника и намалява нетната стойност, за да не се печели с чужди пари.
    loan: int = 0
    # Обиколката, при която последно е начислена лихва. Задава се при
    # теглене, за да мине точно една пълна обиколка преди първата лихва.
    loan_lap: int = 0
    # Обиколката, на която е взет текущият заем. От нея се мери гратисът:
    # докато не е изтекъл, неплатена лихва само се добавя към дълга,
    # вместо да праща играча да разпродава.
    loan_taken_lap: int = 0
    bankrupt: bool = False
    connected: bool = True
    is_host: bool = False
    is_spectator: bool = False
    # Временни модификатори, натрупани от карти: брой оставащи приложения.
    modifiers: dict[str, int] = field(default_factory=dict)
    # Редът на присъединяване — определя реда на игра.
    order: int = 0
    is_bot: bool = False
    bot_style: str = "balanced"
    # Пази се само на сървъра и се изпраща единствено на съответния играч.
    secret_mission: str | None = None
    mission_completed: bool = False
    stats: dict[str, int] = field(default_factory=lambda: {
        "rent_collected": 0,
        "rent_paid": 0,
        "bank_paid": 0,
        "cash_received": 0,
        "properties_bought": 0,
        "trades_completed": 0,
        "laps": 0,
        "max_cash": 0,
        "missions_completed": 0,
        "dice_rolls": 0,
        "dice_pips": 0,
        "doubles": 0,
        "consecutive_timeouts": 0,
    })

    @property
    def get_out_cards(self) -> int:
        """Брой карти за освобождаване — само за четене.

        Записва се чрез ``jail_card_ids``, за да не се загуби кой точно е
        листът: тестетата връщат конкретна карта, не „някаква".
        """
        return len(self.jail_card_ids)

    def asset_value(self, board: Any, property_states: dict[int, Any]) -> int:
        """Стойност само на имотите и сградите (без пари и без заем).

        Служи за таван на заема: банката отпуска дял от реалните активи.
        """
        total = 0
        for pos, state in property_states.items():
            if state.owner != self.player_id or state.mortgaged:
                continue
            space = board.space(pos)
            total += int(space.price or 0)
            total += state.level * int(space.data.get("improve_cost", 0))
        return total

    def collateral_value(self, board: Any, property_states: dict[int, Any]) -> int:
        """Стойност на всички имоти като обезпечение по заема.

        За разлика от ``asset_value`` тук ипотекираните СЕ броят: банката
        държи акта, а ипотеката не го унищожава. Ако се брояха само
        свободните, ипотекирането — първата стъпка при набавяне на пари —
        щеше само по себе си да срине обезпечението и да задейства
        прибирането на заема точно докато играчът се спасява.
        """
        total = 0
        for pos, state in property_states.items():
            if state.owner != self.player_id:
                continue
            space = board.space(pos)
            total += int(space.price or 0)
            total += state.level * int(space.data.get("improve_cost", 0))
        return total

    def net_worth(self, board: Any, property_states: dict[int, Any]) -> int:
        """Изчислява нетната стойност: пари + активи − заем.

        Заемът се вади: иначе играч с голям кредит изглежда богат и може да
        спечели или да избегне фалит с чужди пари.
        """
        total = self.cash - self.loan
        for pos, state in property_states.items():
            if state.owner != self.player_id:
                continue
            space = board.space(pos)
            if not state.mortgaged:
                total += space.data.get("mortgage", 0)
                # Подобренията могат да се продадат на половин цена.
                improve_cost = space.data.get("improve_cost", 0)
                total += (state.level * improve_cost) // 2
        return total

    def to_dict(self) -> dict[str, Any]:
        """Пълна сериализация (за запис в базата)."""
        return {
            "player_id": self.player_id,
            "name": self.name,
            "token": self.token,
            "gender": self.gender,
            "skin": self.skin,
            "hair": self.hair,
            "hairstyle": self.hairstyle,
            "cash": self.cash,
            "position": self.position,
            "in_jail": self.in_jail,
            "jail_turns": self.jail_turns,
            "jail_card_ids": list(self.jail_card_ids),
            "held_cards": list(self.held_cards),
            "loan": self.loan,
            "loan_lap": self.loan_lap,
            "loan_taken_lap": self.loan_taken_lap,
            "bankrupt": self.bankrupt,
            "connected": self.connected,
            "is_host": self.is_host,
            "is_spectator": self.is_spectator,
            "modifiers": dict(self.modifiers),
            "order": self.order,
            "is_bot": self.is_bot,
            "bot_style": self.bot_style,
            "secret_mission": self.secret_mission,
            "mission_completed": self.mission_completed,
            "stats": dict(self.stats),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Player":
        """Възстановяване от сериализирано състояние."""
        return cls(
            player_id=data["player_id"],
            name=data["name"],
            token=data["token"],
            cash=data["cash"],
            gender=data.get("gender") if data.get("gender") in ("male", "female") else "male",
            # Стойностите се проверяват при възстановяване на стаята
            # (RoomManager._normalize_restored_avatars) — записите отпреди
            # въвеждането на външността нямат тези ключове.
            skin=str(data.get("skin", "fair")),
            hair=str(data.get("hair", "brown")),
            hairstyle=str(data.get("hairstyle", "short")),
            position=data.get("position", 0),
            in_jail=data.get("in_jail", False),
            jail_turns=data.get("jail_turns", 0),
            jail_card_ids=_restore_jail_cards(data),
            held_cards=list(data.get("held_cards", [])),
            loan=int(data.get("loan", 0)),
            loan_lap=int(data.get("loan_lap", 0)),
            # Стар запис без това поле: гратисът тръгва от последното
            # начисляване, а не от нула — иначе играч с дълъг стаж се
            # озовава извън гратиса още при първия си ход след зареждане.
            loan_taken_lap=int(
                data.get("loan_taken_lap", data.get("loan_lap", 0))
            ),
            bankrupt=data.get("bankrupt", False),
            connected=data.get("connected", True),
            is_host=data.get("is_host", False),
            is_spectator=data.get("is_spectator", False),
            modifiers=dict(data.get("modifiers", {})),
            order=data.get("order", 0),
            is_bot=data.get("is_bot", False),
            bot_style=data.get("bot_style", "balanced"),
            secret_mission=data.get("secret_mission"),
            mission_completed=bool(data.get("mission_completed", False)),
            stats=dict(data.get("stats", {})),
        )

    def held_cards_client(self) -> list[dict[str, Any]]:
        """Държаните карти с описание — клиентът няма достъп до тестетата.

        Видими са за всички играчи: част от информацията при преценка на
        сделка и на противника.
        """
        from .cards import KEEPABLE_POWERS, all_cards

        catalogue = all_cards()
        out: list[dict[str, Any]] = []
        for card_id in self.held_cards:
            card = catalogue.get(card_id)
            if card is None:
                continue
            power = KEEPABLE_POWERS.get(card.effect.get("power"), {})
            total = int(card.effect.get("uses", 1))
            out.append({
                "id": card_id,
                "label": power.get("label", "Карта"),
                "hint": power.get("hint", ""),
                "good": bool(power.get("good", True)),
                "percent": int(card.effect.get("percent", 100)),
                "uses_left": int(self.modifiers.get(f"held_uses::{card_id}", total)),
                "text": card.text,
            })
        return out

    def jail_cards_client(self) -> list[dict[str, Any]]:
        """Държаните карти „освобождаване" с вида си.

        Видими са за всички: това е част от преценката на противника —
        адвокатската карта се харчи сама, чиновническата остава в резерв.
        """
        from .cards import JAIL_MODE_LABELS, all_cards, jail_card_mode

        catalogue = all_cards()
        out: list[dict[str, Any]] = []
        for card_id in self.jail_card_ids:
            mode = jail_card_mode(card_id)
            labels = JAIL_MODE_LABELS.get(mode, JAIL_MODE_LABELS["release"])
            card = catalogue.get(card_id)
            out.append({
                "id": card_id,
                "mode": mode,
                "label": labels["label"],
                "hint": labels["hint"],
                "text": card.text if card is not None else "",
            })
        return out

    def to_client(self) -> dict[str, Any]:
        """Публична проекция за клиента (без вътрешни данни)."""
        return {
            "player_id": self.player_id,
            "name": self.name,
            "token": self.token,
            "gender": self.gender,
            "skin": self.skin,
            "hair": self.hair,
            "hairstyle": self.hairstyle,
            "cash": self.cash,
            "position": self.position,
            "in_jail": self.in_jail,
            "jail_turns": self.jail_turns,
            "get_out_cards": self.get_out_cards,
            "jail_cards": self.jail_cards_client(),
            "held_cards": self.held_cards_client(),
            "loan": self.loan,
            "loan_lap": self.loan_lap,
            "bankrupt": self.bankrupt,
            "connected": self.connected,
            "is_host": self.is_host,
            "is_spectator": self.is_spectator,
            "modifiers": dict(self.modifiers),
            "is_bot": self.is_bot,
            "bot_style": self.bot_style,
            "stats": dict(self.stats),
        }
