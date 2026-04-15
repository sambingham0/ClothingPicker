import random
import sqlite3 as sql

from app_config import CLOTHING_DB_PATH
from scoring.outfit_score import explain_outfit_score, score_outfit
from scoring.utils import split_csv_field
from scoring.weather_score import fetch_current_weather, get_layering_guidance


def generate_candidate_outfit(grouped, weather):
    sections = {"outer": None, "top": None, "bottom": None}
    used_ids = set()
    layering_guidance = get_layering_guidance(weather)

    outer_available = [item for item in grouped["outer"] if item["id"] not in used_ids]
    should_include_outer = random.random() < layering_guidance["outer_probability"]
    if outer_available and should_include_outer:
        selected_outer = random.choice(outer_available)
        sections["outer"] = selected_outer
        used_ids.add(selected_outer["id"])

    base_top_available = [item for item in grouped["top_base"] if item["id"] not in used_ids]
    layered_top_available = [
        item for item in grouped["top"]
        if item["id"] not in used_ids and item["type"] == "top_layer"
    ]

    if sections["outer"]:
        top_available = base_top_available if base_top_available else layered_top_available
    else:
        choose_layer_probability = layering_guidance["layer_top_without_outer_probability"]
        choose_layer = layered_top_available and random.random() < choose_layer_probability
        top_available = layered_top_available if choose_layer else base_top_available

        if not top_available:
            top_available = base_top_available or layered_top_available

    if top_available:
        selected_top = random.choice(top_available)
        sections["top"] = selected_top
        used_ids.add(selected_top["id"])

    bottom_available = [item for item in grouped["bottom"] if item["id"] not in used_ids]
    if bottom_available:
        selected_bottom = random.choice(bottom_available)
        sections["bottom"] = selected_bottom
        used_ids.add(selected_bottom["id"])

    return sections


def serialize_sections(outfit_sections):
    return {
        section_id: (item["id"] if item else None)
        for section_id, item in outfit_sections.items()
    }


def normalize_selected_sections(selected_sections):
    normalized = {"outer": None, "top": None, "bottom": None}
    if not isinstance(selected_sections, dict):
        return normalized

    for section_id in normalized:
        value = selected_sections.get(section_id)
        normalized[section_id] = value if isinstance(value, int) else None

    return normalized


def generate_outfit_payload(
    candidate_count=30,
    selected_sections=None,
    top_n=3,
    latitude=None,
    longitude=None,
):

    try:
        candidate_total = max(1, int(candidate_count))
    except (TypeError, ValueError):
        candidate_total = 30

    try:
        top_outfit_count = max(1, min(int(top_n), 10))
    except (TypeError, ValueError):
        top_outfit_count = 3

    conn = sql.connect(str(CLOTHING_DB_PATH))
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, type, season, color, minor_color, sleeve_length, bottom_style, occasion
            FROM clothing
            """
        )
        items = cursor.fetchall()
    finally:
        conn.close()

    section_map = {
        "layer": ["outer"],
        "top_layer": ["outer", "top"],
        "top": ["top"],
        "bottom": ["bottom"]
    }

    grouped = {"outer": [], "top": [], "top_base": [], "bottom": []}
    for (
        clothing_id,
        clothing_type,
        season_csv,
        major_color_csv,
        minor_color_csv,
        sleeve_length,
        bottom_style,
        occasion_csv,
    ) in items:
        normalized_type = (clothing_type or "").strip().lower()
        item = {
            "id": clothing_id,
            "type": normalized_type,
            "seasons": split_csv_field(season_csv),
            "major_colors": split_csv_field(major_color_csv),
            "minor_colors": split_csv_field(minor_color_csv),
            "sleeve_length": (sleeve_length or "").strip().lower(),
            "bottom_style": (bottom_style or "").strip().lower(),
            "occasion": split_csv_field(occasion_csv),
        }

        if normalized_type == "top":
            grouped["top_base"].append(item)

        section_ids = section_map.get(normalized_type, [])
        for section_id in section_ids:
            grouped[section_id].append(item)

    weather = fetch_current_weather(latitude=latitude, longitude=longitude)

    if not any(grouped.values()):
        return {
            "name": "Generated Outfit",
            "sections": {"outer": None, "top": None, "bottom": None},
            "score": 0,
            "weather": weather,
            "reasons": ["No clothing items are available to build an outfit."]
        }

    candidates = []

    for _ in range(candidate_total):
        candidate_sections = generate_candidate_outfit(grouped, weather)
        candidate_score = score_outfit(candidate_sections, weather)
        candidates.append((candidate_score, candidate_sections))

    candidates.sort(key=lambda entry: entry[0], reverse=True)

    current_sections = normalize_selected_sections(selected_sections)
    best_score, best_sections = candidates[0]
    chosen_sections = best_sections
    chosen_score = best_score

    if any(value is not None for value in current_sections.values()):
        for candidate_score, candidate_sections in candidates:
            candidate_serialized = serialize_sections(candidate_sections)
            if candidate_serialized != current_sections:
                chosen_sections = candidate_sections
                chosen_score = candidate_score
                break

    explained_score, reasons = explain_outfit_score(chosen_sections, weather)
    if explained_score != chosen_score:
        chosen_score = explained_score

    top_outfit_count = min(top_outfit_count, len(candidates))
    top_outfits = []
    for rank, (candidate_score, candidate_sections) in enumerate(candidates[:top_outfit_count], start=1):
        explained, candidate_reasons = explain_outfit_score(candidate_sections, weather)
        top_outfits.append(
            {
                "rank": rank,
                "score": explained,
                "sections": serialize_sections(candidate_sections),
                "reasons": candidate_reasons,
            }
        )

    return {
        "name": "Generated Outfit",
        "sections": serialize_sections(chosen_sections),
        "score": chosen_score,
        "weather": weather,
        "reasons": reasons,
        "top_outfits": top_outfits,
    }
