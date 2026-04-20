import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app_config import BASE_DIR

SOURCE_SPOTIFY_ENV_FILE = BASE_DIR.parent.parent / "VoiceAssistant" / ".env"
STAGED_SPOTIFY_ENV_FILE = Path(__file__).resolve().parents[3] / "voiceassistant.env"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_dotenv_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue

                if line.startswith("export "):
                    line = line[len("export "):].strip()

                if "=" not in line:
                    continue

                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key:
                    values[key] = value
    except OSError:
        return {}

    return values


def load_spotify_env_values() -> dict[str, str]:
    for env_path in (SOURCE_SPOTIFY_ENV_FILE, STAGED_SPOTIFY_ENV_FILE):
        if env_path.exists():
            return _parse_dotenv_file(env_path)

    return {}


def _first_non_empty(*values: Optional[str]) -> Optional[str]:
    for value in values:
        if isinstance(value, str):
            trimmed = value.strip()
            if trimmed:
                return trimmed

    return None


def resolve_spotify_credentials() -> tuple[Optional[str], Optional[str], Optional[str]]:
    env_values = load_spotify_env_values()

    client_id = _first_non_empty(env_values.get("Spotify_ClientID"))
    client_secret = _first_non_empty(env_values.get("Spotify_ClientSecret"))
    refresh_token = _first_non_empty(env_values.get("Spotify_RefreshToken"))

    return client_id, client_secret, refresh_token


def spotify_embed_url_from_uri(uri: Optional[str]) -> Optional[str]:
    if not isinstance(uri, str):
        return None

    value = uri.strip()
    if not value:
        return None

    if value.startswith("https://open.spotify.com/embed/"):
        return value

    if value.startswith("https://open.spotify.com/"):
        suffix = value[len("https://open.spotify.com/"):].strip("/")
        if suffix:
            return f"https://open.spotify.com/embed/{suffix}"
        return None

    if not value.startswith("spotify:"):
        return None

    parts = value.split(":")
    if len(parts) < 3:
        return None

    entity_type = parts[1].strip().lower()
    entity_id = parts[2].strip()
    if entity_type not in {"track", "album", "artist", "playlist", "episode", "show"}:
        return None
    if not entity_id:
        return None

    return f"https://open.spotify.com/embed/{entity_type}/{entity_id}"


def resolve_default_spotify_embed_url() -> Optional[str]:
    return None


def decode_spotify_error(raw_text: str, fallback: str) -> str:
    text = (raw_text or "").strip()
    if not text:
        return fallback

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return fallback

    if not isinstance(payload, dict):
        return fallback

    description = payload.get("error_description")
    if isinstance(description, str) and description.strip():
        return description.strip()

    error = payload.get("error")
    if isinstance(error, dict):
        message = error.get("message")
        status = error.get("status")
        if isinstance(message, str) and message.strip():
            if isinstance(status, int):
                return f"{message.strip()} (status {status})"
            return message.strip()

    if isinstance(error, str) and error.strip():
        return error.strip()

    return fallback


def resolve_spotify_preferred_device_name() -> Optional[str]:
    env_values = load_spotify_env_values()
    return _first_non_empty(env_values.get("VOICEASSISTANT_SPOTIFY_PREFERRED_DEVICE"))


def is_spotify_computer_device(device: dict[str, object]) -> bool:
    device_type = device.get("type")
    return isinstance(device_type, str) and device_type.lower() == "computer"
