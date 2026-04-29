from scoring.utils import list_tokens, normalize_token, to_float
from scoring.weather_score import resolve_weather_band

TARGET_SEASONS = {
    "hot": {"summer"},
    "warm": {"spring", "summer"},
    "mild": {"spring", "fall", "autumn"},
    "cold": {"fall", "autumn", "winter"},
    "very_cold": {"winter"},
}

SEASON_PROFILES = {
    "hot": {
        "preferred": {"summer"},
        "conflicting": {"fall", "autumn", "winter"},
    },
    "warm": {
        "preferred": {"spring", "summer"},
        "conflicting": {"winter"},
    },
    "mild": {
        "preferred": {"spring", "fall", "autumn"},
        "conflicting": {"winter"},
    },
    "cold": {
        "preferred": {"fall", "autumn", "winter"},
        "conflicting": {"spring", "summer"},
    },
    "very_cold": {
        "preferred": {"winter"},
        "conflicting": {"spring", "summer", "fall", "autumn"},
    },
}

SNOW_WEATHER_CODES = {71, 73, 75, 77, 85, 86}


def _wind_intensity_kph(weather):
    wind_kph = to_float((weather or {}).get("wind_kph")) or 0.0
    gust_kph = to_float((weather or {}).get("wind_gust_kph")) or 0.0
    return max(wind_kph, gust_kph)


def _is_currently_snowing(weather):
    weather_code = (weather or {}).get("weather_code")
    try:
        return int(weather_code) in SNOW_WEATHER_CODES
    except (TypeError, ValueError):
        return False


def _season_set(item):
    return set(list_tokens((item or {}).get("seasons")))


def _format_seasons(seasons):
    return ", ".join(sorted(seasons))


def _score_section_seasons(section_name, item, band):
    seasons = _season_set(item)
    if not seasons:
        return 0, []


    profile = SEASON_PROFILES.get(band, {})
    preferred = profile.get("preferred", set())
    conflicting = profile.get("conflicting", set())
    seasons_text = _format_seasons(seasons)

    if seasons & preferred:
        if section_name == "outer" and band in {"cold", "very_cold"}:
            bonus = 2
        else:
            bonus = 1
        return bonus, [f"(+{bonus} pts) {section_name.capitalize()} seasonal match ({seasons_text})."]


    if seasons & conflicting:
        if section_name == "outer":
            penalty = -4 if band in {"hot", "very_cold"} else -3
        else:
            penalty = -3 if band in {"cold", "very_cold"} else -2
        return penalty, [f"({penalty} pts) {section_name.capitalize()} season ({seasons_text}) does not align with {band} weather."]


    return 0, []


def _score_hot_weather(top, bottom, outer):
    score = 0
    reasons = []


    outer_seasons = _season_set(outer)
    if outer:
        if outer_seasons & {"summer", "spring"}:
            score -= 1
            reasons.append("(-1 pt) Hot: a light outer layer is a small compromise, but still okay if it is truly light.")
        elif outer_seasons & {"fall", "autumn", "winter"}:
            score -= 4
            reasons.append("(-4 pts) Hot: this outer layer looks too heavy for hot weather.")
        else:
            score -= 2
            reasons.append("(-2 pts) Hot: an outer layer is usually unnecessary in this heat.")
    else:
        score += 3
        reasons.append("(+3 pts) Hot: keeping it light is best.")


    top_seasons = _season_set(top)
    sleeve = normalize_token((top or {}).get("sleeve_length"))
    if sleeve == "short_sleeve":
        score += 3
        reasons.append("(+3 pts) Hot: short sleeves are perfect.")
        if top_seasons & {"summer"}:
            score += 1
            reasons.append("(+1 pt) Hot: the top is also marked for summer.")
    elif sleeve == "long_sleeve":
        if top_seasons & {"summer", "spring"}:
            score -= 1
            reasons.append("(-1 pt) Hot: a lightweight long sleeve can work, but short sleeves are still better.")
        elif top_seasons & {"fall", "autumn", "winter"}:
            score -= 3
            reasons.append("(-3 pts) Hot: this long sleeve looks too seasonal for hot weather.")
        else:
            score -= 2
            reasons.append("(-2 pts) Hot: long sleeves may be too warm.")


    bottom_seasons = _season_set(bottom)
    bottom_style = normalize_token((bottom or {}).get("bottom_style"))
    if bottom_style == "shorts":
        score += 3
        reasons.append("(+3 pts) Hot: shorts are a great choice.")
        if bottom_seasons & {"summer"}:
            score += 1
            reasons.append("(+1 pt) Hot: the shorts are also marked for summer.")
    elif bottom_style == "pants":
        if bottom_seasons & {"summer", "spring"}:
            score -= 1
            reasons.append("(-1 pt) Hot: lightweight pants can work, but they are still warmer than shorts.")
        elif bottom_seasons & {"fall", "autumn", "winter"}:
            score -= 2
            reasons.append("(-2 pts) Hot: these pants look more cold-weather oriented.")
        else:
            score -= 1
            reasons.append("(-1 pt) Hot: pants might feel warm.")

    return score, reasons


