from scoring.color_score import score_colors
from scoring.occasion_score import score_occasion
from scoring.utils import normalize_token
from scoring.weather_evaluation import score_weather


def _score_layer_sleeve_pairing(outfit_sections, weather):
    top = (outfit_sections or {}).get("top")
    outer = (outfit_sections or {}).get("outer")

    top_sleeve = normalize_token((top or {}).get("sleeve_length"))
    outer_sleeve = normalize_token((outer or {}).get("sleeve_length"))

    if not top_sleeve or not outer_sleeve:
        return 0, []

    band = (weather or {}).get("band")

    if top_sleeve == "long_sleeve" and outer_sleeve == "long_sleeve":
        if band in {"warm", "hot"}:
            return -6, [
                "(-6 pts) Warm: double long sleeves is too heavy."
            ]
        elif band in {"mild"}:
            return -3, [
                "(-3 pts) Mild: double long sleeves can feel bulky."
            ]
        # allow in cold weather
        return 0, []

    return 0, []

def explain_outfit_score(outfit_sections, weather):
    score = 0
    reasons = []

    top = (outfit_sections or {}).get("top")
    bottom = (outfit_sections or {}).get("bottom")

    if not top:
        score -= 10
        reasons.append("(-10 pts) Missing top: strong penalty.")
    if not bottom:
        score -= 10
        reasons.append("(-10 pts) Missing bottom: strong penalty.")

    sleeve_pairing_score, sleeve_pairing_reasons = _score_layer_sleeve_pairing(outfit_sections, weather)
    score += sleeve_pairing_score
    reasons.extend(sleeve_pairing_reasons)

    weather_score, weather_reasons = score_weather(outfit_sections, weather)
    color_score, color_reasons = score_colors(outfit_sections)
    occasion_score, occasion_reasons = score_occasion(outfit_sections)

    score += weather_score + color_score + occasion_score
    reasons.append("—————————— Weather ——————————")
    reasons.extend(weather_reasons)

    reasons.append("—————————— Colors ——————————")
    reasons.extend(color_reasons)

    reasons.append("—————————— Occasion ——————————")
    reasons.extend(occasion_reasons)

    return score, reasons


def score_outfit(outfit_sections, weather):
    score, _ = explain_outfit_score(outfit_sections, weather)
    return score
