import sqlite3 as sql
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, UploadFile

from app_config import CLOTHING_DB_PATH, CLOTHING_STORAGE_DIR
from outfit_generation import generate_outfit_payload
from scoring.utils import split_csv_field


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
    selected_sections = {
        "outer": selected_outer,
        "top": selected_top,
        "bottom": selected_bottom,
    }

    return generate_outfit_payload(
        selected_sections=selected_sections,
        top_n=top_n,
        latitude=latitude,
        longitude=longitude,
    )
