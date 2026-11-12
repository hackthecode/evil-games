"""Напредъкът по всяка от 19-те тайни мисии.

Механизмът за изплащане на бонуса се проверява в test_social_features.py.
Тук е останалото: че всяка мисия брои това, което обещава описанието ѝ.
"""
from __future__ import annotations

import pytest

from app.game.engine import GameEngine
from app.game.missions import MISSION_DEFINITIONS, mission_progress
from app.game.properties import MAX_LEVEL, PropertyState


def _progress(engine: GameEngine, player_id: str, mission_id: str) -> tuple[int, int]:
    return mission_progress(
        mission_id, engine.state.players[player_id], engine.state, engine.board,
    )


def _positions_of_type(engine: GameEngine, space_type: str) -> list[int]:
    """Полета от таблото — не от ``state.properties``, което пази само купените."""
    return [
        space.position for space in engine.board.spaces
        if space.type == space_type
    ]


def _colour_group_positions(engine: GameEngine) -> dict[str, list[int]]:
    groups: dict[str, list[int]] = {}
    for space in engine.board.spaces:
        if space.type == "property" and space.group:
            groups.setdefault(space.group, []).append(space.position)
    return groups


def _give(engine: GameEngine, player_id: str, positions: list[int]) -> None:
    """Записва имотите на играча, създавайки състоянието им при нужда."""
    for pos in positions:
        prop = engine.state.properties.get(pos)
        if prop is None:
            prop = PropertyState(position=pos)
            engine.state.properties[pos] = prop
        prop.owner = player_id


class TestMissionCatalogue:
    def test_every_mission_has_complete_definition(self) -> None:
        for mission_id, definition in MISSION_DEFINITIONS.items():
            for key in ("title", "description", "target", "unit", "bonus"):
                assert definition.get(key), f"{mission_id} няма {key}"
            assert definition["target"] > 0
            assert 200 <= definition["bonus"] <= 600

    def test_catalogue_is_large_enough_for_a_full_table(self) -> None:
        """Шест играча не бива да изчерпват набора."""
        assert len(MISSION_DEFINITIONS) >= 12

    def test_titles_are_unique(self) -> None:
        titles = [d["title"] for d in MISSION_DEFINITIONS.values()]
        assert len(titles) == len(set(titles))

    @pytest.mark.parametrize("mission_id", sorted(MISSION_DEFINITIONS))
    def test_progress_starts_at_zero_and_is_capped(
        self, engine: GameEngine, mission_id: str,
    ) -> None:
        """Нито една мисия не започва изпълнена и никоя не надхвърля целта."""
        pid = engine.state.turn_order[0]
        # Началният капитал вече е връх за „Пълна каса" — нулираме го.
        engine.state.players[pid].cash = 0
        engine.state.players[pid].stats["max_cash"] = 0
        current, target = _progress(engine, pid, mission_id)
        assert current == 0
        assert target == MISSION_DEFINITIONS[mission_id]["target"]
        assert current <= target


