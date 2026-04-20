import unittest
from unittest.mock import patch

from services import spotify_control_service


class SpotifyControlServiceTests(unittest.TestCase):
    def test_execute_control_action_rejects_unknown_action(self):
        payload, status_code = spotify_control_service.execute_spotify_control_action("bogus")

        self.assertEqual(status_code, 400)
        self.assertEqual(payload["ok"], False)
        self.assertEqual(payload["message"], "Unsupported Spotify action.")

    @patch("services.spotify_control_service.ensure_spotify_control_device")
    def test_execute_control_action_reports_device_unavailable(self, mock_ensure):
        mock_ensure.return_value = (False, "No active Spotify playback device is available.")

        payload, status_code = spotify_control_service.execute_spotify_control_action("pause")

        self.assertEqual(status_code, 409)
        self.assertEqual(payload["ok"], False)
        self.assertEqual(payload["message"], "No active Spotify playback device is available.")

    @patch("services.spotify_control_service.spotify_api_request")
    @patch("services.spotify_control_service._resolve_spotify_volume_target")
    @patch("services.spotify_control_service.ensure_spotify_control_device")
    def test_execute_control_action_volume_up_success(
        self,
        mock_ensure,
        mock_resolve_volume,
        mock_request,
    ):
        mock_ensure.return_value = (True, None)
        mock_resolve_volume.return_value = (55, None)
        mock_request.return_value = (204, {}, None)

        payload, status_code = spotify_control_service.execute_spotify_control_action("volume_up")

        self.assertEqual(status_code, 200)
        self.assertEqual(payload["ok"], True)
        self.assertEqual(payload["volumePercent"], 55)
        self.assertEqual(payload["message"], "Volume increased to 55%.")

    @patch("services.spotify_control_service.spotify_api_request")
    @patch("services.spotify_control_service.ensure_spotify_control_device")
    def test_execute_control_action_volume_set_success(
        self,
        mock_ensure,
        mock_request,
    ):
        mock_ensure.return_value = (True, None)
        mock_request.return_value = (204, {}, None)

        payload, status_code = spotify_control_service.execute_spotify_control_action("volume_set", 73)

        self.assertEqual(status_code, 200)
        self.assertEqual(payload["ok"], True)
        self.assertEqual(payload["volumePercent"], 73)
        self.assertEqual(payload["message"], "Volume set to 73%.")

    @patch("services.spotify_control_service.transfer_spotify_to_mac")
    def test_execute_control_action_transfer_here_uses_target_name(self, mock_transfer):
        mock_transfer.return_value = (204, None, "Sam Mac")

        payload, status_code = spotify_control_service.execute_spotify_control_action("transfer_here")

        self.assertEqual(status_code, 200)
        self.assertEqual(payload["ok"], True)
        self.assertEqual(payload["transferTarget"], "Sam Mac")
        self.assertEqual(payload["message"], "Playback transferred to Sam Mac.")

    @patch("services.spotify_control_service.spotify_api_request")
    @patch("services.spotify_control_service.ensure_spotify_control_device")
    def test_execute_control_action_maps_upstream_500_to_502(self, mock_ensure, mock_request):
        mock_ensure.return_value = (True, None)
        mock_request.return_value = (500, None, "Spotify exploded")

        payload, status_code = spotify_control_service.execute_spotify_control_action("play")

        self.assertEqual(status_code, 502)
        self.assertEqual(payload["ok"], False)
        self.assertEqual(payload["message"], "Spotify exploded")


if __name__ == "__main__":
    unittest.main()
