import unittest
from unittest.mock import patch

from services.assistant_proxy_service import fetch_assistant_json


class _DummyResponse:
    def __init__(self, payload: bytes):
        self._payload = payload

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False


class AssistantProxyServiceTests(unittest.TestCase):
    @patch("services.assistant_proxy_service.urlopen")
    def test_fetch_assistant_json_parses_response(self, mock_urlopen):
        mock_urlopen.return_value = _DummyResponse(b'{"ok": true, "status": "healthy"}')

        payload = fetch_assistant_json("/api/health")

        self.assertEqual(payload["ok"], True)
        self.assertEqual(payload["status"], "healthy")

    @patch("services.assistant_proxy_service.urlopen")
    def test_fetch_assistant_json_handles_empty_body(self, mock_urlopen):
        mock_urlopen.return_value = _DummyResponse(b"   ")

        payload = fetch_assistant_json("/api/status")

        self.assertEqual(payload, {})


if __name__ == "__main__":
    unittest.main()
