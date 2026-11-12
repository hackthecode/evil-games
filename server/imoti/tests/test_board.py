"""Тестове на таблото и изчисляването на наеми."""
from __future__ import annotations

from app.game.board import Board
from app.game.properties import (
    PropertyState,
    calculate_rent,
    can_build,
    owns_full_group,
)


class TestBoardStructure:
    def test_board_has_40_spaces(self, board: Board) -> None:
        assert board.size == 40
        assert len(board.spaces) == 40

    def test_positions_sequential(self, board: Board) -> None:
        assert [s.position for s in board.spaces] == list(range(40))

    def test_corners_present(self, board: Board) -> None:
        assert board.find_corner("start") == 0
        assert board.find_corner("jail") == 10
        assert board.find_corner("free_parking") == 20
        assert board.find_corner("goto_jail") == 30

    def test_groups_complete(self, board: Board) -> None:
        for group in board.groups:
            assert board.group_size(group) >= 2

    def test_transport_and_utility_counts(self, board: Board) -> None:
        transports = [s for s in board.spaces if s.type == "transport"]
        utilities = [s for s in board.spaces if s.type == "utility"]
        assert len(transports) == 4
        assert len(utilities) == 2

    def test_property_rent_progression(self, board: Board) -> None:
        """Наемът расте с всяко ниво на подобрение (6 стъпала)."""
        for space in board.spaces:
            if space.type == "property":
                rent = space.data["rent"]
                assert len(rent) == 6
                assert all(rent[i] < rent[i + 1] for i in range(5))

    def test_all_property_names_are_resorts(self, board: Board) -> None:
        expected = {
            "Вършец", "Банкя", "Чифлик", "Рибарица", "Девин", "Огняново",
            "Сапарева баня", "Велинград", "Сандански", "Хисаря",
            "Павел баня", "Поморие", "Созопол", "Свети Влас",
            "Златни пясъци", "Слънчев бряг", "Албена", "Пампорово",
            "Боровец", "Банско", "Дюни", "Елените",
        }
        actual = {space.name for space in board.spaces if space.type == "property"}
        assert actual == expected

    def test_improvement_levels_named(self, board: Board) -> None:
        assert len(board.improvement_levels) == 6
        assert board.improvement_levels[5] == "Гранд хотел"


class TestRentCalculation:
    def test_unowned_no_rent(self, board: Board) -> None:
        assert calculate_rent(board, {}, 3, 7) == 0

    def test_base_rent(self, board: Board) -> None:
        states = {3: PropertyState(position=3, owner="a")}
        assert calculate_rent(board, states, 3, 7) == 4

    def test_full_group_doubles(self, board: Board) -> None:
        states = {
            1: PropertyState(position=1, owner="a"),
            3: PropertyState(position=3, owner="a"),
        }
        assert calculate_rent(board, states, 3, 7) == 8

    def test_level_rent(self, board: Board) -> None:
        states = {
            1: PropertyState(position=1, owner="a", level=3),
            3: PropertyState(position=3, owner="a", level=3),
        }
        assert calculate_rent(board, states, 3, 7) == 180

    def test_transport_rent_scales(self, board: Board) -> None:
        states = {5: PropertyState(position=5, owner="a")}
        assert calculate_rent(board, states, 5, 7) == 25
        states[15] = PropertyState(position=15, owner="a")
        assert calculate_rent(board, states, 5, 7) == 50
        states[25] = PropertyState(position=25, owner="a")
        states[35] = PropertyState(position=35, owner="a")
        assert calculate_rent(board, states, 5, 7) == 200

    def test_utility_rent_uses_dice(self, board: Board) -> None:
        states = {12: PropertyState(position=12, owner="a")}
        assert calculate_rent(board, states, 12, 8) == 32  # 4 × 8
        states[28] = PropertyState(position=28, owner="a")
        assert calculate_rent(board, states, 12, 8) == 80  # 10 × 8

    def test_mortgaged_no_rent(self, board: Board) -> None:
        states = {3: PropertyState(position=3, owner="a", mortgaged=True)}
        assert calculate_rent(board, states, 3, 7) == 0


class TestGroupLogic:
    def test_owns_full_group(self, board: Board) -> None:
        states = {
            1: PropertyState(position=1, owner="a"),
            3: PropertyState(position=3, owner="a"),
        }
        assert owns_full_group(board, states, "a", "star_centar")

    def test_mortgage_breaks_group(self, board: Board) -> None:
        states = {
            1: PropertyState(position=1, owner="a", mortgaged=True),
            3: PropertyState(position=3, owner="a"),
        }
        assert not owns_full_group(board, states, "a", "star_centar")

    def test_can_build_only_property(self, board: Board) -> None:
        states = {5: PropertyState(position=5, owner="a")}
        ok, _ = can_build(board, states, "a", 5)  # транспорт
        assert not ok

    def test_even_building_enforced(self, board: Board) -> None:
        states = {
            1: PropertyState(position=1, owner="a", level=1),
            3: PropertyState(position=3, owner="a"),
        }
        ok, _ = can_build(board, states, "a", 1)  # 3 е с по-ниско ниво
        assert not ok
        ok, _ = can_build(board, states, "a", 3)
        assert ok
