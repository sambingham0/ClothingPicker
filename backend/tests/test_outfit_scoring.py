import unittest

from scoring.color_score import score_colors
from scoring.weather_evaluation import score_weather


class OutfitScoringTests(unittest.TestCase):
    def test_warm_weather_prefers_no_extra_layer_when_dry_and_calm(self):
        weather = {
            "temperature_c": 26,
            "is_rainy": False,
            "wind_kph": 6,
            "wind_gust_kph": 8,
        }

        with_outer = {
            "outer": {"seasons": ["winter"]},
            "top": {"sleeve_length": "short_sleeve", "seasons": ["summer"]},
            "bottom": {"bottom_style": "shorts", "seasons": ["summer"]},
        }
        without_outer = {
            "outer": None,
            "top": {"sleeve_length": "short_sleeve", "seasons": ["summer"]},
            "bottom": {"bottom_style": "shorts", "seasons": ["summer"]},
        }

        score_with_outer, _ = score_weather(with_outer, weather)
        score_without_outer, _ = score_weather(without_outer, weather)

        self.assertGreater(score_without_outer, score_with_outer)

    def test_cold_rainy_weather_rewards_coverage(self):
        weather = {
            "temperature_c": 4,
            "is_rainy": True,
            "wind_kph": 22,
            "wind_gust_kph": 31,
        }

        protected_outfit = {
            "outer": {"seasons": ["fall", "winter"]},
            "top": {"sleeve_length": "long_sleeve", "seasons": ["winter"]},
            "bottom": {"bottom_style": "pants", "seasons": ["winter"]},
        }
        exposed_outfit = {
            "outer": None,
            "top": {"sleeve_length": "short_sleeve", "seasons": ["summer"]},
            "bottom": {"bottom_style": "shorts", "seasons": ["summer"]},
        }

        score_protected, _ = score_weather(protected_outfit, weather)
        score_exposed, _ = score_weather(exposed_outfit, weather)

        self.assertGreater(score_protected, score_exposed)

    def test_forecast_rain_later_prefers_having_a_layer(self):
        weather = {
            "temperature_c": 16,
            "is_rainy": False,
            "wind_kph": 5,
            "wind_gust_kph": 8,
            "forecast": {
                "likely_to_rain_later_today": True,
                "likely_to_drizzle_later_today": True,
                "likely_to_snow_later_today": False,
                "likely_to_be_windy_later_today": False,
                "likely_to_be_very_windy_later_today": False,
                "peak_wind_kph_later_today": 18.0,
                "likely_thunderstorms_tonight": False,
            },
        }

        with_outer = {
            "outer": {"seasons": ["spring", "fall"]},
            "top": {"sleeve_length": "short_sleeve", "seasons": ["spring"]},
            "bottom": {"bottom_style": "pants", "seasons": ["spring"]},
        }
        without_outer = {
            "outer": None,
            "top": {"sleeve_length": "short_sleeve", "seasons": ["spring"]},
            "bottom": {"bottom_style": "pants", "seasons": ["spring"]},
        }

        score_with_outer, _ = score_weather(with_outer, weather)
        score_without_outer, _ = score_weather(without_outer, weather)

        self.assertGreater(score_with_outer, score_without_outer)

    def test_forecast_snow_later_penalizes_exposed_shorts(self):
        weather = {
            "temperature_c": 6,
            "is_rainy": False,
            "wind_kph": 6,
            "wind_gust_kph": 9,
            "weather_code": 3,
            "forecast": {
                "likely_to_rain_later_today": False,
                "likely_to_drizzle_later_today": False,
                "likely_to_snow_later_today": True,
                "likely_to_be_windy_later_today": False,
                "likely_to_be_very_windy_later_today": False,
                "peak_wind_kph_later_today": 14.0,
                "likely_thunderstorms_tonight": False,
            },
        }

        protected = {
            "outer": {"seasons": ["fall", "winter"]},
            "top": {"sleeve_length": "long_sleeve", "seasons": ["winter"]},
            "bottom": {"bottom_style": "pants", "seasons": ["winter"]},
        }
        exposed = {
            "outer": None,
            "top": {"sleeve_length": "short_sleeve", "seasons": ["summer"]},
            "bottom": {"bottom_style": "shorts", "seasons": ["summer"]},
        }

        protected_score, _ = score_weather(protected, weather)
        exposed_score, _ = score_weather(exposed, weather)

        self.assertGreater(protected_score, exposed_score)

    def test_possible_rain_forecast_mentions_chance_bonus_in_reasons(self):
        weather = {
            "temperature_c": 18,
            "is_rainy": False,
            "wind_kph": 5,
            "wind_gust_kph": 8,
            "forecast": {
                "likely_to_rain_later_today": False,
                "possible_rain_later_today": True,
                "max_rain_chance_percent_later_today": 42,
                "rain_chance_percent_next_2_hours": 35,
                "likely_to_drizzle_later_today": False,
                "likely_to_snow_later_today": False,
                "likely_to_be_windy_later_today": False,
                "likely_to_be_very_windy_later_today": False,
                "peak_wind_kph_later_today": 12.0,
                "likely_thunderstorms_tonight": False,
            },
        }

        with_outer = {
            "outer": {"seasons": ["spring", "fall"]},
            "top": {"sleeve_length": "long_sleeve", "seasons": ["spring"]},
            "bottom": {"bottom_style": "pants", "seasons": ["spring"]},
        }
        without_outer = {
            "outer": None,
            "top": {"sleeve_length": "long_sleeve", "seasons": ["spring"]},
            "bottom": {"bottom_style": "pants", "seasons": ["spring"]},
        }

        with_outer_score, with_outer_reasons = score_weather(with_outer, weather)
        without_outer_score, without_outer_reasons = score_weather(without_outer, weather)

        self.assertGreater(with_outer_score, without_outer_score)
        self.assertTrue(any("chance-of-rain bonus applied" in reason for reason in with_outer_reasons))
        self.assertTrue(any("no chance-of-rain bonus" in reason for reason in without_outer_reasons))

    def test_color_normalization_supports_upload_palette(self):
        outfit = {
            "outer": None,
            "top": {"major_colors": ["khaki"], "minor_colors": []},
            "bottom": {"major_colors": ["cream"], "minor_colors": []},
        }

        score, _ = score_colors(outfit)

        self.assertGreater(score, 0)

    def test_red_green_top_bottom_is_penalized_as_clash(self):
        outfit = {
            "outer": None,
            "top": {"major_colors": ["red"], "minor_colors": []},
            "bottom": {"major_colors": ["green"], "minor_colors": []},
        }

        score, _ = score_colors(outfit)

        self.assertLessEqual(score, -4)

    def test_blue_pink_is_not_penalized(self):
        outfit = {
            "outer": None,
            "top": {"major_colors": ["blue"], "minor_colors": []},
            "bottom": {"major_colors": ["pink"], "minor_colors": []},
        }

        score, _ = score_colors(outfit)

        self.assertGreaterEqual(score, 0)

    def test_red_and_denim_is_not_penalized(self):
        outfit = {
            "outer": None,
            "top": {"major_colors": ["red"], "minor_colors": []},
            "bottom": {"major_colors": ["denim"], "minor_colors": []},
        }

        score, _ = score_colors(outfit)

        self.assertGreaterEqual(score, 0)

    def test_outerwear_color_clash_is_considered(self):
        outfit = {
            "outer": {"major_colors": ["green"], "minor_colors": []},
            "top": {"major_colors": ["red"], "minor_colors": []},
            "bottom": {"major_colors": ["black"], "minor_colors": []},
        }

        score, reasons = score_colors(outfit)

        self.assertLessEqual(score, 0)
        self.assertTrue(any("likely to clash" in reason for reason in reasons))

    def test_all_neutral_palette_not_penalized_as_strong_single_family(self):
        outfit = {
            "outer": {"major_colors": ["navy"], "minor_colors": []},
            "top": {"major_colors": ["white"], "minor_colors": []},
            "bottom": {"major_colors": ["tan"], "minor_colors": []},
        }

        score, reasons = score_colors(outfit)

        self.assertGreaterEqual(score, 2)
        self.assertFalse(any("one strong family" in reason for reason in reasons))

    def test_all_three_same_major_colors_gets_penalty(self):
        outfit = {
            "outer": {"major_colors": ["white"], "minor_colors": []},
            "top": {"major_colors": ["white"], "minor_colors": []},
            "bottom": {"major_colors": ["white"], "minor_colors": []},
        }

        score, reasons = score_colors(outfit)

        self.assertLessEqual(score, 3)
        self.assertTrue(any("All three major colors are the same" in reason for reason in reasons))

    def test_sandwich_palette_gets_small_bonus(self):
        sandwich = {
            "outer": {"major_colors": ["navy"], "minor_colors": []},
            "top": {"major_colors": ["white"], "minor_colors": []},
            "bottom": {"major_colors": ["navy"], "minor_colors": []},
        }
        all_same = {
            "outer": {"major_colors": ["navy"], "minor_colors": []},
            "top": {"major_colors": ["navy"], "minor_colors": []},
            "bottom": {"major_colors": ["navy"], "minor_colors": []},
        }

        sandwich_score, sandwich_reasons = score_colors(sandwich)
        all_same_score, _ = score_colors(all_same)

        self.assertGreater(sandwich_score, all_same_score)
        self.assertTrue(any("Sandwich palette" in reason for reason in sandwich_reasons))


if __name__ == "__main__":
    unittest.main()
