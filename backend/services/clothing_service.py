import hashlib
import json
import random
import sqlite3 as sql
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, UploadFile

from app_config import CLOTHING_DB_PATH, CLOTHING_STORAGE_DIR
from outfit_generation import generate_outfit_payload
from scoring.utils import split_csv_field, to_float


OUTFIT_POOL_TOP_N = 50
OUTFIT_POOL_CANDIDATE_COUNT = 250
OUTFIT_POOL_TTL_SECONDS = 300


@dataclass
class OutfitPoolEntry:
    top_outfits: List[dict]
    weather: dict
    expires_at: float
    rotation: List[int]
    rotation_cursor: int = 0
    last_served_index: Optional[int] = None
    refreshing: bool = False


_outfit_pool_cache: Dict[Tuple[str, Optional[float], Optional[float]], OutfitPoolEntry] = {}
_outfit_pool_lock = threading.Lock()


def list_clothing_items():
    conn = sql.connect(str(CLOTHING_DB_PATH))
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, type, image_path, color, minor_color, season, occasion, fit, sleeve_length, bottom_style FROM clothing"
    )
    items = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row[0],
            "type": row[1],
            "image_path": row[2],
            "color": split_csv_field(row[3]),
            "minor_color": split_csv_field(row[4]),
            "season": split_csv_field(row[5]),
            "occasion": split_csv_field(row[6]),
            "fit": row[7],
            "sleeve_length": row[8],
            "bottom_style": row[9],
        }
        for row in items
    ]


def _sanitize_top_n(top_n: int) -> int:
    try:
        return max(1, min(int(top_n), OUTFIT_POOL_TOP_N))
    except (TypeError, ValueError):
        return 3


def _normalize_location(
    latitude: Optional[float], longitude: Optional[float]
) -> Tuple[Optional[float], Optional[float]]:
    lat = to_float(latitude)
    lon = to_float(longitude)
    return (
        round(lat, 3) if lat is not None else None,
        round(lon, 3) if lon is not None else None,
    )


