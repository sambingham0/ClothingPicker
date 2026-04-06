import random
import sqlite3 as sql


def generate_outfit_payload():
    conn = sql.connect("clothing.db")
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, type FROM clothing")
        items = cursor.fetchall()
    finally:
        conn.close()

    section_map = {
        "layer": "outer",
        "top_layer": "outer",
        "top": "top",
        "bottom": "bottom"
    }

    grouped = {"outer": [], "top": [], "bottom": []}
    for clothing_id, clothing_type in items:
        section_id = section_map.get((clothing_type or "").strip().lower())
        if section_id:
            grouped[section_id].append(clothing_id)

    generated_sections = {"outer": None, "top": None, "bottom": None}
    for section_id in ("outer", "top", "bottom"):
        section_items = grouped[section_id]
        if section_items:
            generated_sections[section_id] = random.choice(section_items)

    return {
        "name": "Generated Outfit",
        "sections": generated_sections
    }