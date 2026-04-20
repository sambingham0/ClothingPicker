import unittest

from scoring.weather_score import (
    get_layering_guidance,
    resolve_weather_band,
    _summarize_forecast_from_payload,
)


class WeatherScoreTests(unittest.TestCase):
    def test_resolve_weather_band_keeps_mild_in_calm_conditions(self):
        weather = {
            "temperature_c": 11.0,
            "wind_kph": 6.0,
            "wind_gust_kph": 9.0,
            "is_rainy": False,
            "forecast": {
                "likely_to_rain_later_today": False,
                "possible_rain_later_today": False,
                "likely_to_drizzle_later_today": False,
            },
        }

        self.assertEqual(resolve_weather_band(weather), "mild")

    def test_resolve_weather_band_downgrades_mild_when_windy_and_rain_possible(self):
        weather = {
            "temperature_c": 10.6,
            "wind_kph": 31.0,
            "wind_gust_kph": 50.0,
            "is_rainy": False,
            "forecast": {
                "likely_to_rain_later_today": False,
                "possible_rain_later_today": True,
                "likely_to_drizzle_later_today": False,
                "max_rain_chance_percent_later_today": 33,
                "rain_chance_percent_next_2_hours": 27,
            },
        }

        self.assertEqual(resolve_weather_band(weather), "cold")

    def test_resolve_weather_band_downgrades_warm_when_windy_and_rainy(self):
        weather = {
            "temperature_c": 23.0,
            "wind_kph": 36.0,
            "wind_gust_kph": 44.0,
            "is_rainy": True,
            "forecast": {
                "likely_to_rain_later_today": True,
                "possible_rain_later_today": False,
                "likely_to_drizzle_later_today": False,
            },
        }

        self.assertEqual(resolve_weather_band(weather), "mild")

    def test_summarize_forecast_detects_rain_wind_and_storm_signals(self):
        payload = {
            "current": {
                "time": "2026-04-15T12:00",
            },
            "hourly": {
                "time": [
                    "2026-04-15T12:00",
                    "2026-04-15T15:00",
                    "2026-04-15T19:00",
                    "2026-04-15T21:00",
                    "2026-04-16T01:00",
                ],
                "precipitation": [0.0, 0.4, 0.0, 1.2, 0.0],
                "weather_code": [1, 51, 3, 95, 1],
                "wind_speed_10m": [5.0, 12.0, 16.0, 20.0, 4.0],
                "wind_gusts_10m": [8.0, 22.0, 26.0, 34.0, 6.0],
            },
        }

        summary = _summarize_forecast_from_payload(payload)

        self.assertTrue(summary["likely_to_rain_later_today"])
        self.assertFalse(summary["possible_rain_later_today"])
        self.assertTrue(summary["likely_to_drizzle_later_today"])
        self.assertTrue(summary["likely_to_be_windy_later_today"])
        self.assertTrue(summary["likely_to_be_very_windy_later_today"])
        self.assertTrue(summary["likely_thunderstorms_tonight"])
        self.assertFalse(summary["likely_to_snow_later_today"])
        self.assertEqual(summary["max_rain_chance_percent_later_today"], 0)
        self.assertEqual(summary["rain_chance_percent_next_2_hours"], 0)
        self.assertEqual(summary["peak_wind_kph_later_today"], 34.0)

    def test_summarize_forecast_tracks_possible_rain_from_probability(self):
        payload = {
            "current": {
                "time": "2026-04-15T10:00",
            },
            "hourly": {
                "time": [
                    "2026-04-15T10:00",
                    "2026-04-15T11:00",
                    "2026-04-15T13:00",
                ],
                "precipitation": [0.0, 0.0, 0.0],
                "precipitation_probability": [0.0, 45.0, 35.0],
                "weather_code": [3, 3, 3],
                "wind_speed_10m": [5.0, 6.0, 7.0],
                "wind_gusts_10m": [7.0, 9.0, 10.0],
            },
        }

        summary = _summarize_forecast_from_payload(payload)

        self.assertFalse(summary["likely_to_rain_later_today"])
        self.assertTrue(summary["possible_rain_later_today"])
        self.assertEqual(summary["max_rain_chance_percent_later_today"], 45)
        self.assertEqual(summary["rain_chance_percent_next_2_hours"], 45)

    def test_summarize_forecast_detects_snow_signal(self):
        payload = {
            "current": {
                "time": "2026-12-02T10:00",
            },
            "hourly": {
                "time": [
                    "2026-12-02T10:00",
                    "2026-12-02T13:00",
                    "2026-12-02T19:00",
                ],
                "precipitation": [0.0, 0.6, 0.0],
                "weather_code": [3, 71, 3],
                "wind_speed_10m": [4.0, 9.0, 6.0],
                "wind_gusts_10m": [6.0, 14.0, 8.0],
            },
        }

        summary = _summarize_forecast_from_payload(payload)

        self.assertTrue(summary["likely_to_snow_later_today"])

    def test_summarize_forecast_returns_defaults_without_current_time(self):
        summary = _summarize_forecast_from_payload({})

        self.assertFalse(summary["likely_to_rain_later_today"])
        self.assertFalse(summary["possible_rain_later_today"])
        self.assertFalse(summary["likely_to_drizzle_later_today"])
        self.assertFalse(summary["likely_to_be_windy_later_today"])
        self.assertFalse(summary["likely_to_be_very_windy_later_today"])
        self.assertFalse(summary["likely_thunderstorms_tonight"])
        self.assertFalse(summary["likely_to_snow_later_today"])
        self.assertEqual(summary["max_rain_chance_percent_later_today"], 0)
        self.assertEqual(summary["rain_chance_percent_next_2_hours"], 0)
        self.assertEqual(summary["peak_wind_kph_later_today"], 0.0)

    def test_layering_guidance_increases_when_rain_or_wind_is_likely_later(self):
        base_weather = {
            "temperature_c": 16,
            "is_rainy": False,
            "wind_kph": 4,
            "wind_gust_kph": 6,
            "forecast": {
                "likely_to_rain_later_today": False,
                "likely_to_snow_later_today": False,
                "likely_to_be_windy_later_today": False,
            },
        }
        forecast_weather = {
            "temperature_c": 16,
            "is_rainy": False,
            "wind_kph": 4,
            "wind_gust_kph": 6,
            "forecast": {
                "likely_to_rain_later_today": True,
                "possible_rain_later_today": False,
                "likely_to_snow_later_today": False,
                "likely_to_be_windy_later_today": True,
            },
        }

        base_guidance = get_layering_guidance(base_weather)
        forecast_guidance = get_layering_guidance(forecast_weather)

        self.assertGreater(forecast_guidance["outer_probability"], base_guidance["outer_probability"])
        self.assertGreater(
            forecast_guidance["layer_top_without_outer_probability"],
            base_guidance["layer_top_without_outer_probability"],
        )

    def test_layering_guidance_increases_for_possible_rain_probability_signal(self):
        base_weather = {
            "temperature_c": 19,
            "is_rainy": False,
            "wind_kph": 5,
            "wind_gust_kph": 8,
            "forecast": {
                "likely_to_rain_later_today": False,
                "possible_rain_later_today": False,
                "likely_to_snow_later_today": False,
                "likely_to_be_windy_later_today": False,
            },
        }
        chance_weather = {
            "temperature_c": 19,
            "is_rainy": False,
            "wind_kph": 5,
            "wind_gust_kph": 8,
            "forecast": {
                "likely_to_rain_later_today": False,
                "possible_rain_later_today": True,
                "likely_to_snow_later_today": False,
                "likely_to_be_windy_later_today": False,
            },
        }

        base_guidance = get_layering_guidance(base_weather)
        chance_guidance = get_layering_guidance(chance_weather)

        self.assertGreater(chance_guidance["outer_probability"], base_guidance["outer_probability"])
        self.assertGreater(
            chance_guidance["layer_top_without_outer_probability"],
            base_guidance["layer_top_without_outer_probability"],
        )


if __name__ == "__main__":
    unittest.main()
