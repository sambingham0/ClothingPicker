from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import sqlite3 as sql
from pathlib import Path
from db.create_db import create_clothing_db
from image_processing import process_and_save_image
from outfit_generation import generate_outfit_payload

app = FastAPI()
app.mount("/images", StaticFiles(directory="storage"), name="images")

# Enable CORS for all origins (for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    create_clothing_db()

@app.get("/")
def read_root():
    return {"Clothing Stylist"}


@app.get("/clothing")
async def get_clothing():
    conn = sql.connect("clothing.db")
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
            "color": row[3].split(","),
            "minor_color": row[4].split(",") if row[4] else [],
            "season": row[5].split(","),
            "occasion": row[6].split(","),
            "fit": row[7],
            "sleeve_length": row[8],
            "bottom_style": row[9]
        }
        for row in items
    ]


@app.post("/upload")
async def upload_clothing(
    file: UploadFile = File(...),
    type: str = Form(...),
    majorColors: List[str] = Form(...),
    minorColors: Optional[List[str]] = Form(None),
    season: List[str] = Form(...),
    occasion: List[str] = Form(...),
    fit: str = Form(...),
    sleeveLength: Optional[str] = Form(None),
    bottomStyle: Optional[str] = Form(None)
):
    clothing_type = (type or "").strip().lower()

    valid_types = {"top", "bottom", "layer", "top_layer"}
    if clothing_type not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid clothing type.")

    needs_sleeve_length = clothing_type in {"top", "layer", "top_layer"}
    valid_sleeve_lengths = {"short_sleeve", "long_sleeve"}
    if needs_sleeve_length:
        if sleeveLength not in valid_sleeve_lengths:
            raise HTTPException(
                status_code=400,
                detail="Sleeve length must be short_sleeve or long_sleeve for tops/layers."
            )
    else:
        sleeveLength = None

    needs_bottom_style = clothing_type == "bottom"
    valid_bottom_styles = {"shorts", "pants"}
    if needs_bottom_style:
        if bottomStyle not in valid_bottom_styles:
            raise HTTPException(
                status_code=400,
                detail="Bottom style must be shorts or pants for bottoms."
            )
    else:
        bottomStyle = None

    result = process_and_save_image(file)
    image_path = result["image_path"]

    color = ",".join(majorColors)
    minor_color = ",".join(minorColors) if minorColors else ""
    season = ",".join(season)
    occasion = ",".join(occasion)
    fit = fit

    conn = sql.connect("clothing.db")
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO clothing (type, image_path, color, minor_color, season, occasion, fit, sleeve_length, bottom_style)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (clothing_type, image_path, color, minor_color, season, occasion, fit, sleeveLength, bottomStyle)
    )
    conn.commit()
    clothing_id = cursor.lastrowid
    conn.close()

    return {
        "id": clothing_id,
        "type": clothing_type,
        "image_path": image_path,
        "color": color.split(",") if color else [],
        "minor_color": minor_color.split(",") if minor_color else [],
        "season": season.split(",") if season else [],
        "occasion": occasion.split(",") if occasion else [],
        "fit": fit,
        "sleeve_length": sleeveLength,
        "bottom_style": bottomStyle
    }


@app.delete("/clothing/{clothing_id}")
async def delete_clothing(clothing_id: int):
    status = "unknown_error"
    conn = sql.connect("clothing.db")

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
                # Keep deletion constrained to the storage directory.
                image_file = Path("storage") / Path(image_path).name
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
        "status": status
    }


@app.get("/generate-outfit")
async def generate_outfit(
    selected_outer: Optional[int] = None,
    selected_top: Optional[int] = None,
    selected_bottom: Optional[int] = None,
    top_n: int = 3,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
):
    selected_sections = {
        "outer": selected_outer,
        "top": selected_top,
        "bottom": selected_bottom
    }
    return generate_outfit_payload(
        selected_sections=selected_sections,
        top_n=top_n,
        latitude=latitude,
        longitude=longitude,
    )


