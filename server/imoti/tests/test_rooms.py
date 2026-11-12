"""Тестове на управлението на стаи: създаване, присъединяване, reconnect, запис."""
from __future__ import annotations

import json
import time

import pytest

from app.game.serialization import (
    SaveFormatError,
    state_from_dict,
    state_to_dict,
)
from app.room_manager import RoomError, RoomManager
from app.security import (
    ALLOWED_TOKENS,
    generate_room_code,
    make_reconnect_token,
    sanitize_chat,
    sanitize_gender_choice,
    sanitize_name,
    sanitize_room_code,
    sanitize_token_choice,
    verify_reconnect_token,
)


@pytest.fixture()
def manager(board) -> RoomManager:
    return RoomManager(board)


class TestRoomLifecycle:
    def test_create_room(self, manager: RoomManager) -> None:
        room, member, token = manager.create_room("Иван", "red", "female")
        assert len(room.code) == 6
        assert room.code.isalnum() and room.code == room.code.upper()
        assert member.is_host
        assert member.ready
        assert member.token == "red"
        assert member.gender == "female"
        assert verify_reconnect_token(token) == (room.code, member.player_id)

    def test_create_room_applies_saved_settings(self, manager: RoomManager) -> None:
        room, _, _ = manager.create_room(
            "Иван",
            "red",
            initial_settings={
                "rules_preset": "custom",
                "max_players": 4,
                "starting_cash": 2300,
                "turn_time_limit": 60,
                "trading_enabled": False,
                "непозната_настройка": "се игнорира",
            },
        )

        assert room.game_settings.rules_preset == "custom"
        assert room.game_settings.max_players == 4
        assert room.game_settings.starting_cash == 2300
        assert room.game_settings.turn_time_limit == 60
        assert room.game_settings.trading_enabled is False

    def test_join_room(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        room2, member, _ = manager.join_room(room.code, "Мария", "black", "female")
        assert room2 is room
        assert not member.is_host
        assert member.gender == "female"
        assert len(room.players()) == 2

    def test_pause_freezes_disconnected_player_grace_period(
        self, manager: RoomManager,
    ) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        _, guest, _ = manager.join_room(room.code, "Мария", "black")
        manager.set_ready(room, guest, True)
        manager.start_game(room, host)
        with pytest.raises(RoomError, match="Само домакинът"):
            manager.pause_game(room, guest)
        guest.connected = False
        guest.disconnected_at = time.time() - 30

        manager.pause_game(room, host)

        assert room.engine.state.paused is True
        assert 149 <= guest.paused_disconnect_remaining <= 151
        guest.paused_disconnect_remaining = 100.0

        manager.resume_game(room, host)

        assert room.engine.state.paused is False
        deadline = guest.disconnected_at + room.game_settings.disconnect_grace_seconds
        assert 99 <= deadline - time.time() <= 101
        assert guest.paused_disconnect_remaining is None

    def test_join_missing_room(self, manager: RoomManager) -> None:
        with pytest.raises(RoomError):
            manager.join_room("XXXXXX", "Мария", "black")

    def test_duplicate_name_rejected(self, manager: RoomManager) -> None:
        room, _, _ = manager.create_room("Иван", "red")
        with pytest.raises(RoomError):
            manager.join_room(room.code, "иван", "black")

    def test_room_capacity(self, manager: RoomManager) -> None:
        room, _, _ = manager.create_room("Играч0", "red")
        room.game_settings.max_players = 3
        manager.join_room(room.code, "Играч1", "black")
        manager.join_room(room.code, "Играч2", "green")
        with pytest.raises(RoomError):
            manager.join_room(room.code, "Играч3", "blue")

    def test_taken_token_reassigned(self, manager: RoomManager) -> None:
        room, _, _ = manager.create_room("Иван", "red")
        _, member, _ = manager.join_room(room.code, "Мария", "red")
        assert member.token != "red"

    def test_gender_can_be_changed_before_start(self, manager: RoomManager) -> None:
        room, member, _ = manager.create_room("Иван", "red")
        manager.set_gender(room, member, "female")
        assert member.gender == "female"
        with pytest.raises(RoomError):
            manager.set_gender(room, member, "невалиден")

    def test_password_protected_room(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        manager.update_settings(room, host, {"room_password": "тайна"})
        with pytest.raises(RoomError):
            manager.join_room(room.code, "Мария", "black", password="грешна")
        _, member, _ = manager.join_room(room.code, "Мария", "black", password="тайна")
        assert member.name == "Мария"

    def test_host_transfer_on_leave(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        _, member2, _ = manager.join_room(room.code, "Мария", "black")
        manager.leave_room(room, host)
        assert room.members[member2.player_id].is_host

    def test_host_can_remove_connected_player_after_two_timeouts(
        self, manager: RoomManager,
    ) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        _, member, _ = manager.join_room(room.code, "Мария", "black")
        manager.set_ready(room, member, True)
        manager.start_game(room, host)
        game_player = room.engine.state.players[member.player_id]
        game_player.stats["consecutive_timeouts"] = 1

        with pytest.raises(RoomError, match="два поредни"):
            manager.remove_member_by_host(room, host, member.player_id)

        game_player.stats["consecutive_timeouts"] = 2
        removed, _ = manager.remove_member_by_host(room, host, member.player_id)
        assert removed is member
        assert member.player_id not in room.members
        assert game_player.bankrupt

    def test_room_removed_when_empty(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        manager.leave_room(room, host)
        assert room.code not in manager.rooms


class TestGameStart:
    def test_start_requires_host(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        _, member, _ = manager.join_room(room.code, "Мария", "black")
        manager.set_ready(room, member, True)
        with pytest.raises(RoomError):
            manager.start_game(room, member)

    def test_start_requires_ready(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        manager.join_room(room.code, "Мария", "black")
        with pytest.raises(RoomError):
            manager.start_game(room, host)

    def test_start_success(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        _, member, _ = manager.join_room(room.code, "Мария", "black")
        manager.set_ready(room, member, True)
        manager.start_game(room, host)
        assert room.started
        assert room.engine is not None
        assert len(room.engine.state.players) == 2
        # Настройките са заключени.
        with pytest.raises(RoomError):
            manager.update_settings(room, host, {"starting_cash": 3000})

    def test_start_needs_two_players(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        with pytest.raises(RoomError):
            manager.start_game(room, host)


class TestReconnect:
    def test_reconnect_flow(self, manager: RoomManager) -> None:
        room, host, token = manager.create_room("Иван", "red")
        manager.mark_disconnected(room, host)
        assert not host.connected
        verified = verify_reconnect_token(token)
        assert verified is not None
        code, player_id = verified
        found = manager.find_member(code, player_id)
        assert found is not None
        room2, member = found
        manager.mark_reconnected(room2, member, "sid-new")
        assert member.connected
        assert member.sid == "sid-new"

    def test_tampered_token_rejected(self, manager: RoomManager) -> None:
        _, _, token = manager.create_room("Иван", "red")
        tampered = token[:-4] + "0000"
        assert verify_reconnect_token(tampered) is None

    def test_garbage_token_rejected(self) -> None:
        assert verify_reconnect_token("боклук") is None
        assert verify_reconnect_token("") is None
        assert verify_reconnect_token("a:b:c:d:e:f") is None


class TestSecurity:
    def test_room_codes_unique_format(self) -> None:
        codes = {generate_room_code() for _ in range(100)}
        assert len(codes) > 90  # практически без колизии
        for code in codes:
            assert len(code) == 6

    def test_sanitize_name(self) -> None:
        assert sanitize_name("  Иван  Петров ") == "Иван Петров"
        assert sanitize_name("") is None
        assert sanitize_name("а" * 21) is None
        assert sanitize_name(123) is None
        assert sanitize_name("<script>") == "&lt;script&gt;"

    def test_sanitize_chat_escapes_html(self) -> None:
        assert sanitize_chat("<b>здрасти</b>") == "&lt;b&gt;здрасти&lt;/b&gt;"
        assert sanitize_chat("х" * 301) is None

    def test_sanitize_room_code(self) -> None:
        assert sanitize_room_code("abc123") == "ABC123"
        assert sanitize_room_code("ab") is None
        assert sanitize_room_code("абв123") is None

    def test_avatar_choices_are_validated(self) -> None:
        assert sanitize_token_choice("red") == "red"
        assert sanitize_token_choice("white") == "white"
        assert sanitize_token_choice("purple") == "purple"
        assert sanitize_token_choice("turquoise") == "turquoise"
        assert sanitize_token_choice("owl") == "red"  # стар запис
        assert sanitize_token_choice("teal") is None
        assert len(ALLOWED_TOKENS) == 12
        assert sanitize_gender_choice("male") == "male"
        assert sanitize_gender_choice("female") == "female"
        assert sanitize_gender_choice("друго") is None


class TestSerialization:
    def test_round_trip(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        _, member, _ = manager.join_room(room.code, "Мария", "black", "female")
        manager.set_ready(room, member, True)
        manager.start_game(room, host)
        engine = room.engine
        assert engine is not None
        engine.state.settings.eu_subsidies_enabled = True
        engine.state.settings.eu_subsidy_amount = 275
        data = state_to_dict(engine.state)
        restored = state_from_dict(data)
        assert restored.turn_order == engine.state.turn_order
        assert restored.phase == engine.state.phase
        assert set(restored.players) == set(engine.state.players)
        assert restored.settings.starting_cash == engine.state.settings.starting_cash
        assert restored.settings.eu_subsidies_enabled is True
        assert restored.settings.eu_subsidy_amount == 275
        assert restored.players[member.player_id].gender == "female"

    def test_legacy_avatars_receive_distinct_colors(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        _, member, _ = manager.join_room(room.code, "Мария", "black")
        manager.set_ready(room, member, True)
        manager.start_game(room, host)
        state = room.engine.state
        state.players[host.player_id].token = "owl"
        state.players[member.player_id].token = "backpack"
        state.players[member.player_id].gender = "невалиден"

        manager._normalize_restored_avatars(state)

        colors = {player.token for player in state.players.values()}
        assert len(colors) == 2
        assert colors.issubset(set(ALLOWED_TOKENS))
        assert state.players[member.player_id].gender == "male"

    def test_corrupt_save_rejected(self) -> None:
        with pytest.raises(SaveFormatError):
            state_from_dict({"format_version": 999})
        with pytest.raises(SaveFormatError):
            state_from_dict({"format_version": 1})  # липсват ключове
        with pytest.raises(SaveFormatError):
            state_from_dict("не е речник")  # type: ignore[arg-type]

    def test_settings_validation(self) -> None:
        from app.game.rules import validate_settings_update

        clean = validate_settings_update({
            "starting_cash": "2000",
            "max_players": 99,
            "trading_enabled": 0,
            "auctions_enabled": True,
            "eu_subsidies_enabled": True,
            "eu_subsidy_amount": 9000,
            "auction_seconds": 500,
            "victory_condition": "нещо",
            "непознат_ключ": 5,
        })
        assert clean["starting_cash"] == 2000
        assert clean["max_players"] == 10  # ограничено до макс. 10
        assert clean["trading_enabled"] is False
        assert clean["auctions_enabled"] is True
        assert clean["eu_subsidies_enabled"] is True
        assert clean["eu_subsidy_amount"] == 2000
        assert clean["auction_seconds"] == 120  # ограничено до максимума
        assert "victory_condition" not in clean
        assert "непознат_ключ" not in clean


class TestAdminPanel:
    """Домакински правомощия и конзолата на връзките."""

    def test_ip_never_leaves_in_lobby_projection(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        _, member, _ = manager.join_room(room.code, "Мария", "black")
        host.ip = "192.168.1.10"
        member.ip = "192.168.1.11"
        payload = room.lobby_to_client()
        serialized = json.dumps(payload, ensure_ascii=False)
        # Лобито се излъчва към ВСИЧКИ — адресите не бива да са в него.
        assert "192.168.1.10" not in serialized
        assert "192.168.1.11" not in serialized
        assert all("ip" not in entry for entry in payload["members"])

    def test_connection_log_records_details(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        host.ip = "10.0.0.5"
        entry = room.record_connection("create", host, detail="създава стаята")
        assert entry["name"] == "Иван"
        assert entry["ip"] == "10.0.0.5"
        assert entry["event"] == "create"
        assert entry["ts"] > 0
        assert room.connection_log[-1] is entry

    def test_connection_log_is_capped(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        for _ in range(340):
            room.record_connection("connect", host)
        assert len(room.connection_log) == 300

    def test_force_removes_connected_player(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        _, member, _ = manager.join_room(room.code, "Мария", "black")
        manager.set_ready(room, member, True)
        manager.start_game(room, host)
        # Без force свързан играч без неактивни ходове е защитен.
        with pytest.raises(RoomError, match="два поредни"):
            manager.remove_member_by_host(room, host, member.player_id)
        removed, _ = manager.remove_member_by_host(
            room, host, member.player_id, force=True,
        )
        assert removed is member
        assert member.player_id not in room.members

    def test_force_still_blocks_self_removal(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        manager.join_room(room.code, "Мария", "black")
        with pytest.raises(RoomError, match="себе си"):
            manager.remove_member_by_host(room, host, host.player_id, force=True)

    def test_end_game_early_picks_richest(self, manager: RoomManager) -> None:
        room, host, _ = manager.create_room("Иван", "red")
        _, member, _ = manager.join_room(room.code, "Мария", "black")
        manager.set_ready(room, member, True)
        manager.start_game(room, host)
        engine = room.engine
        engine.state.players[member.player_id].cash = 9999
        engine.end_game_early()
        assert engine.state.winner == member.player_id
        assert engine.state.phase.value == "GAME_OVER"