def _compute_wardrobe_signature() -> str:
    conn = sql.connect(str(CLOTHING_DB_PATH))
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, type, season, color, minor_color, sleeve_length, bottom_style, occasion
            FROM clothing
            ORDER BY id
            """
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    payload = json.dumps(rows, separators=(",", ":"))
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def _build_pool_key(
    latitude: Optional[float], longitude: Optional[float]
) -> Tuple[str, Optional[float], Optional[float]]:
    wardrobe_signature = _compute_wardrobe_signature()
    lat_key, lon_key = _normalize_location(latitude, longitude)
    return (wardrobe_signature, lat_key, lon_key)


def _refresh_pool_payload(
    latitude: Optional[float],
    longitude: Optional[float],
) -> dict:
    return generate_outfit_payload(
        candidate_count=OUTFIT_POOL_CANDIDATE_COUNT,
        selected_sections=None,
        top_n=OUTFIT_POOL_TOP_N,
        latitude=latitude,
        longitude=longitude,
    )


def _create_pool_entry(payload: dict, is_refreshing: bool = False) -> OutfitPoolEntry:
    top_outfits = list(payload.get("top_outfits") or [])
    if not top_outfits:
        top_outfits = [
            {
                "rank": 1,
                "score": payload.get("score", 0),
                "sections": payload.get("sections") or {"outer": None, "top": None, "bottom": None},
                "reasons": payload.get("reasons") or [],
            }
        ]

    rotation = list(range(len(top_outfits)))
    random.shuffle(rotation)

    return OutfitPoolEntry(
        top_outfits=top_outfits,
        weather=payload.get("weather") or {},
        expires_at=time.time() + OUTFIT_POOL_TTL_SECONDS,
        rotation=rotation,
        refreshing=is_refreshing,
    )


def _section_signature(sections: dict) -> Tuple[Optional[int], Optional[int], Optional[int]]:
    return (
        sections.get("outer"),
        sections.get("top"),
        sections.get("bottom"),
    )


def _pick_outfit_from_entry(entry: OutfitPoolEntry, selected_sections: dict) -> dict:
    selected_signature = _section_signature(selected_sections)
    total = len(entry.rotation)

    if total == 0:
        return {
            "rank": 1,
            "score": 0,
            "sections": {"outer": None, "top": None, "bottom": None},
            "reasons": ["No outfit candidates are available."],
        }

    for _ in range(total):
        if entry.rotation_cursor >= total:
            random.shuffle(entry.rotation)
            entry.rotation_cursor = 0

        rotation_slot = entry.rotation_cursor
        index = entry.rotation[rotation_slot]
        entry.rotation_cursor += 1

        candidate = entry.top_outfits[index]
        candidate_signature = _section_signature(candidate.get("sections") or {})

        if entry.last_served_index is not None and index == entry.last_served_index and total > 1:
            continue

        if selected_signature == candidate_signature and total > 1:
            continue

        entry.last_served_index = index
        return candidate

    if entry.rotation_cursor >= total:
        random.shuffle(entry.rotation)
        entry.rotation_cursor = 0

    fallback_index = entry.rotation[entry.rotation_cursor]
    entry.rotation_cursor += 1
    entry.last_served_index = fallback_index
    return entry.top_outfits[fallback_index]


def _start_background_refresh(
    cache_key: Tuple[str, Optional[float], Optional[float]],
    latitude: Optional[float],
    longitude: Optional[float],
) -> None:
    def _refresh() -> None:
        try:
            payload = _refresh_pool_payload(latitude=latitude, longitude=longitude)
            refreshed_entry = _create_pool_entry(payload, is_refreshing=False)
            with _outfit_pool_lock:
                _outfit_pool_cache[cache_key] = refreshed_entry
        except Exception:
            with _outfit_pool_lock:
                existing = _outfit_pool_cache.get(cache_key)
                if existing:
                    existing.refreshing = False

    thread = threading.Thread(target=_refresh, daemon=True)
    thread.start()


def _validate_upload_fields(
    clothing_type: str,
    sleeve_length: Optional[str],
    bottom_style: Optional[str],
) -> tuple[str, Optional[str], Optional[str]]:
    normalized_type = (clothing_type or "").strip().lower()

    valid_types = {"top", "bottom", "layer", "top_layer"}
    if normalized_type not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid clothing type.")

    needs_sleeve_length = normalized_type in {"top", "layer", "top_layer"}
    valid_sleeve_lengths = {"short_sleeve", "long_sleeve"}
    if needs_sleeve_length:
        if sleeve_length not in valid_sleeve_lengths:
            raise HTTPException(
                status_code=400,
                detail="Sleeve length must be short_sleeve or long_sleeve for tops/layers.",
            )
    else:
        sleeve_length = None

    needs_bottom_style = normalized_type == "bottom"
    valid_bottom_styles = {"shorts", "pants"}
    if needs_bottom_style:
        if bottom_style not in valid_bottom_styles:
            raise HTTPException(
                status_code=400,
                detail="Bottom style must be shorts or pants for bottoms.",
            )
    else:
        bottom_style = None

    return normalized_type, sleeve_length, bottom_style


def create_clothing_item(
    file: UploadFile,
    clothing_type: str,
    major_colors: List[str],
    minor_colors: Optional[List[str]],
    seasons: List[str],
    occasions: List[str],
    fit: str,
    sleeve_length: Optional[str],
    bottom_style: Optional[str],
):
    # Delay heavy image-processing imports until upload is called.
    from image_processing import process_and_save_image

    normalized_type, sleeve_length, bottom_style = _validate_upload_fields(
        clothing_type=clothing_type,
        sleeve_length=sleeve_length,
        bottom_style=bottom_style,
    )

    try:
        result = process_and_save_image(file)
    except (OSError, ValueError) as ex:
        raise HTTPException(status_code=400, detail=str(ex)) from ex

    image_path = result["image_path"]

    color_csv = ",".join(major_colors)
    minor_color_csv = ",".join(minor_colors) if minor_colors else ""
    season_csv = ",".join(seasons)
    occasion_csv = ",".join(occasions)

    conn = sql.connect(str(CLOTHING_DB_PATH))
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO clothing (type, image_path, color, minor_color, season, occasion, fit, sleeve_length, bottom_style)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            normalized_type,
            image_path,
            color_csv,
            minor_color_csv,
            season_csv,
            occasion_csv,
            fit,
            sleeve_length,
            bottom_style,
        ),
    )
    conn.commit()
    clothing_id = cursor.lastrowid
    conn.close()

    return {
        "id": clothing_id,
        "type": normalized_type,
        "image_path": image_path,
        "color": split_csv_field(color_csv),
        "minor_color": split_csv_field(minor_color_csv),
        "season": split_csv_field(season_csv),
        "occasion": split_csv_field(occasion_csv),
        "fit": fit,
        "sleeve_length": sleeve_length,
        "bottom_style": bottom_style,
    }


def delete_clothing_item(clothing_id: int):
    status = "unknown_error"
    conn = sql.connect(str(CLOTHING_DB_PATH))

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT image_path FROM clothing WHERE id = ?", (clothing_id,))
        row = cursor.fetchone()

        if not row:
            status = "not_found"
        else:
            image_path = row[0] or ""
            image_deleted = False

            if image_path:
                image_file = CLOTHING_STORAGE_DIR / Path(image_path).name
                try:
                    if image_file.exists():
                        image_file.unlink()
                        image_deleted = True
                    else:
                        status = "image_not_found"
                except OSError:
                    status = "image_delete_failed"
            else:
                image_deleted = True

            if status == "unknown_error":
                cursor.execute("DELETE FROM clothing WHERE id = ?", (clothing_id,))
                conn.commit()
                if cursor.rowcount == 1 and image_deleted:
                    status = "success"
                else:
                    status = "db_delete_failed"
    finally:
        conn.close()

    return {
        "id": clothing_id,
        "deleted": status == "success",
        "status": status,
    }


def generate_outfit(
    selected_outer: Optional[int],
    selected_top: Optional[int],
    selected_bottom: Optional[int],
    top_n: int,
    latitude: Optional[float],
    longitude: Optional[float],
):
    requested_top_n = _sanitize_top_n(top_n)
    selected_sections = {
        "outer": selected_outer,
        "top": selected_top,
        "bottom": selected_bottom,
    }

    cache_key = _build_pool_key(latitude=latitude, longitude=longitude)

    with _outfit_pool_lock:
        entry = _outfit_pool_cache.get(cache_key)

    if entry is None:
        try:
            payload = _refresh_pool_payload(latitude=latitude, longitude=longitude)
            built_entry = _create_pool_entry(payload, is_refreshing=False)
        except Exception:
            return generate_outfit_payload(
                selected_sections=selected_sections,
                top_n=requested_top_n,
                latitude=latitude,
                longitude=longitude,
            )

        with _outfit_pool_lock:
            _outfit_pool_cache[cache_key] = built_entry
            entry = built_entry

    now = time.time()
    needs_refresh = entry.expires_at <= now
    if needs_refresh:
        with _outfit_pool_lock:
            latest = _outfit_pool_cache.get(cache_key)
            if latest and latest.expires_at <= now and not latest.refreshing:
                latest.refreshing = True
                _start_background_refresh(
                    cache_key=cache_key,
                    latitude=latitude,
                    longitude=longitude,
                )

    with _outfit_pool_lock:
        entry = _outfit_pool_cache.get(cache_key)
        if not entry:
            return generate_outfit_payload(
                selected_sections=selected_sections,
                top_n=requested_top_n,
                latitude=latitude,
                longitude=longitude,
            )

        chosen = _pick_outfit_from_entry(entry, selected_sections)
        ranked_top = []
        for rank, item in enumerate(entry.top_outfits[:requested_top_n], start=1):
            ranked_top.append(
                {
                    "rank": rank,
                    "score": item.get("score", 0),
                    "sections": item.get("sections") or {"outer": None, "top": None, "bottom": None},
                    "reasons": item.get("reasons") or [],
                }
            )

        weather = dict(entry.weather)

    return {
        "name": "Generated Outfit",
        "sections": chosen.get("sections") or {"outer": None, "top": None, "bottom": None},
        "score": chosen.get("score", 0),
        "weather": weather,
        "reasons": chosen.get("reasons") or [],
        "top_outfits": ranked_top,
    }