def _score_warm_or_mild_weather(top, bottom, outer, band, weather):
    score = 0
    reasons = []
    temp_c = to_float((weather or {}).get("temperature_c"))
    is_rainy = bool((weather or {}).get("is_rainy"))
    is_windy = _wind_intensity_kph(weather) >= 15
    needs_protection = is_rainy or is_windy

    if outer:
        seasons = _season_set(outer)
        is_winter_layer = "winter" in seasons
        is_cool_weather_layer = bool(seasons & {"fall", "autumn", "winter"})

        if band == "warm":
            if needs_protection:
                score += 2
                reasons.append("(+2 pts) Warm: a light outer layer helps with rain/wind.")
            elif is_winter_layer and temp_c is not None and temp_c >= 20:
                score -= 4
                reasons.append(
                    f"(-4 pts) Warm: this winter layer is too heavy for {round(temp_c * 9/5 + 32)}F."
                )
            elif is_cool_weather_layer and temp_c is not None and temp_c >= 24:
                score -= 3
                reasons.append(
                    f"(-3 pts) Warm: this layer is likely too warm for {round(temp_c * 9/5 + 32)}F."
                )
            else:
                score -= 1
                reasons.append("(-1 pt) Warm: extra layers are usually unnecessary.")
        else:
            if needs_protection:
                score += 2
                reasons.append("(+2 pts) Mild: a layer helps with rain or wind.")
            elif is_winter_layer and temp_c is not None and temp_c >= 18:
                score -= 2
                reasons.append(
                    f"(-2 pts) Mild: this winter layer is a bit heavy for {round(temp_c * 9/5 + 32)}F."
                )
            else:
                score += 1
                reasons.append("(+1 pt) Mild: a light layer is optional and reasonable.")
    elif not needs_protection:
        if band == "warm":
            score += 1
            reasons.append("(+1 pt) Warm: skipping extra layers keeps things comfortable.")

    sleeve = normalize_token((top or {}).get("sleeve_length"))
    if sleeve == "short_sleeve":
        score += 2
        reasons.append(f"(+2 pts) {band.capitalize()}: short sleeves work well.")
    elif sleeve == "long_sleeve":
        if band == "mild":
            score += 1
            reasons.append("(+1 pt) Mild: long sleeves are a solid fit.")
        elif temp_c is not None and temp_c >= 26:
            score -= 2
            reasons.append("(-2 pts) Warm: long sleeves can feel too hot.")

    bottom_style = normalize_token((bottom or {}).get("bottom_style"))
    if bottom_style == "shorts":
        if band == "warm":
            score += 2
            reasons.append("(+2 pts) Warm: shorts are comfortable.")
        elif temp_c is not None and temp_c < 14:
            score -= 2
            reasons.append("(-2 pts) Mild: shorts may be too cool for this temperature.")
        else:
            score += 1
            reasons.append("(+1 pt) Mild: shorts are still fine.")
    elif bottom_style == "pants":
        if band == "warm" and temp_c is not None and temp_c >= 26:
            score -= 1
            reasons.append("(-1 pt) Warm: pants can run a little hot.")
        else:
            score += 1
            reasons.append(f"(+1 pt) {band.capitalize()}: pants are a safe choice.")

    return score, reasons


