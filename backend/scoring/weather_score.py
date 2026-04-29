import json
import time
from datetime import datetime
from datetime import timezone
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from scoring.utils import to_float

RAINY_WEATHER_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}
DRIZZLE_WEATHER_CODES = {51, 53, 55, 56, 57}
THUNDERSTORM_WEATHER_CODES = {95, 96, 99}
SNOW_WEATHER_CODES = {71, 73, 75, 77, 85, 86}
POSSIBLE_RAIN_CHANCE_THRESHOLD_PERCENT = 30
LIKELY_RAIN_CHANCE_THRESHOLD_PERCENT = 60
BAND_ORDER = ("very_cold", "cold", "mild", "warm", "hot")
DEFAULT_LATITUDE = 43.816355
DEFAULT_LONGITUDE = -111.798766
CACHE_EXPIRATION_SECONDS = 300  # 5 minutes

# Global cache variables
_weather_cache = {}  # Keys will be (lat, lon)


def _wind_intensity_kph(weather):
    wind_kph = to_float((weather or {}).get("wind_kph")) or 0.0
    gust_kph = to_float((weather or {}).get("wind_gust_kph")) or 0.0
    return max(wind_kph, gust_kph)


def _shift_band_colder(band, steps=1):
    try:
        index = BAND_ORDER.index(band)
    except ValueError:
        return band

    safe_steps = max(1, int(steps))
    return BAND_ORDER[max(0, index - safe_steps)]

def _temperature_only_band(temperature_c):
    if temperature_c is None:
        return "mild"
    if temperature_c < 0:
        return "very_cold"
    if temperature_c < 8:
        return "cold"
    if temperature_c < 16:
        return "mild"
    if temperature_c < 25:
        return "warm"
    return "hot"


def _has_precipitation_cooling_signal(weather):
    weather = weather or {}
    if bool(weather.get("is_rainy")):
        return True

    forecast = weather.get("forecast") or {}
    if bool(forecast.get("likely_to_rain_later_today")):
        return True
    if bool(forecast.get("likely_to_drizzle_later_today")):
        return True

    if bool(forecast.get("possible_rain_later_today")):
        rain_soon = to_float(forecast.get("rain_chance_percent_next_2_hours")) or 0.0
        rain_later = to_float(forecast.get("max_rain_chance_percent_later_today")) or 0.0
        return max(rain_soon, rain_later) >= POSSIBLE_RAIN_CHANCE_THRESHOLD_PERCENT

    return False


def _default_forecast_summary():
    return {
        "likely_to_rain_later_today": False,
        "possible_rain_later_today": False,
        "likely_to_drizzle_later_today": False,
        "likely_to_snow_later_today": False,
        "max_rain_chance_percent_later_today": 0,
        "rain_chance_percent_next_2_hours": 0,
        "likely_to_be_windy_later_today": False,
        "likely_to_be_very_windy_later_today": False,
        "peak_wind_kph_later_today": 0.0,
        "likely_thunderstorms_tonight": False,
    }


def _parse_iso_datetime(value):
    if not value:
        return None

    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _summarize_forecast_from_payload(payload):
    summary = _default_forecast_summary()
    payload = payload or {}
    current = payload.get("current") or {}
    current_dt = _parse_iso_datetime(current.get("time"))
    if current_dt is None:
        return summary

    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    precipitation_values = hourly.get("precipitation") or []
    precipitation_probability_values = hourly.get("precipitation_probability") or []
    weather_codes = hourly.get("weather_code") or []
    wind_values = hourly.get("wind_speed_10m") or []
    gust_values = hourly.get("wind_gusts_10m") or []

    upper_bound = min(
        len(times),
        len(precipitation_values),
        len(weather_codes),
        len(wind_values),
        len(gust_values),
    )
    if upper_bound == 0:
        return summary

    forecast_rows = []
    for index in range(upper_bound):
        row_time = _parse_iso_datetime(times[index])
        if row_time is None:
            continue
        if row_time <= current_dt:
            continue
        if row_time.date() != current_dt.date():
            continue

        try:
            weather_code = int(weather_codes[index])
        except (TypeError, ValueError):
            weather_code = None

        wind_kph = to_float(wind_values[index]) or 0.0
        gust_kph = to_float(gust_values[index]) or 0.0
        precipitation_probability_pct = 0.0
        if index < len(precipitation_probability_values):
            precipitation_probability_pct = to_float(precipitation_probability_values[index]) or 0.0
        precipitation_probability_pct = max(0.0, min(100.0, precipitation_probability_pct))

        forecast_rows.append(
            {
                "time": row_time,
                "hours_ahead": (row_time - current_dt).total_seconds() / 3600.0,
                "weather_code": weather_code,
                "precipitation_mm": to_float(precipitation_values[index]) or 0.0,
                "precipitation_probability_pct": precipitation_probability_pct,
                "wind_kph": max(wind_kph, gust_kph),
            }
        )

    if not forecast_rows:
        return summary

    summary["max_rain_chance_percent_later_today"] = int(
        round(max(row["precipitation_probability_pct"] for row in forecast_rows))
    )
    summary["rain_chance_percent_next_2_hours"] = int(
        round(
            max(
                (
                    row["precipitation_probability_pct"]
                    for row in forecast_rows
                    if row["hours_ahead"] <= 2.0
                ),
                default=0.0,
            )
        )
    )

    summary["likely_to_rain_later_today"] = any(
        (row["weather_code"] in RAINY_WEATHER_CODES)
        or row["precipitation_mm"] >= 0.2
        or row["precipitation_probability_pct"] >= LIKELY_RAIN_CHANCE_THRESHOLD_PERCENT
        for row in forecast_rows
    )
    summary["possible_rain_later_today"] = (
        not summary["likely_to_rain_later_today"]
        and summary["max_rain_chance_percent_later_today"] >= POSSIBLE_RAIN_CHANCE_THRESHOLD_PERCENT
    )
    summary["likely_to_drizzle_later_today"] = any(
        row["weather_code"] in DRIZZLE_WEATHER_CODES for row in forecast_rows
    )
    summary["likely_to_snow_later_today"] = any(
        row["weather_code"] in SNOW_WEATHER_CODES for row in forecast_rows
    )
    summary["peak_wind_kph_later_today"] = max(row["wind_kph"] for row in forecast_rows)
    summary["likely_to_be_windy_later_today"] = summary["peak_wind_kph_later_today"] >= 20
    summary["likely_to_be_very_windy_later_today"] = summary["peak_wind_kph_later_today"] >= 30

    tonight_rows = [row for row in forecast_rows if row["time"].hour >= 18]
    summary["likely_thunderstorms_tonight"] = any(
        row["weather_code"] in THUNDERSTORM_WEATHER_CODES for row in tonight_rows
    )
    return summary


