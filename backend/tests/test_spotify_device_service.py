import unittest
from unittest.mock import patch

from services import spotify_device_service


class SpotifyDeviceServiceTests(unittest.TestCase):
    @patch("services.spotify_device_service.spotify_api_request")
    def test_ensure_control_device_requires_active_for_non_play(self, mock_request):
        mock_request.return_value = (
            200,
            {
                "devices": [
                    {
                        "id": "abc",
                        "name": "Sam Mac",
                        "type": "Computer",
                        "is_active": False,
                        "is_restricted": False,
                    }
                ]
            },
            None,
        )

        ready, message = spotify_device_service.ensure_spotify_control_device("pause")

        self.assertFalse(ready)
        self.assertEqual(message, "No active Spotify playback device is available.")

    @patch("services.spotify_device_service.resolve_spotify_preferred_device_name")
    @patch("services.spotify_device_service.spotify_api_request")
    def test_ensure_control_device_transfers_for_play(self, mock_request, mock_preferred):
        mock_preferred.return_value = "sam"
        mock_request.side_effect = [
            (
                200,
                {
                    "devices": [
                        {
                            "id": "abc",
                            "name": "Sam Mac",
                            "type": "Computer",
                            "is_active": False,
                            "is_restricted": False,
                        }
                    ]
                },
                None,
            ),
            (204, {}, None),
        ]

        ready, message = spotify_device_service.ensure_spotify_control_device("play")

        self.assertTrue(ready)
        self.assertIsNone(message)
        self.assertEqual(mock_request.call_count, 2)

    @patch("services.spotify_device_service.spotify_api_request")
    @patch("services.spotify_device_service._try_launch_spotify_app_on_mac")
    def test_transfer_to_mac_returns_playback_error(self, mock_launch, mock_request):
        mock_launch.return_value = False
        mock_request.return_value = (500, None, "Unable to read playback")

        status, message, target_name = spotify_device_service.transfer_spotify_to_mac()

        self.assertEqual(status, 500)
        self.assertEqual(message, "Unable to read playback")
        self.assertIsNone(target_name)

    @patch("services.spotify_device_service.resolve_spotify_preferred_device_name")
    @patch("services.spotify_device_service.spotify_api_request")
    @patch("services.spotify_device_service._try_launch_spotify_app_on_mac")
    def test_transfer_to_mac_success(self, mock_launch, mock_request, mock_preferred):
        mock_launch.return_value = False
        mock_preferred.return_value = None
        mock_request.side_effect = [
            (200, {"is_playing": False}, None),
            (
                200,
                {
                    "devices": [
                        {
                            "id": "abc",
                            "name": "Sam Mac",
                            "type": "Computer",
                            "is_active": True,
                            "is_restricted": False,
                        }
                    ]
                },
                None,
            ),
            (204, {}, None),
        ]

        status, message, target_name = spotify_device_service.transfer_spotify_to_mac()

        self.assertEqual(status, 204)
        self.assertIsNone(message)
        self.assertEqual(target_name, "Sam Mac")


if __name__ == "__main__":
    unittest.main()
