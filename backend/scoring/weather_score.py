import json
import time
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from scoring.utils import to_float

RAINY_WEATHER_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}
DEFAULT_LATITUDE = 43.816355
DEFAULT_LONGITUDE = -111.798766
CACHE_EXPIRATION_SECONDS = 300  # 5 minutes

# Global cache variables
_weather_cache = {}  # Keys will be (lat, lon)


def _wind_intensity_kph(weather):
    wind_kph = to_float((weather or {}).get("wind_kph")) or 0.0
    gust_kph = to_float((weather or {}).get("wind_gust_kph")) or 0.0
    return max(wind_kph, gust_kph)


def resolve_weather_band(weather):
    temperature_c = to_float((weather or {}).get("temperature_c"))
    if temperature_c is None:
        return "mild"
    if temperature_c < 0:
        return "very_cold"
    if temperature_c < 10:
        return "cold"
    if temperature_c < 22:
        return "mild"
    if temperature_c < 28:
        return "warm"
    return "hot"


def fetch_current_weather(latitude=None, longitude=None):
    lat = to_float(latitude)
    lon = to_float(longitude)
    if lat is None:
        lat = DEFAULT_LATITUDE
    if lon is None:
        lon = DEFAULT_LONGITUDE

    # Round coordinates to 3 decimal places (~100m) to make cache-keying easier
    cache_key = (round(lat, 3), round(lon, 3))
    now = time.time()

    if cache_key in _weather_cache:
        cached_data, timestamp = _weather_cache[cache_key]
        if now - timestamp < CACHE_EXPIRATION_SECONDS:
            return cached_data

    params = urlencode(
        {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code",
        }
    )
    url = f"https://api.open-meteo.com/v1/forecast?{params}"

    try:
        with urlopen(url, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))

        current = payload.get("current", {})
        weather_code = int(current.get("weather_code", -1))
        precipitation_mm = to_float(current.get("precipitation")) or 0.0
        wind_kph = to_float(current.get("wind_speed_10m")) or 0.0
        wind_gust_kph = to_float(current.get("wind_gusts_10m")) or 0.0

        weather = {
            "temperature_c": to_float(current.get("temperature_2m")),
            "precipitation_mm": precipitation_mm,
            "wind_kph": wind_kph,
            "wind_gust_kph": wind_gust_kph,
            "weather_code": weather_code,
            "is_rainy": weather_code in RAINY_WEATHER_CODES or precipitation_mm > 0.1,
            "is_windy": max(wind_kph, wind_gust_kph) >= 16,
            "source": "open-meteo",
        }
        weather["band"] = resolve_weather_band(weather)
        
        # Save to cache
        _weather_cache[cache_key] = (weather, now)
        return weather
    except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
        fallback = {
            "temperature_c": None,
            "precipitation_mm": 0.0,
            "wind_kph": 0.0,
            "wind_gust_kph": 0.0,
            "weather_code": None,
            "is_rainy": False,
            "is_windy": False,
            "source": "fallback",
        }
        fallback["band"] = resolve_weather_band(fallback)
        return fallback


def get_layering_guidance(weather):
    band = resolve_weather_band(weather)
    is_rainy = bool((weather or {}).get("is_rainy"))
    is_windy = _wind_intensity_kph(weather) >= 15

    outer_probability_by_band = {
        "hot": 0.05,
        "warm": 0.10,
        "mild": 0.20,
        "cold": 0.60,
        "very_cold": 0.85,
    }
    layer_top_probability_by_band = {
        "hot": 0.05,
        "warm": 0.10,
        "mild": 0.20,
        "cold": 0.35,
        "very_cold": 0.45,
    }

    weather_bonus = 0.15 if is_rainy or is_windy else 0.0
    outer_probability = min(0.95, outer_probability_by_band.get(band, 0.20) + weather_bonus)
    layer_top_without_outer_probability = min(
        0.60,
        layer_top_probability_by_band.get(band, 0.20) + weather_bonus,
    )
    return {
        "outer_probability": outer_probability,
        "layer_top_without_outer_probability": layer_top_without_outer_probability,
    }
