import json
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from services.spotify_api_client import SPOTIFY_PLAYER_URL, get_spotify_access_token
from services.spotify_helpers import (
    decode_spotify_error,
    resolve_default_spotify_embed_url,
    spotify_embed_url_from_uri,
    utc_now_iso,
)


def _utc_now_iso() -> str:
    return utc_now_iso()


def _spotify_embed_url_from_uri(uri: Optional[str]) -> Optional[str]:
    return spotify_embed_url_from_uri(uri)


def _resolve_default_spotify_embed_url() -> Optional[str]:
    return resolve_default_spotify_embed_url()


def _decode_spotify_error(raw_text: str, fallback: str) -> str:
    return decode_spotify_error(raw_text, fallback)


def _get_spotify_access_token(force_refresh: bool = False) -> tuple[Optional[str], Optional[str]]:
    return get_spotify_access_token(force_refresh=force_refresh)


def _extract_spotify_track(item: object, progress_ms: object) -> Optional[dict[str, object]]:
    if not isinstance(item, dict):
        return None

    artist_names: list[str] = []
    for artist in item.get("artists", []):
        if isinstance(artist, dict):
            artist_name = artist.get("name")
            if isinstance(artist_name, str) and artist_name.strip():
                artist_names.append(artist_name.strip())

    album = item.get("album") if isinstance(item.get("album"), dict) else {}
    album_name = album.get("name") if isinstance(album, dict) else None
    artwork_url = None

    images = album.get("images") if isinstance(album, dict) else None
    if isinstance(images, list):
        for image in images:
            if isinstance(image, dict):
                candidate = image.get("url")
                if isinstance(candidate, str) and candidate.strip():
                    artwork_url = candidate.strip()
                    break

    duration_ms = None
    if isinstance(item.get("duration_ms"), (int, float)):
        duration_ms = max(0, int(item["duration_ms"]))

    progress_value = None
    if isinstance(progress_ms, (int, float)):
        progress_value = max(0, int(progress_ms))

    name = item.get("name")
    uri = item.get("uri")

    return {
        "name": name.strip() if isinstance(name, str) and name.strip() else None,
        "artist": artist_names[0] if artist_names else None,
        "artists": artist_names,
        "album": album_name.strip() if isinstance(album_name, str) and album_name.strip() else None,
        "uri": uri.strip() if isinstance(uri, str) and uri.strip() else None,
        "durationMs": duration_ms,
        "progressMs": progress_value,
        "artworkUrl": artwork_url,
    }


def _extract_spotify_device(device: object) -> Optional[dict[str, object]]:
    if not isinstance(device, dict):
        return None

    name = device.get("name")
    device_type = device.get("type")
    is_active = device.get("is_active")
    volume_percent = device.get("volume_percent")

    return {
        "name": name.strip() if isinstance(name, str) and name.strip() else None,
        "type": device_type.strip() if isinstance(device_type, str) and device_type.strip() else None,
        "isActive": is_active if isinstance(is_active, bool) else None,
        "volumePercent": int(volume_percent) if isinstance(volume_percent, (int, float)) else None,
    }


def _spotify_unavailable_payload(message: str, embed_url: Optional[str] = None) -> dict[str, object]:
    resolved_embed_url = embed_url or _resolve_default_spotify_embed_url()
    return {
        "requestedAtUtc": _utc_now_iso(),
        "available": False,
        "source": "spotify-web-api",
        "isPlaying": None,
        "isShuffleEnabled": None,
        "track": None,
        "device": None,
        "embedUrl": resolved_embed_url,
        "message": message,
    }


def fetch_spotify_widget_payload() -> dict[str, object]:
    default_embed_url = _resolve_default_spotify_embed_url()
    token, token_error = _get_spotify_access_token()
    if not token:
        return _spotify_unavailable_payload(
            token_error or "Spotify credentials are unavailable.",
            embed_url=default_embed_url,
        )

    for attempt in range(2):
        request = Request(
            SPOTIFY_PLAYER_URL,
            method="GET",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
        )

        try:
            with urlopen(request, timeout=5) as response:
                status_code = getattr(response, "status", response.getcode())
                body = response.read().decode("utf-8")
                payload = json.loads(body) if body.strip() else {}

            if status_code == 204 or not payload:
                return {
                    "requestedAtUtc": _utc_now_iso(),
                    "available": True,
                    "source": "spotify-web-api",
                    "isPlaying": False,
                    "isShuffleEnabled": None,
                    "track": None,
                    "device": None,
                    "embedUrl": default_embed_url,
                    "message": "No active Spotify playback.",
                }

            if not isinstance(payload, dict):
                return _spotify_unavailable_payload("Spotify player response was invalid.", embed_url=default_embed_url)

            is_playing = payload.get("is_playing")
            shuffle_state = payload.get("shuffle_state")
            progress_ms = payload.get("progress_ms")
            track = _extract_spotify_track(payload.get("item"), progress_ms)
            device = _extract_spotify_device(payload.get("device"))
            context_payload = payload.get("context") if isinstance(payload.get("context"), dict) else None
            context_uri = context_payload.get("uri") if isinstance(context_payload, dict) else None
            track_uri = track.get("uri") if isinstance(track, dict) else None
            embed_url = (
                _spotify_embed_url_from_uri(track_uri)
                or _spotify_embed_url_from_uri(context_uri)
                or default_embed_url
            )

            return {
                "requestedAtUtc": _utc_now_iso(),
                "available": True,
                "source": "spotify-web-api",
                "isPlaying": is_playing if isinstance(is_playing, bool) else None,
                "isShuffleEnabled": shuffle_state if isinstance(shuffle_state, bool) else None,
                "track": track,
                "device": device,
                "embedUrl": embed_url,
                "message": "Now playing retrieved." if track else "Spotify is connected.",
            }
        except HTTPError as ex:
            body = ex.read().decode("utf-8", errors="replace")
            if ex.code == 401 and attempt == 0:
                token, token_error = _get_spotify_access_token(force_refresh=True)
                if token:
                    continue
                return _spotify_unavailable_payload(
                    token_error or "Spotify authorization failed.",
                    embed_url=default_embed_url,
                )

            message = _decode_spotify_error(
                body,
                fallback=f"Spotify player request failed ({ex.code}).",
            )
            return _spotify_unavailable_payload(message, embed_url=default_embed_url)
        except (URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError):
            return _spotify_unavailable_payload("Spotify player request failed.", embed_url=default_embed_url)

    return _spotify_unavailable_payload("Spotify player request failed.", embed_url=default_embed_url)
