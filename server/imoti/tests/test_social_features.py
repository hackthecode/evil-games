"""Тестове за тайните мисии и периодичните глобални събития."""
from __future__ import annotations

from copy import deepcopy
import time

from app.game.engine import GameEngine
from app.game.properties import PropertyState, calculate_rent
from app.game.serialization import state_from_dict, state_to_client, state_to_dict
from app.game.state import Phase
from app.game.world_events import GLOBAL_EVENT_DEFINITIONS


def _event(event_id: str, started_round: int = 4) -> dict:
    definition = GLOBAL_EVENT_DEFINITIONS[event_id]
    return {
        "id": event_id,
        "title": definition["title"],
        "icon": definition["icon"],
        "description": definition["description"],
        "modifiers": deepcopy(definition["modifiers"]),
        "started_round": started_round,
        "ends_round": started_round + 2,
    }


def test_each_player_receives_a_private_mission(engine: GameEngine) -> None:
    first, second = engine.state.turn_order
    assert engine.state.players[first].secret_mission
    assert engine.state.players[second].secret_mission
    assert engine.state.players[first].secret_mission != engine.state.players[second].secret_mission

    first_view = state_to_client(engine.state, engine.board, first)
    second_view = state_to_client(engine.state, engine.board, second)

    assert first_view["my_mission"]["id"] == engine.state.players[first].secret_mission
    assert second_view["my_mission"]["id"] == engine.state.players[second].secret_mission
    assert first_view["my_mission"]["id"] != second_view["my_mission"]["id"]
    assert all("secret_mission" not in player for player in first_view["players"].values())
    assert state_to_client(engine.state, engine.board)["my_mission"] is None


def test_client_receives_server_time_for_synced_turn_timer(
    engine: GameEngine,
) -> None:
    before = time.time()
    view = state_to_client(engine.state, engine.board)
    after = time.time()

    assert before <= view["server_time"] <= after
    assert 0 < view["turn_deadline"] - view["server_time"] <= 60


def test_completed_mission_pays_bonus_only_once(engine: GameEngine) -> None:
    player = engine.state.current_player
    player.secret_mission = "portfolio"
    player.mission_completed = False
    for position in [5, 15, 25, 35]:
        engine.state.properties[position] = PropertyState(position, owner=player.player_id)
    before = player.cash

    events = engine.collect_social_events()

    assert player.mission_completed is True
    assert player.cash == before + 250
    assert player.stats["missions_completed"] == 1
    assert any(event.get("type") == "mission_completed" for event in events)
    assert any(
        event.get("type") == "payment" and event.get("amount") == 250
        for event in events
    )

    engine.collect_social_events()
    assert player.cash == before + 250
    assert player.stats["missions_completed"] == 1


def test_full_group_creates_special_event_once(engine: GameEngine) -> None:
    player = engine.state.current_player
    player.secret_mission = "traveller"
    group = next(iter(engine.board.groups))
    for position in engine.board.group_positions(group):
        engine.state.properties[position] = PropertyState(position, owner=player.player_id)

    first_events = engine.collect_social_events()
    second_events = engine.collect_social_events()

    completed = [event for event in first_events if event.get("type") == "group_completed"]
    assert len(completed) == 1
    assert completed[0]["group"] == group
    assert not any(event.get("type") == "group_completed" for event in second_events)


def test_global_events_start_end_and_do_not_repeat(engine: GameEngine) -> None:
    state = engine.state
    state.round_number = 4
    state.next_global_event_round = 4

    start_events = engine._update_global_events()
    first_id = state.active_global_event["id"]
    assert any(event.get("type") == "global_event_start" for event in start_events)
    assert state.active_global_event["ends_round"] == 6
    assert state.next_global_event_round == 7

    state.round_number = 6
    end_events = engine._update_global_events()
    assert state.active_global_event is None
    assert any(event.get("type") == "global_event_end" for event in end_events)

    state.round_number = 7
    engine._update_global_events()
    assert state.active_global_event is not None
    assert state.active_global_event["id"] != first_id


def test_property_boom_increases_rent_by_25_percent(engine: GameEngine) -> None:
    owner_id, payer_id = engine.state.turn_order
    position = next(space.position for space in engine.board.spaces if space.type == "property")
    engine.state.properties[position] = PropertyState(position, owner=owner_id)
    payer = engine.state.players[payer_id]
    owner = engine.state.players[owner_id]
    payer.position = position
    engine.state.last_roll = (3, 4)
    base_rent = calculate_rent(engine.board, engine.state.properties, position, 7)
    expected = (base_rent * 125 + 50) // 100
    payer_before = payer.cash
    owner_before = owner.cash
    engine.state.active_global_event = _event("property_boom")

    engine._resolve_space(payer)

    assert payer.cash == payer_before - expected
    assert owner.cash == owner_before + expected


def test_tax_amnesty_removes_tax_payment(engine: GameEngine) -> None:
    player = engine.state.current_player
    tax_position = next(space.position for space in engine.board.spaces if space.type == "tax")
    player.position = tax_position
    before = player.cash
    engine.state.active_global_event = _event("tax_amnesty")

    events = engine._resolve_space(player)

    assert player.cash == before
    assert engine.state.phase == Phase.MANAGEMENT
    assert any(event.get("type") == "tax_amnesty" for event in events)


def test_economic_crisis_changes_real_build_cost(engine: GameEngine) -> None:
    player = engine.state.current_player
    group = next(iter(engine.board.groups))
    positions = engine.board.group_positions(group)
    for position in positions:
        engine.state.properties[position] = PropertyState(position, owner=player.player_id)
    position = positions[0]
    base_cost = engine.board.space(position).data["improve_cost"]
    expected = (base_cost * 150 + 50) // 100
    engine.state.active_global_event = _event("economic_crisis")
    engine.state.phase = Phase.MANAGEMENT
    before = player.cash

    events = engine.build_improvement(player.player_id, position)

    assert player.cash == before - expected
    assert any(
        event.get("type") == "payment" and event.get("amount") == expected
        for event in events
    )


def test_social_state_survives_save_round_trip(engine: GameEngine) -> None:
    player = engine.state.current_player
    player.secret_mission = "builder"
    player.mission_completed = True
    engine.state.active_global_event = _event("tourist_season")
    engine.state.next_global_event_round = 7
    engine.state.last_global_event_id = "tourist_season"
    engine.state.celebrated_monopolies = [f"{player.player_id}:star_centar"]

    restored = state_from_dict(state_to_dict(engine.state))

    restored_player = restored.players[player.player_id]
    assert restored_player.secret_mission == "builder"
    assert restored_player.mission_completed is True
    assert restored.active_global_event["id"] == "tourist_season"
    assert restored.next_global_event_round == 7
    assert restored.celebrated_monopolies == [f"{player.player_id}:star_centar"]


def test_old_save_receives_missing_missions(engine: GameEngine) -> None:
    for player in engine.state.players.values():
        player.secret_mission = None
        player.mission_completed = False

    engine.ensure_secret_missions()

    missions = [player.secret_mission for player in engine.state.players.values()]
    assert all(missions)
    assert len(set(missions)) == len(missions)
