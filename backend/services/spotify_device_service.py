import subprocess
import sys
import time
from typing import Optional
from urllib.parse import urlencode

from services.spotify_api_client import SPOTIFY_PLAYER_URL, spotify_api_request
from services.spotify_helpers import (
    is_spotify_computer_device,
    resolve_spotify_preferred_device_name,
)


def _choose_spotify_control_device(
    devices: list[dict[str, object]],
    preferred_name: Optional[str],
) -> Optional[dict[str, object]]:
    candidates: list[dict[str, object]] = []

    for device in devices:
        device_id = device.get("id")
        if not isinstance(device_id, str) or not device_id.strip():
            continue

        if device.get("is_restricted") is True:
            continue

        candidates.append(device)

    if not candidates:
        return None

    if preferred_name:
        lowered = preferred_name.lower()
        for device in candidates:
            name = device.get("name")
            if isinstance(name, str) and lowered in name.lower():
                return device

    for device in candidates:
        if is_spotify_computer_device(device) and device.get("is_active") is True:
            return device

    for device in candidates:
        if is_spotify_computer_device(device):
            return device

    for device in candidates:
        if device.get("is_active") is True:
            return device

    return candidates[0]


def ensure_spotify_control_device(action: str) -> tuple[bool, Optional[str]]:
    status_code, payload, error_message = spotify_api_request(
        "GET",
        "https://api.spotify.com/v1/me/player/devices",
    )
    if status_code >= 400 or payload is None:
        return False, error_message or "Unable to read Spotify devices."

    raw_devices = payload.get("devices")
    if not isinstance(raw_devices, list) or not raw_devices:
        return False, "No Spotify playback devices are available."

    devices = [device for device in raw_devices if isinstance(device, dict)]
    controllable_devices: list[dict[str, object]] = []
    for device in devices:
        device_id = device.get("id")
        if not isinstance(device_id, str) or not device_id.strip():
            continue

        if device.get("is_restricted") is True:
            continue

        controllable_devices.append(device)

    if not controllable_devices:
        return False, "No controllable Spotify device is available."

    for device in controllable_devices:
        if device.get("is_active") is True:
            return True, None

    if action != "play":
        return False, "No active Spotify playback device is available."

    target_device = _choose_spotify_control_device(
        controllable_devices,
        resolve_spotify_preferred_device_name(),
    )
    if target_device is None:
        return False, "No controllable Spotify device is available."

    if target_device.get("is_active") is True:
        return True, None

    device_id = target_device.get("id")
    if not isinstance(device_id, str) or not device_id.strip():
        return False, "No valid Spotify device id was found."

    transfer_status, _, transfer_error = spotify_api_request(
        "PUT",
        SPOTIFY_PLAYER_URL,
        body={
            "device_ids": [device_id],
            "play": action == "play",
        },
    )
    if transfer_status >= 400:
        return False, transfer_error or "Unable to activate a Spotify playback device for play."

    return True, None


def _list_spotify_controllable_devices() -> tuple[Optional[list[dict[str, object]]], Optional[str], int]:
    status_code, payload, error_message = spotify_api_request(
        "GET",
        "https://api.spotify.com/v1/me/player/devices",
    )
    if status_code >= 400 or payload is None:
        return None, error_message or "Unable to read Spotify devices.", status_code

    raw_devices = payload.get("devices")
    if not isinstance(raw_devices, list):
        return [], None, status_code

    controllable: list[dict[str, object]] = []
    for device in raw_devices:
        if not isinstance(device, dict):
            continue

        device_id = device.get("id")
        if not isinstance(device_id, str) or not device_id.strip():
            continue

        if device.get("is_restricted") is True:
            continue

        controllable.append(device)

    return controllable, None, status_code


def _choose_spotify_transfer_device(
    devices: list[dict[str, object]],
    preferred_name: Optional[str],
) -> Optional[dict[str, object]]:
    if preferred_name:
        lowered = preferred_name.lower()
        for device in devices:
            name = device.get("name")
            if isinstance(name, str) and lowered in name.lower():
                return device

    for device in devices:
        if is_spotify_computer_device(device) and device.get("is_active") is True:
            return device

    for device in devices:
        if is_spotify_computer_device(device):
            return device

    return None


