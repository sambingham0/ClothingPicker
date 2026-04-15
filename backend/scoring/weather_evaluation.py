from scoring.utils import list_tokens, normalize_token, to_float
from scoring.weather_score import resolve_weather_band

TARGET_SEASONS = {
    "hot": {"summer"},
    "warm": {"spring", "summer"},
    "mild": {"spring", "fall", "autumn"},
    "cold": {"fall", "autumn", "winter"},
    "very_cold": {"winter"},
}


def _wind_intensity_kph(weather):
    wind_kph = to_float((weather or {}).get("wind_kph")) or 0.0
    gust_kph = to_float((weather or {}).get("wind_gust_kph")) or 0.0
    return max(wind_kph, gust_kph)

def _score_hot_weather(top, bottom, outer):
    score = 0
    reasons = []

    if outer:
        score -= 4
        reasons.append("(-4 pts) Hot: wearing a layer is uncomfortable in this heat.")
    else:
        score += 3
        reasons.append("(+3 pts) Hot: keeping it light is best.")

    sleeve = normalize_token((top or {}).get("sleeve_length"))
    if sleeve == "short_sleeve":
        score += 3
        reasons.append("(+3 pts) Hot: short sleeves are perfect.")
    elif sleeve == "long_sleeve":
        score -= 2
        reasons.append("(-2 pts) Hot: long sleeves may be too warm.")

    bottom_style = normalize_token((bottom or {}).get("bottom_style"))
    if bottom_style == "shorts":
        score += 3
        reasons.append("(+3 pts) Hot: shorts are a great choice.")
    elif bottom_style == "pants":
        score -= 1
        reasons.append("(-1 pt) Hot: pants might feel warm.")

    return score, reasons

def _score_warm_or_mild_weather(top, bottom, outer, band, weather):
    score = 0
    reasons = []
    temp_c = to_float((weather or {}).get("temperature_c"))

    if outer:
        seasons = set(list_tokens(outer.get("seasons")))
        is_winter_layer = bool(seasons & {"winter", "fall", "autumn"})
        
        # Threshold logic: Winter layers are too hot above 15.5C (60F)
        if is_winter_layer and temp_c is not None and temp_c > 15.5:
            score -= 3
            reasons.append(f"(-3 pts) {band.capitalize()}: This winter layer is too heavy for {round(temp_c * 9/5 + 32)}F.")
        else:
            # Most layers are fine for style in mild/warm weather
            score += 2
            reasons.append(f"(+2 pts) {band.capitalize()}: Layer looks good for style.")

    sleeve = normalize_token((top or {}).get("sleeve_length"))
    if sleeve == "short_sleeve":
        score += 2
        reasons.append(f"(+2 pts) {band.capitalize()}: short sleeves work well.")
    elif sleeve == "long_sleeve" and band == "mild":
        score += 1
        reasons.append("(+1 pt) Mild: long sleeves are a solid fit.")

    bottom_style = normalize_token((bottom or {}).get("bottom_style"))
    if bottom_style == "shorts":
        if band == "warm":
            score += 2
            reasons.append("(+2 pts) Warm: shorts are comfortable.")
        else:
            score += 1
            reasons.append("(+1 pt) Mild: shorts are still fine.")
    elif bottom_style == "pants":
        score += 1
        reasons.append(f"(+1 pt) {band.capitalize()}: pants are a safe choice.")

    return score, reasons

def _score_cold_weather(top, bottom, outer):
    score = 0
    reasons = []

    if outer:
        score += 3
        reasons.append("(+3 pts) Cold: glad you chose a layer.")
    else:
        score -= 2
        reasons.append("(-2 pts) Cold: missing a warm outer layer.")

    sleeve = normalize_token((top or {}).get("sleeve_length"))
    if sleeve == "long_sleeve":
        score += 3
        reasons.append("(+3 pts) Cold: long sleeves for extra warmth.")
    elif sleeve == "short_sleeve":
        score -= 2
        reasons.append("(-2 pts) Cold: short sleeves might be chilly.")

    bottom_style = normalize_token((bottom or {}).get("bottom_style"))
    if bottom_style == "pants":
        score += 3
        reasons.append("(+3 pts) Cold: pants are better for the low temps.")
    elif bottom_style == "shorts":
        score -= 3
        reasons.append("(-3 pts) Cold: it'\''s too cold for shorts.")

    return score, reasons

def _score_very_cold_weather(top, bottom, outer):
    score = 0
    reasons = []

    if outer:
        score += 4
        reasons.append("(+4 pts) Freezing: a heavy layer is a must.")
    else:
        score -= 4
        reasons.append("(-4 pts) Freezing: missing a warm outer layer.")

    sleeve = normalize_token((top or {}).get("sleeve_length"))
    if sleeve == "long_sleeve":
        score += 4
        reasons.append("(+4 pts) Freezing: long sleeves are necessary.")
    elif sleeve == "short_sleeve":
        score -= 3
        reasons.append("(-3 pts) Freezing: short sleeves are too cold.")

    bottom_style = normalize_token((bottom or {}).get("bottom_style"))
    if bottom_style == "pants":
        score += 4
        reasons.append("(+4 pts) Freezing: pants are strongly suggested.")
    elif bottom_style == "shorts":
        score -= 4
        reasons.append("(-4 pts) Freezing: it'\''s far too cold for shorts.")

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

    if is_rainy:
        if outer:
            score += 3
            reasons.append("(+3 pts) Rainy: adding a layer for protection.")
            seasons = set(list_tokens(outer.get("seasons")))
            if seasons & {"fall", "autumn", "winter"}:
                score += 2
                reasons.append("(+2 pts) Rainy: fall/winter layers offer better protection.")
        else:
            score -= 3
            reasons.append("(-3 pts) Rainy: missing a protective outer layer.")

        bottom_style = normalize_token((bottom or {}).get("bottom_style"))
        if bottom_style == "shorts":
            score -= 2
            reasons.append("(-2 pts) Rainy: pants are usually better than shorts.")

    if is_windy:
        if outer:
            score += 2
            reasons.append("(+2 pts) Windy: a layer helps handle the breeze.")
        else:
            score -= 1
            reasons.append("(-1 pt) Windy: a layer would be more comfortable.")

    target_seasons = TARGET_SEASONS.get(band, set())
    if target_seasons:
        for section_name in ("top", "bottom", "outer"):
            item = (outfit_sections or {}).get(section_name)
            if not item:
                continue
            seasons = set(list_tokens(item.get("seasons")))
            if not seasons:
                continue
            if seasons & target_seasons:
                score += 1
                reasons.append(f"(+1 pt) {section_name.capitalize()} seasonal match ({band}).")
            else:
                score -= 2
                reasons.append(
                    f"(-2 pts) {section_name.capitalize()} season ({', '.join(seasons)}) does not align with {band} weather."
                )

    return score, reasons
