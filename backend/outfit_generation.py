import math
import random
import sqlite3 as sql

from app_config import CLOTHING_DB_PATH
from scoring.outfit_score import explain_outfit_score, score_outfit
from scoring.utils import split_csv_field
from scoring.weather_score import fetch_current_weather, get_layering_guidance


OUTFIT_SECTION_IDS = ("outer", "top", "bottom")
MAX_TOP_OUTFITS = 25


def generate_candidate_outfit(grouped, layering_guidance):
    sections = {"outer": None, "top": None, "bottom": None}
    used_ids = set()

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


def section_item_id(outfit_sections, section_id):
    item = (outfit_sections or {}).get(section_id)
    if not item:
        return None
    return item.get("id")


def candidate_signature(outfit_sections):
    return tuple(section_item_id(outfit_sections, section_id) for section_id in OUTFIT_SECTION_IDS)


def dedupe_ranked_candidates(ranked_candidates):
    unique_candidates = []
    seen_signatures = set()

    for candidate_score, candidate_sections in ranked_candidates:
        signature = candidate_signature(candidate_sections)
        if signature in seen_signatures:
            continue

        seen_signatures.add(signature)
        unique_candidates.append((candidate_score, candidate_sections))

    return unique_candidates


def preferred_item_reuse_cap(top_outfit_count):
    # Base cap targets visible diversity for first-screen outfit options.
    diversity_window = min(top_outfit_count, 8)
    return max(1, min(3, int(diversity_window * 0.4)))


def calculate_section_item_caps(ranked_candidates, top_outfit_count):
    if top_outfit_count <= 0:
        return {section_id: 1 for section_id in OUTFIT_SECTION_IDS}

    diversity_window = min(top_outfit_count, 8)
    preferred_cap = preferred_item_reuse_cap(top_outfit_count)
    unique_items_by_section = {section_id: set() for section_id in OUTFIT_SECTION_IDS}

    for _, candidate_sections in ranked_candidates:
        for section_id in OUTFIT_SECTION_IDS:
            item_id = section_item_id(candidate_sections, section_id)
            if item_id is not None:
                unique_items_by_section[section_id].add(item_id)

    section_caps = {}
    for section_id, unique_ids in unique_items_by_section.items():
        unique_count = len(unique_ids)
        if unique_count == 0:
            section_caps[section_id] = diversity_window
            continue

        minimum_cap_needed = max(1, math.ceil(diversity_window / unique_count))
        section_caps[section_id] = max(preferred_cap, minimum_cap_needed)

    return section_caps


def candidate_within_item_cap(candidate_sections, item_usage_by_section, section_caps, cap_relaxation):
    for section_id in OUTFIT_SECTION_IDS:
        item_id = section_item_id(candidate_sections, section_id)
        if item_id is None:
            continue

        section_cap = section_caps.get(section_id, 1)
        effective_cap = section_cap + cap_relaxation
        if item_usage_by_section[section_id].get(item_id, 0) >= effective_cap:
            return False

    return True


def increment_item_usage(candidate_sections, item_usage_by_section):
    for section_id in OUTFIT_SECTION_IDS:
        item_id = section_item_id(candidate_sections, section_id)
        if item_id is None:
            continue

        item_usage_by_section[section_id][item_id] = item_usage_by_section[section_id].get(item_id, 0) + 1


def select_diverse_top_candidates(ranked_candidates, top_outfit_count):
    if top_outfit_count <= 0:
        return []

    selected_candidates = []
    remaining_candidates = list(ranked_candidates)
    item_usage_by_section = {section_id: {} for section_id in OUTFIT_SECTION_IDS}
    section_caps = calculate_section_item_caps(ranked_candidates, top_outfit_count)

    while remaining_candidates and len(selected_candidates) < top_outfit_count:
        chosen_index = None
        cap_relaxation = 0

        while cap_relaxation <= top_outfit_count and chosen_index is None:
            for index, (_, candidate_sections) in enumerate(remaining_candidates):
                if candidate_within_item_cap(
                    candidate_sections,
                    item_usage_by_section,
                    section_caps,
                    cap_relaxation,
                ):
                    chosen_index = index
                    break
            cap_relaxation += 1

        if chosen_index is None:
            chosen_index = 0

        chosen_candidate = remaining_candidates.pop(chosen_index)
        selected_candidates.append(chosen_candidate)
        increment_item_usage(chosen_candidate[1], item_usage_by_section)

    return selected_candidates


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
        top_outfit_count = max(1, min(int(top_n), MAX_TOP_OUTFITS))
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

    if not any(grouped.values()):
        return {
            "name": "Generated Outfit",
            "sections": {"outer": None, "top": None, "bottom": None},
            "score": 0,
            "weather": {"source": "not-requested", "band": "mild"},
            "reasons": ["No clothing items are available to build an outfit."]
        }

    weather = fetch_current_weather(latitude=latitude, longitude=longitude)
    layering_guidance = get_layering_guidance(weather)

    candidates = []

    for _ in range(candidate_total):
        candidate_sections = generate_candidate_outfit(grouped, layering_guidance)
        candidate_score = score_outfit(candidate_sections, weather)
        candidates.append((candidate_score, candidate_sections))

    candidates.sort(key=lambda entry: entry[0], reverse=True)
    candidates = dedupe_ranked_candidates(candidates)

    if not candidates:
        return {
            "name": "Generated Outfit",
            "sections": {"outer": None, "top": None, "bottom": None},
            "score": 0,
            "weather": weather,
            "reasons": ["No outfit candidates could be generated from current wardrobe constraints."],
            "top_outfits": [],
        }

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
    top_candidates = select_diverse_top_candidates(candidates, top_outfit_count)
    top_outfits = []
    for rank, (candidate_score, candidate_sections) in enumerate(top_candidates, start=1):
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
