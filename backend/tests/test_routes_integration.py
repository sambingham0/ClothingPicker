from urllib.error import URLError
from unittest import TestCase
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.assistant_routes import router as assistant_router
from routes.clothing_routes import router as clothing_router
from routes.widget_routes import router as widget_router


class RouteIntegrationTests(TestCase):
    def _client_for_router(self, router) -> TestClient:
        app = FastAPI()
        app.include_router(router)
        return TestClient(app)

    def test_assistant_logs_clamps_limit(self):
        client = self._client_for_router(assistant_router)

        with patch(
            "routes.assistant_routes.proxy_assistant_json",
            new=AsyncMock(return_value={"logs": []}),
        ) as mock_proxy:
            response = client.get("/assistant/logs?limit=9999")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"logs": []})
        mock_proxy.assert_awaited_once_with("/api/logs?limit=500")

    def test_assistant_status_maps_proxy_errors_to_502(self):
        client = self._client_for_router(assistant_router)

        with patch(
            "routes.assistant_routes.proxy_assistant_json",
            new=AsyncMock(side_effect=URLError("offline")),
        ):
            response = client.get("/assistant/status")

        self.assertEqual(response.status_code, 502)
        self.assertIn("Assistant status unavailable", response.json().get("detail", ""))

    def test_weather_widget_delegates_to_weather_service(self):
        client = self._client_for_router(widget_router)

        with patch(
            "routes.widget_routes.fetch_current_weather",
            return_value={"temperature_c": 22, "forecast": {"likely_to_rain_later_today": False}},
        ) as mock_weather:
            response = client.get("/widgets/weather?latitude=40.71&longitude=-74.00")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(
            payload.get("weather"),
            {"temperature_c": 22, "forecast": {"likely_to_rain_later_today": False}},
        )
        self.assertIn("requestedAtUtc", payload)
        mock_weather.assert_called_once_with(40.71, -74.0)

    def test_spotify_control_returns_service_status_and_payload(self):
        client = self._client_for_router(widget_router)

        with patch(
            "routes.widget_routes.execute_spotify_control_action",
            return_value=({"ok": False, "action": "pause", "message": "No active device."}, 409),
        ) as mock_execute:
            response = client.post("/widgets/spotify/control", json={"action": "pause"})

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.json(),
            {"ok": False, "action": "pause", "message": "No active device."},
        )
        mock_execute.assert_called_once_with("pause")

    def test_spotify_control_forwards_volume_percent(self):
        client = self._client_for_router(widget_router)

        with patch(
            "routes.widget_routes.execute_spotify_control_action",
            return_value=({"ok": True, "action": "volume_set", "volumePercent": 73}, 200),
        ) as mock_execute:
            response = client.post("/widgets/spotify/control", json={"action": "volume_set", "volumePercent": 73})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"ok": True, "action": "volume_set", "volumePercent": 73},
        )
        mock_execute.assert_called_once_with("volume_set", 73)

    def test_upload_route_parses_multipart_fields(self):
        client = self._client_for_router(clothing_router)

        form_data = {
            "type": "top",
            "majorColors": ["blue", "white"],
            "minorColors": ["gray"],
            "season": ["spring", "summer"],
            "occasion": ["casual"],
            "fit": "regular",
            "sleeveLength": "short",
        }
        file_data = {"file": ("shirt.jpg", b"fake-image", "image/jpeg")}

        with patch(
            "routes.clothing_routes.create_clothing_item",
            return_value={"id": 42},
        ) as mock_create:
            response = client.post("/upload", data=form_data, files=file_data)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"id": 42})

        call_kwargs = mock_create.call_args.kwargs
        self.assertEqual(call_kwargs.get("clothing_type"), "top")
        self.assertEqual(call_kwargs.get("major_colors"), ["blue", "white"])
        self.assertEqual(call_kwargs.get("minor_colors"), ["gray"])
        self.assertEqual(call_kwargs.get("seasons"), ["spring", "summer"])
        self.assertEqual(call_kwargs.get("occasions"), ["casual"])
        self.assertEqual(call_kwargs.get("fit"), "regular")
        self.assertEqual(call_kwargs.get("sleeve_length"), "short")

    def test_generate_outfit_route_delegates_query_parameters(self):
        client = self._client_for_router(clothing_router)

        with patch(
            "routes.clothing_routes.generate_outfit",
            return_value={"outfits": []},
        ) as mock_generate:
            response = client.get("/generate-outfit?selected_top=7&top_n=5&latitude=33.8&longitude=-118.4")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"outfits": []})
        mock_generate.assert_called_once_with(
            selected_outer=None,
            selected_top=7,
            selected_bottom=None,
            top_n=5,
            latitude=33.8,
            longitude=-118.4,
        )
