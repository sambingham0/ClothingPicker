from scoring.color_score import score_colors
from scoring.occasion_score import score_occasion
from scoring.weather_evaluation import score_weather

def explain_outfit_score(outfit_sections, weather):
    score = 0
    reasons = []

    top = (outfit_sections or {}).get("top")
    bottom = (outfit_sections or {}).get("bottom")

    if not top:
        score -= 8
        reasons.append("(-8 pts) Missing top: strong penalty.")
    if not bottom:
        score -= 8
        reasons.append("(-8 pts) Missing bottom: strong penalty.")

    if top and bottom:
        score += 2
        reasons.append("(+2 pts) Base outfit bonus: both top and bottom are present.")

    weather_score, weather_reasons = score_weather(outfit_sections, weather)
    color_score, color_reasons = score_colors(outfit_sections)
    occasion_score, occasion_reasons = score_occasion(outfit_sections)

    score += weather_score + color_score + occasion_score
    reasons.extend(weather_reasons)
    reasons.extend(color_reasons)
    reasons.extend(occasion_reasons)

    return score, reasons


def score_outfit(outfit_sections, weather):
    score, _ = explain_outfit_score(outfit_sections, weather)
    return score
