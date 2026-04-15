from typing import Optional
from urllib.parse import urlencode

from services.spotify_api_client import SPOTIFY_PLAYER_URL, spotify_api_request
from services.spotify_device_service import (
    ensure_spotify_control_device,
    transfer_spotify_to_mac,
)
from services.spotify_helpers import utc_now_iso

SPOTIFY_VOLUME_STEP_PERCENT = 5


TRANSPORT_ACTIONS = {"play", "pause", "next", "previous"}
VOLUME_ACTIONS = {"volume_up", "volume_down"}
SHUFFLE_ACTIONS = {"shuffle_on", "shuffle_off"}
TRANSFER_ACTIONS = {"transfer_here"}
SUPPORTED_ACTIONS = TRANSPORT_ACTIONS | VOLUME_ACTIONS | SHUFFLE_ACTIONS | TRANSFER_ACTIONS


def _spotify_action_route(action: str) -> Optional[tuple[str, str]]:
    routes = {
        "play": ("PUT", f"{SPOTIFY_PLAYER_URL}/play"),
        "pause": ("PUT", f"{SPOTIFY_PLAYER_URL}/pause"),
        "next": ("POST", f"{SPOTIFY_PLAYER_URL}/next"),
        "previous": ("POST", f"{SPOTIFY_PLAYER_URL}/previous"),
    }
    return routes.get(action)


def _clamp_spotify_volume_percent(value: int) -> int:
    return max(0, min(100, int(value)))


def _get_active_spotify_volume_percent() -> tuple[Optional[int], Optional[str]]:
    status_code, payload, error_message = spotify_api_request("GET", SPOTIFY_PLAYER_URL)
    if status_code >= 400 or payload is None:
        return None, error_message or "Unable to read Spotify playback state."

    device = payload.get("device") if isinstance(payload, dict) else None
    if not isinstance(device, dict):
        return None, "Spotify playback device details are unavailable."

    volume_percent = device.get("volume_percent")
    if not isinstance(volume_percent, (int, float)):
        return None, "Current Spotify volume is unavailable."

    return _clamp_spotify_volume_percent(int(volume_percent)), None


def _resolve_spotify_volume_target(action: str) -> tuple[Optional[int], Optional[str]]:
    current_volume, error_message = _get_active_spotify_volume_percent()
    if current_volume is None:
        return None, error_message or "Current Spotify volume is unavailable."

    delta = SPOTIFY_VOLUME_STEP_PERCENT if action == "volume_up" else -SPOTIFY_VOLUME_STEP_PERCENT
    return _clamp_spotify_volume_percent(current_volume + delta), None


def _spotify_control_error_status(status_code: int) -> int:
    if status_code == 401:
        return 401
    if status_code == 404:
        return 409
    if status_code >= 500 or status_code == 0:
        return 502
    return 400


def execute_spotify_control_action(raw_action: str) -> tuple[dict[str, object], int]:
    action = raw_action.strip().lower() if isinstance(raw_action, str) else ""

    if action not in SUPPORTED_ACTIONS:
        return {
            "requestedAtUtc": utc_now_iso(),
            "ok": False,
            "action": action,
            "message": "Unsupported Spotify action.",
        }, 400

    status_code = 0
    error_message = None
    target_volume = None
    shuffle_enabled = None
    transfer_target_name = None

    if action in TRANSFER_ACTIONS:
        status_code, error_message, transfer_target_name = transfer_spotify_to_mac()
    else:
        ready, ready_error = ensure_spotify_control_device(action)
        if not ready:
            return {
                "requestedAtUtc": utc_now_iso(),
                "ok": False,
                "action": action,
                "message": ready_error or "Spotify playback device is unavailable.",
            }, 409

        if action in TRANSPORT_ACTIONS:
            route = _spotify_action_route(action)
            if route is None:
                return {
                    "requestedAtUtc": utc_now_iso(),
                    "ok": False,
                    "action": action,
                    "message": "Unsupported Spotify action.",
                }, 400

            method, url = route
            status_code, _, error_message = spotify_api_request(method, url)
        elif action in VOLUME_ACTIONS:
            target_volume, volume_error = _resolve_spotify_volume_target(action)
            if target_volume is None:
                return {
                    "requestedAtUtc": utc_now_iso(),
                    "ok": False,
                    "action": action,
                    "message": volume_error or "Unable to resolve Spotify volume target.",
                }, 409

            query = urlencode({"volume_percent": target_volume})
            status_code, _, error_message = spotify_api_request(
                "PUT",
                f"{SPOTIFY_PLAYER_URL}/volume?{query}",
            )
        else:
            shuffle_enabled = action == "shuffle_on"
            query = urlencode({"state": "true" if shuffle_enabled else "false"})
            status_code, _, error_message = spotify_api_request(
                "PUT",
                f"{SPOTIFY_PLAYER_URL}/shuffle?{query}",
            )

    if 200 <= status_code < 300:
        message_map = {
            "play": "Playback resumed.",
            "pause": "Playback paused.",
            "next": "Skipped to next track.",
            "previous": "Went to previous track.",
            "volume_up": f"Volume increased to {target_volume}%.",
            "volume_down": f"Volume decreased to {target_volume}%.",
            "shuffle_on": "Shuffle enabled.",
            "shuffle_off": "Shuffle disabled.",
            "transfer_here": "Playback transferred to this Mac.",
        }

        if action == "transfer_here" and transfer_target_name:
            success_message = f"Playback transferred to {transfer_target_name}."
        else:
            success_message = message_map.get(action, "Spotify command sent.")

        return {
            "requestedAtUtc": utc_now_iso(),
            "ok": True,
            "action": action,
            "message": success_message,
            "volumePercent": target_volume,
            "shuffleEnabled": shuffle_enabled,
            "transferTarget": transfer_target_name,
        }, 200

    return {
        "requestedAtUtc": utc_now_iso(),
        "ok": False,
        "action": action,
        "message": error_message or f"Spotify command failed ({status_code}).",
    }, _spotify_control_error_status(status_code)