class TestPropertyMissions:
    def test_portfolio_and_tycoon_count_all_holdings(self, engine: GameEngine) -> None:
        pid = engine.state.turn_order[0]
        _give(engine, pid, _positions_of_type(engine, "property")[:8])
        assert _progress(engine, pid, "portfolio") == (4, 4)
        assert _progress(engine, pid, "tycoon") == (8, 8)

    def test_transport_missions_count_only_transport(self, engine: GameEngine) -> None:
        pid = engine.state.turn_order[0]
        transports = _positions_of_type(engine, "transport")
        _give(engine, pid, transports[:3])
        assert _progress(engine, pid, "transport") == (2, 2)
        assert _progress(engine, pid, "transport_master") == (3, 3)

    def test_utilities_needs_both(self, engine: GameEngine) -> None:
        pid = engine.state.turn_order[0]
        utilities = _positions_of_type(engine, "utility")
        _give(engine, pid, utilities[:1])
        assert _progress(engine, pid, "utilities") == (1, 2)
        _give(engine, pid, utilities)
        assert _progress(engine, pid, "utilities") == (2, 2)

    def test_collector_counts_distinct_colour_groups(self, engine: GameEngine) -> None:
        pid = engine.state.turn_order[0]
        by_group = _colour_group_positions(engine)
        groups = sorted(by_group)

        # Два имота от една група са една група, не две.
        _give(engine, pid, by_group[groups[0]][:2])
        assert _progress(engine, pid, "collector")[0] == 1
        _give(engine, pid, [by_group[groups[1]][0], by_group[groups[2]][0]])
        assert _progress(engine, pid, "collector") == (3, 3)

    def test_transport_does_not_count_as_a_colour_group(self, engine: GameEngine) -> None:
        """„Пълен квартал" говори за цветова група — целият транспорт не е такава."""
        pid = engine.state.turn_order[0]
        _give(engine, pid, _positions_of_type(engine, "transport"))
        assert _progress(engine, pid, "monopoly")[0] == 0
        assert _progress(engine, pid, "collector")[0] == 0

    def test_monopoly_and_empire_count_full_groups(self, engine: GameEngine) -> None:
        pid = engine.state.turn_order[0]
        by_group = _colour_group_positions(engine)
        first, second = sorted(by_group)[:2]
        _give(engine, pid, by_group[first])
        assert _progress(engine, pid, "monopoly") == (1, 1)
        assert _progress(engine, pid, "empire") == (1, 2)
        _give(engine, pid, by_group[second])
        assert _progress(engine, pid, "empire") == (2, 2)

    def test_mortgage_breaks_a_full_group(self, engine: GameEngine) -> None:
        pid = engine.state.turn_order[0]
        by_group = _colour_group_positions(engine)
        positions = by_group[sorted(by_group)[0]]
        _give(engine, pid, positions)
        engine.state.properties[positions[0]].mortgaged = True
        assert _progress(engine, pid, "monopoly")[0] == 0

    def test_clean_books_resets_on_any_mortgage(self, engine: GameEngine) -> None:
        pid = engine.state.turn_order[0]
        owned = _positions_of_type(engine, "property")[:5]
        _give(engine, pid, owned)
        assert _progress(engine, pid, "clean_books") == (5, 5)
        engine.state.properties[owned[0]].mortgaged = True
        assert _progress(engine, pid, "clean_books") == (0, 5)


class TestBuildingMissions:
    def test_builder_and_developer_sum_levels(self, engine: GameEngine) -> None:
        pid = engine.state.turn_order[0]
        positions = _positions_of_type(engine, "property")[:2]
        _give(engine, pid, positions)
        engine.state.properties[positions[0]].level = 3
        assert _progress(engine, pid, "builder") == (3, 3)
        assert _progress(engine, pid, "developer") == (3, 8)
        engine.state.properties[positions[1]].level = 5
        assert _progress(engine, pid, "developer") == (8, 8)

    def test_skyscraper_needs_a_top_level_property(self, engine: GameEngine) -> None:
        pid = engine.state.turn_order[0]
        position = _positions_of_type(engine, "property")[0]
        _give(engine, pid, [position])
        engine.state.properties[position].level = MAX_LEVEL - 1
        assert _progress(engine, pid, "skyscraper") == (0, 1)
        engine.state.properties[position].level = MAX_LEVEL
        assert _progress(engine, pid, "skyscraper") == (1, 1)


class TestStatMissions:
    @pytest.mark.parametrize(
        "mission_id,stat,value,expected",
        [
            ("trader", "trades_completed", 2, 2),
            ("dealmaker", "trades_completed", 4, 4),
            ("landlord", "rent_collected", 250, 250),
            ("rent_baron", "rent_collected", 600, 600),
            ("traveller", "laps", 2, 2),
            ("globetrotter", "laps", 5, 5),
            ("lucky", "doubles", 3, 3),
        ],
    )
    def test_stat_backed_missions(
        self, engine: GameEngine, mission_id: str, stat: str,
        value: int, expected: int,
    ) -> None:
        pid = engine.state.turn_order[0]
        engine.state.players[pid].stats[stat] = value
        assert _progress(engine, pid, mission_id) == (expected, expected)

    def test_cash_king_uses_the_peak_not_the_current_balance(
        self, engine: GameEngine,
    ) -> None:
        """Мисията не бива да се губи, щом парите бъдат вложени в строеж."""
        pid = engine.state.turn_order[0]
        player = engine.state.players[pid]
        player.stats["max_cash"] = 2000
        player.cash = 40
        assert _progress(engine, pid, "cash_king") == (2000, 2000)

    def test_cash_king_counts_current_cash_too(self, engine: GameEngine) -> None:
        pid = engine.state.turn_order[0]
        player = engine.state.players[pid]
        player.stats["max_cash"] = 0
        player.cash = 2000
        assert _progress(engine, pid, "cash_king") == (2000, 2000)