def resolve_weather_band(weather):
    temperature_c = to_float((weather or {}).get("temperature_c"))
    base_band = _temperature_only_band(temperature_c)
    if temperature_c is None:
        return base_band

    wind_kph = _wind_intensity_kph(weather)
    has_precipitation_cooling = _has_precipitation_cooling_signal(weather)

    exposure_points = 0
    if wind_kph >= 28:
        exposure_points += 1
    if wind_kph >= 40:
        exposure_points += 1
    if has_precipitation_cooling:
        exposure_points += 1

    if base_band == "mild":
        if (temperature_c <= 12 and exposure_points >= 1) or (temperature_c <= 16 and exposure_points >= 2):
            return _shift_band_colder(base_band)

    if base_band == "warm":
        if temperature_c <= 24 and exposure_points >= 2:
            return _shift_band_colder(base_band)

    if base_band == "cold":
        if temperature_c <= 2 and exposure_points >= 2:
            return _shift_band_colder(base_band)

    return base_band


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
            "current": "temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code,is_day",
            "hourly": "precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m",
            "timezone": "auto",
            "forecast_days": 2,
        }
    )
    url = f"https://api.open-meteo.com/v1/forecast?{params}"

    try:
        with urlopen(url, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))

        current = payload.get("current", {})
        fetched_at_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        weather_code = int(current.get("weather_code", -1))
        precipitation_mm = to_float(current.get("precipitation")) or 0.0
        wind_kph = to_float(current.get("wind_speed_10m")) or 0.0
        wind_gust_kph = to_float(current.get("wind_gusts_10m")) or 0.0
        is_day_value = to_float(current.get("is_day"))
        forecast_summary = _summarize_forecast_from_payload(payload)

        weather = {
            "temperature_c": to_float(current.get("temperature_2m")),
            "precipitation_mm": precipitation_mm,
            "wind_kph": wind_kph,
            "wind_gust_kph": wind_gust_kph,
            "weather_code": weather_code,
            "is_day": None if is_day_value is None else is_day_value >= 0.5,
            "is_rainy": weather_code in RAINY_WEATHER_CODES or precipitation_mm > 0.1,
            "is_windy": max(wind_kph, wind_gust_kph) >= 16,
            "forecast": forecast_summary,
            "source": "open-meteo",
            "fetched_at_utc": fetched_at_utc,
            "observed_at": current.get("time"),
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
            "is_day": None,
            "is_rainy": False,
            "is_windy": False,
            "forecast": _default_forecast_summary(),
            "source": "fallback",
            "fetched_at_utc": None,
            "observed_at": None,
        }
        fallback["band"] = resolve_weather_band(fallback)
        return fallback


def get_layering_guidance(weather):
    band = resolve_weather_band(weather)
    is_rainy = bool((weather or {}).get("is_rainy"))
    is_windy = _wind_intensity_kph(weather) >= 15
    forecast = ((weather or {}).get("forecast") or {})
    rain_later = bool(forecast.get("likely_to_rain_later_today"))
    possible_rain_later = bool(forecast.get("possible_rain_later_today"))
    snow_later = bool(forecast.get("likely_to_snow_later_today"))
    windy_later = bool(forecast.get("likely_to_be_windy_later_today"))

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
    if weather_bonus == 0.0:
        if rain_later:
            weather_bonus += 0.08
        elif possible_rain_later:
            weather_bonus += 0.04
        if snow_later:
            weather_bonus += 0.10
        if windy_later:
            weather_bonus += 0.06
    outer_probability = min(0.95, outer_probability_by_band.get(band, 0.20) + weather_bonus)
    layer_top_without_outer_probability = min(
        0.60,
        layer_top_probability_by_band.get(band, 0.20) + weather_bonus,
    )
    return {
        "outer_probability": outer_probability,
        "layer_top_without_outer_probability": layer_top_without_outer_probability,
    }
