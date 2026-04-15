import base64
import json
import time
from threading import Lock
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from services.spotify_helpers import decode_spotify_error, resolve_spotify_credentials

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_PLAYER_URL = "https://api.spotify.com/v1/me/player"
SPOTIFY_TOKEN_REFRESH_BUFFER_SECONDS = 45

_spotify_token_cache = {
    "access_token": None,
    "expires_at": 0.0,
}
_spotify_token_lock = Lock()


def get_spotify_access_token(force_refresh: bool = False) -> tuple[Optional[str], Optional[str]]:
    now = time.time()

    with _spotify_token_lock:
        cached_token = _spotify_token_cache.get("access_token")
        cached_expires_at = float(_spotify_token_cache.get("expires_at") or 0.0)

    if (
        isinstance(cached_token, str)
        and cached_token
        and not force_refresh
        and now < (cached_expires_at - SPOTIFY_TOKEN_REFRESH_BUFFER_SECONDS)
    ):
        return cached_token, None

    client_id, client_secret, refresh_token = resolve_spotify_credentials()
    if not client_id or not client_secret or not refresh_token:
        return None, "Spotify credentials are not configured for the dashboard widget."

    auth_pair = f"{client_id}:{client_secret}".encode("utf-8")
    auth_header = base64.b64encode(auth_pair).decode("ascii")
    request_body = urlencode(
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }
    ).encode("utf-8")

    request = Request(
        SPOTIFY_TOKEN_URL,
        data=request_body,
        method="POST",
        headers={
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=5) as response:
            body = response.read().decode("utf-8")
            payload = json.loads(body) if body.strip() else {}
    except HTTPError as ex:
        body = ex.read().decode("utf-8", errors="replace")
        message = decode_spotify_error(
            body,
            fallback=f"Spotify token refresh failed ({ex.code}).",
        )
        return None, message
    except (URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError):
        return None, "Spotify token refresh failed."

    token = payload.get("access_token") if isinstance(payload, dict) else None
    if not isinstance(token, str) or not token.strip():
        return None, "Spotify token response did not include an access token."

    expires_in_raw = payload.get("expires_in") if isinstance(payload, dict) else 3600
    try:
        expires_in = max(60, int(expires_in_raw))
    except (TypeError, ValueError):
        expires_in = 3600

    with _spotify_token_lock:
        _spotify_token_cache["access_token"] = token
        _spotify_token_cache["expires_at"] = time.time() + expires_in

    return token, None


def spotify_api_request(
    method: str,
    url: str,
    body: Optional[dict[str, object]] = None,
) -> tuple[int, Optional[dict[str, object]], Optional[str]]:
    token, token_error = get_spotify_access_token()
    if not token:
        return 401, None, token_error or "Spotify credentials are unavailable."

    for attempt in range(2):
        request_body = None
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }

        if body is not None:
            request_body = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = Request(url, data=request_body, method=method, headers=headers)

        try:
            with urlopen(request, timeout=5) as response:
                status_code = getattr(response, "status", response.getcode())
                raw_body = response.read().decode("utf-8")
        except HTTPError as ex:
            raw_body = ex.read().decode("utf-8", errors="replace")
            if ex.code == 401 and attempt == 0:
                token, token_error = get_spotify_access_token(force_refresh=True)
                if token:
                    continue
                return 401, None, token_error or "Spotify authorization failed."

            message = decode_spotify_error(
                raw_body,
                fallback=f"Spotify request failed ({ex.code}).",
            )
            return ex.code, None, message
        except (URLError, TimeoutError, OSError, ValueError):
            return 0, None, "Spotify request failed."

        if not raw_body.strip():
            return status_code, {}, None

        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            return status_code, {}, None

        return status_code, payload if isinstance(payload, dict) else {}, None

    return 0, None, "Spotify request failed."
