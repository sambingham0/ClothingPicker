import io
import json
import unittest
from typing import Optional
from unittest.mock import patch
from urllib.error import HTTPError

from services import spotify_widget_payload_service


class _DummyResponse:
    def __init__(self, status: int, payload: Optional[dict[str, object]] = None, text: Optional[str] = None):
        self.status = status
        if text is not None:
            self._body = text.encode("utf-8")
        elif payload is not None:
            self._body = json.dumps(payload).encode("utf-8")
        else:
            self._body = b""

    def read(self):
        return self._body

    def getcode(self):
        return self.status

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False


class SpotifyWidgetPayloadServiceTests(unittest.TestCase):
    @patch("services.spotify_widget_payload_service._resolve_default_spotify_embed_url")
    @patch("services.spotify_widget_payload_service._get_spotify_access_token")
    def test_returns_unavailable_when_token_missing(self, mock_token, mock_default_embed):
        mock_token.return_value = (None, "No credentials")
        mock_default_embed.return_value = "https://open.spotify.com/embed/track/fallback"

        payload = spotify_widget_payload_service.fetch_spotify_widget_payload()

        self.assertEqual(payload["available"], False)
        self.assertEqual(payload["message"], "No credentials")
        self.assertEqual(payload["embedUrl"], "https://open.spotify.com/embed/track/fallback")

    @patch("services.spotify_widget_payload_service.urlopen")
    @patch("services.spotify_widget_payload_service._resolve_default_spotify_embed_url")
    @patch("services.spotify_widget_payload_service._get_spotify_access_token")
    def test_handles_204_with_no_active_playback(self, mock_token, mock_default_embed, mock_urlopen):
        mock_token.return_value = ("token", None)
        mock_default_embed.return_value = "https://open.spotify.com/embed/track/fallback"
        mock_urlopen.return_value = _DummyResponse(status=204)

        payload = spotify_widget_payload_service.fetch_spotify_widget_payload()

        self.assertEqual(payload["available"], True)
        self.assertEqual(payload["isPlaying"], False)
        self.assertEqual(payload["message"], "No active Spotify playback.")

    @patch("services.spotify_widget_payload_service.urlopen")
    @patch("services.spotify_widget_payload_service._resolve_default_spotify_embed_url")
    @patch("services.spotify_widget_payload_service._get_spotify_access_token")
    def test_parses_track_and_device_payload(self, mock_token, mock_default_embed, mock_urlopen):
        mock_token.return_value = ("token", None)
        mock_default_embed.return_value = "https://open.spotify.com/embed/track/fallback"
        mock_urlopen.return_value = _DummyResponse(
            status=200,
            payload={
                "is_playing": True,
                "shuffle_state": False,
                "progress_ms": 12345,
                "item": {
                    "name": "Song",
                    "uri": "spotify:track:abc123",
                    "duration_ms": 300000,
                    "artists": [{"name": "Artist"}],
                    "album": {
                        "name": "Album",
                        "images": [{"url": "https://img"}],
                    },
                },
                "device": {
                    "name": "Living Room",
                    "type": "Computer",
                    "is_active": True,
                    "volume_percent": 42,
                },
            },
        )

        payload = spotify_widget_payload_service.fetch_spotify_widget_payload()

        self.assertEqual(payload["available"], True)
        self.assertEqual(payload["isPlaying"], True)
        self.assertEqual(payload["track"]["name"], "Song")
        self.assertEqual(payload["track"]["artist"], "Artist")
        self.assertEqual(payload["device"]["name"], "Living Room")
        self.assertEqual(payload["embedUrl"], "https://open.spotify.com/embed/track/abc123")

    @patch("services.spotify_widget_payload_service.urlopen")
    @patch("services.spotify_widget_payload_service._resolve_default_spotify_embed_url")
    @patch("services.spotify_widget_payload_service._get_spotify_access_token")
    def test_retries_on_401_then_succeeds(self, mock_token, mock_default_embed, mock_urlopen):
        mock_token.side_effect = [("token", None), ("token-refreshed", None)]
        mock_default_embed.return_value = "https://open.spotify.com/embed/track/fallback"

        first_error = HTTPError(
            url="https://api.spotify.com/v1/me/player",
            code=401,
            msg="Unauthorized",
            hdrs=None,
            fp=io.BytesIO(b'{"error": {"status": 401, "message": "expired"}}'),
        )

        mock_urlopen.side_effect = [
            first_error,
            _DummyResponse(status=200, payload={"is_playing": False}),
        ]

        payload = spotify_widget_payload_service.fetch_spotify_widget_payload()

        self.assertEqual(payload["available"], True)
        self.assertEqual(payload["isPlaying"], False)
        self.assertEqual(mock_token.call_count, 2)


if __name__ == "__main__":
    unittest.main()