def _score_cold_weather(top, bottom, outer):
    score = 0
    reasons = []

    outer_seasons = _season_set(outer)
    if outer:
        score += 3
        reasons.append("(+3 pts) Cold: glad you chose a layer.")
        if outer_seasons & {"fall", "autumn", "winter"}:
            score += 2
            reasons.append("(+2 pts) Cold: the outer layer is seasonal for colder weather.")
    else:
        score -= 2
        reasons.append("(-2 pts) Cold: missing a warm outer layer.")

    top_seasons = _season_set(top)
    sleeve = normalize_token((top or {}).get("sleeve_length"))
    if sleeve == "long_sleeve":
        score += 3
        reasons.append("(+3 pts) Cold: long sleeves for extra warmth.")
        if top_seasons & {"fall", "autumn", "winter"}:
            score += 1
            reasons.append("(+1 pt) Cold: the top is also marked for colder seasons.")
    elif sleeve == "short_sleeve":
        score -= 2
        reasons.append("(-2 pts) Cold: short sleeves might be chilly.")

    bottom_seasons = _season_set(bottom)
    bottom_style = normalize_token((bottom or {}).get("bottom_style"))
    if bottom_style == "pants":
        score += 3
        reasons.append("(+3 pts) Cold: pants are better for the low temps.")
        if bottom_seasons & {"fall", "autumn", "winter"}:
            score += 1
            reasons.append("(+1 pt) Cold: the pants are also marked for colder seasons.")
    elif bottom_style == "shorts":
        score -= 3
        reasons.append("(-3 pts) Cold: it's too cold for shorts.")

    return score, reasons


def _score_very_cold_weather(top, bottom, outer):
    score = 0
    reasons = []

    outer_seasons = _season_set(outer)
    if outer:
        score += 4
        reasons.append("(+4 pts) Freezing: a heavy layer is a must.")
        if outer_seasons & {"winter"}:
            score += 2
            reasons.append("(+2 pts) Freezing: the outer layer is winter-rated.")
    else:
        score -= 4
        reasons.append("(-4 pts) Freezing: missing a warm outer layer.")

    top_seasons = _season_set(top)
    sleeve = normalize_token((top or {}).get("sleeve_length"))
    if sleeve == "long_sleeve":
        score += 4
        reasons.append("(+4 pts) Freezing: long sleeves are necessary.")
        if top_seasons & {"winter"}:
            score += 1
            reasons.append("(+1 pt) Freezing: the top is also marked for winter.")
    elif sleeve == "short_sleeve":
        score -= 3
        reasons.append("(-3 pts) Freezing: short sleeves are too cold.")

    bottom_seasons = _season_set(bottom)
    bottom_style = normalize_token((bottom or {}).get("bottom_style"))
    if bottom_style == "pants":
        score += 4
        reasons.append("(+4 pts) Freezing: pants are strongly suggested.")
        if bottom_seasons & {"winter"}:
            score += 1
            reasons.append("(+1 pt) Freezing: the pants are also winter-rated.")
    elif bottom_style == "shorts":
        score -= 4
        reasons.append("(-4 pts) Freezing: it's far too cold for shorts.")

    if outer and sleeve == "long_sleeve" and bottom_style == "pants":
        score += 3
        reasons.append("(+3 pts) Bundle up! Heavy coverage bonus.")

    return score, reasons