def _try_launch_spotify_app_on_mac() -> bool:
    if sys.platform != "darwin":
        return False

    try:
        subprocess.run(
            ["open", "-a", "Spotify"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except OSError:
        return False


def _extract_spotify_resume_payload(playback_state: dict[str, object]) -> Optional[dict[str, object]]:
    if not isinstance(playback_state, dict):
        return None

    item = playback_state.get("item") if isinstance(playback_state.get("item"), dict) else None
    context = playback_state.get("context") if isinstance(playback_state.get("context"), dict) else None
    track_uri = item.get("uri") if isinstance(item, dict) else None
    context_uri = context.get("uri") if isinstance(context, dict) else None
    progress_ms = playback_state.get("progress_ms")

    payload: dict[str, object] = {}

    if isinstance(context_uri, str) and context_uri.strip() and isinstance(track_uri, str) and track_uri.strip():
        payload["context_uri"] = context_uri.strip()
        payload["offset"] = {"uri": track_uri.strip()}
    elif isinstance(track_uri, str) and track_uri.strip():
        payload["uris"] = [track_uri.strip()]

    if isinstance(progress_ms, (int, float)):
        payload["position_ms"] = max(0, int(progress_ms))

    return payload or None


def transfer_spotify_to_mac() -> tuple[int, Optional[str], Optional[str]]:
    launch_attempted = _try_launch_spotify_app_on_mac()
    preferred_name = resolve_spotify_preferred_device_name()
    attempts = 8 if launch_attempted else 3

    playback_status, playback_state, playback_error = spotify_api_request("GET", SPOTIFY_PLAYER_URL)
    if playback_status >= 400 or playback_state is None:
        return playback_status, playback_error or "Unable to read Spotify playback state.", None

    state_dict = playback_state if isinstance(playback_state, dict) else {}
    was_playing = state_dict.get("is_playing") is True
    resume_payload = _extract_spotify_resume_payload(state_dict)

    for attempt in range(attempts):
        devices, list_error, list_status = _list_spotify_controllable_devices()
        if devices is None:
            return list_status, list_error or "Unable to read Spotify devices.", None

        target_device = _choose_spotify_transfer_device(devices, preferred_name)
        if target_device is not None:
            device_id = target_device.get("id")
            if not isinstance(device_id, str) or not device_id.strip():
                return 409, "No valid Spotify device id was found.", None

            transfer_status, _, transfer_error = spotify_api_request(
                "PUT",
                SPOTIFY_PLAYER_URL,
                body={
                    "device_ids": [device_id],
                    "play": False,
                },
            )
            if transfer_status >= 400:
                return transfer_status, transfer_error or "Unable to transfer playback to this Mac.", None

            if was_playing:
                play_url = f"{SPOTIFY_PLAYER_URL}/play?{urlencode({'device_id': device_id})}"
                if resume_payload is not None:
                    resume_status, _, resume_error = spotify_api_request(
                        "PUT",
                        play_url,
                        body=resume_payload,
                    )
                    if resume_status >= 400:
                        fallback_status, _, fallback_error = spotify_api_request("PUT", play_url)
                        if fallback_status >= 400:
                            return fallback_status, fallback_error or resume_error or "Unable to resume playback after transfer.", None
                else:
                    resume_status, _, resume_error = spotify_api_request("PUT", play_url)
                    if resume_status >= 400:
                        return resume_status, resume_error or "Unable to resume playback after transfer.", None

            target_name = target_device.get("name")
            return transfer_status, None, target_name if isinstance(target_name, str) and target_name.strip() else None

        if attempt < attempts - 1:
            time.sleep(0.4)

    if preferred_name:
        return 409, f"Could not find the preferred Spotify device \"{preferred_name}\" on this Mac.", None

    return 409, "No Spotify desktop playback device was found on this Mac.", None