def score_weather(outfit_sections, weather):
    top = (outfit_sections or {}).get("top")
    bottom = (outfit_sections or {}).get("bottom")
    outer = (outfit_sections or {}).get("outer")

    band = resolve_weather_band(weather)
    score = 0
    reasons = [f"Weather band: {band}."]

    if band == "hot":
        delta, detail = _score_hot_weather(top, bottom, outer)
    elif band in {"warm", "mild"}:
        delta, detail = _score_warm_or_mild_weather(top, bottom, outer, band, weather)
    elif band == "cold":
        delta, detail = _score_cold_weather(top, bottom, outer)
    else:
        delta, detail = _score_very_cold_weather(top, bottom, outer)

    score += delta
    reasons.extend(detail)

    is_rainy = bool((weather or {}).get("is_rainy"))
    is_windy = _wind_intensity_kph(weather) >= 15
    forecast = ((weather or {}).get("forecast") or {})
    rain_later_today = bool(forecast.get("likely_to_rain_later_today"))
    possible_rain_later_today = bool(forecast.get("possible_rain_later_today"))
    max_rain_chance_later_today = max(
        0.0,
        to_float(forecast.get("max_rain_chance_percent_later_today")) or 0.0,
    )
    rain_chance_percent_next_2_hours = max(
        0.0,
        to_float(forecast.get("rain_chance_percent_next_2_hours")) or 0.0,
    )
    drizzle_later_today = bool(forecast.get("likely_to_drizzle_later_today"))
    snow_later_today = bool(forecast.get("likely_to_snow_later_today"))
    windy_later_today = bool(forecast.get("likely_to_be_windy_later_today"))
    very_windy_later_today = bool(forecast.get("likely_to_be_very_windy_later_today"))
    thunderstorms_tonight = bool(forecast.get("likely_thunderstorms_tonight"))
    is_snowing_now = _is_currently_snowing(weather)

    if is_rainy:
        rain_bonus_by_band = {
            "hot": 1,
            "warm": 2,
            "mild": 3,
            "cold": 3,
            "very_cold": 3,
        }
        rain_penalty_by_band = {
            "hot": -2,
            "warm": -3,
            "mild": -3,
            "cold": -4,
            "very_cold": -4,
        }
        if outer:
            rain_bonus = rain_bonus_by_band.get(band, 3)
            score += rain_bonus
            reasons.append(f"(+{rain_bonus} pts) Rainy: adding a layer for protection.")
            seasons = set(list_tokens(outer.get("seasons")))
            if seasons & {"fall", "autumn", "winter"}:
                score += 2
                reasons.append("(+2 pts) Rainy: fall/winter layers offer better protection.")
        else:
            rain_penalty = rain_penalty_by_band.get(band, -3)
            score += rain_penalty
            reasons.append(f"({rain_penalty} pts) Rainy: missing a protective outer layer.")

        bottom_style = normalize_token((bottom or {}).get("bottom_style"))
        if bottom_style == "shorts":
            shorts_rain_penalty_by_band = {
                "hot": -1,
                "warm": -3,
                "mild": -2,
                "cold": -3,
                "very_cold": -4,
            }
            shorts_penalty = shorts_rain_penalty_by_band.get(band, -2)
            score += shorts_penalty
            reasons.append(f"({shorts_penalty} pts) Rainy: pants are usually better than shorts.")
        elif bottom_style == "pants":
            pants_rain_bonus_by_band = {
                "hot": 0,
                "warm": 1,
                "mild": 1,
                "cold": 1,
                "very_cold": 1,
            }
            pants_bonus = pants_rain_bonus_by_band.get(band, 1)
            if pants_bonus > 0:
                score += pants_bonus
                reasons.append(f"(+{pants_bonus} pt) Rainy: pants provide better wet-weather coverage.")

    if is_windy:
        wind_penalty_by_band = {
            "hot": -1,
            "warm": -1,
            "mild": -2,
            "cold": -3,
            "very_cold": -3,
        }
        wind_bonus_by_band = {
            "hot": 1,
            "warm": 2,
            "mild": 2,
            "cold": 2,
            "very_cold": 2,
        }
        if outer:
            wind_bonus = wind_bonus_by_band.get(band, 2)
            score += wind_bonus
            reasons.append(f"(+{wind_bonus} pts) Windy: a layer helps handle the breeze.")
        else:
            wind_penalty = wind_penalty_by_band.get(band, -1)
            score += wind_penalty
            reasons.append(f"({wind_penalty} pts) Windy: a layer would be more comfortable.")

    if rain_later_today and not is_rainy:
        if outer:
            score += 1
            reasons.append("(+1 pt) Forecast: rain is likely later, and a layer helps.")
        else:
            score -= 1
            reasons.append("(-1 pt) Forecast: rain is likely later, and an outer layer may be useful.")

        bottom_style = normalize_token((bottom or {}).get("bottom_style"))
        if bottom_style == "shorts" and band in {"warm", "mild", "cold", "very_cold"}:
            score -= 1
            if drizzle_later_today:
                reasons.append("(-1 pt) Forecast: likely drizzle later makes shorts less practical.")
            else:
                reasons.append("(-1 pt) Forecast: likely rain later makes shorts less practical.")

    if possible_rain_later_today and not is_rainy and not rain_later_today:
        rain_chance_reference = int(
            round(max(max_rain_chance_later_today, rain_chance_percent_next_2_hours))
        )
        if outer:
            score += 1
            if rain_chance_reference > 0:
                reasons.append(
                    f"(+1 pt) Forecast: chance-of-rain bonus applied ({rain_chance_reference}% chance later) because a layer is included."
                )
            else:
                reasons.append("(+1 pt) Forecast: chance-of-rain bonus applied because a layer is included.")
        else:
            if rain_chance_reference > 0:
                reasons.append(
                    f"(0 pts) Forecast: {rain_chance_reference}% chance of rain later detected; no chance-of-rain bonus without a layer."
                )
            else:
                reasons.append("(0 pts) Forecast: chance of rain later detected; no chance-of-rain bonus without a layer.")

    if snow_later_today and not is_snowing_now:
        if outer:
            score += 1
            reasons.append("(+1 pt) Forecast: snow is possible later, and a layer helps.")
        else:
            if band in {"cold", "very_cold"}:
                score -= 2
                reasons.append("(-2 pts) Forecast: snow later makes an outer layer more important.")
            else:
                score -= 1
                reasons.append("(-1 pt) Forecast: snow is possible later, so a layer may help.")

        bottom_style = normalize_token((bottom or {}).get("bottom_style"))
        if bottom_style == "shorts":
            if band in {"cold", "very_cold"}:
                score -= 2
                reasons.append("(-2 pts) Forecast: shorts are risky with possible snow later.")
            else:
                score -= 1
                reasons.append("(-1 pt) Forecast: shorts are less practical if snow arrives later.")

    if windy_later_today and not is_windy:
        if outer:
            score += 1
            reasons.append("(+1 pt) Forecast: winds are expected to pick up later.")
        else:
            if very_windy_later_today and band in {"cold", "very_cold"}:
                score -= 2
                reasons.append("(-2 pts) Forecast: very strong winds later make an outer layer more important.")
            else:
                score -= 1
                reasons.append("(-1 pt) Forecast: wind is expected to pick up later.")

    if thunderstorms_tonight and not is_rainy:
        if outer:
            score += 1
            reasons.append("(+1 pt) Forecast: thunderstorms tonight favor light protection.")
        else:
            score -= 1
            reasons.append("(-1 pt) Forecast: thunderstorms tonight suggest carrying a layer.")


    for section_name in ("top", "bottom", "outer"):
        item = (outfit_sections or {}).get(section_name)
        if not item:
            continue
        delta, detail = _score_section_seasons(section_name, item, band)
        score += delta
        reasons.extend(detail)


    return score, reasons
