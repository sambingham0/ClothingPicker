from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import sqlite3 as sql
from db.create_db import create_clothing_db, create_outfits_db
from image_processing import process_and_save_image

app = FastAPI()

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
    create_outfits_db()

@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/clothing")
async def get_clothing():
    conn = sql.connect("clothing.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, type, image_path, color, minor_color, season, favorite FROM clothing")
    items = cursor.fetchall()
    conn.close()
    return [
        {
            "id": row[0],
            "type": row[1],
            "image_path": row[2],
            "major_colors": row[3].split(","),
            "minor_colors": row[4].split(",") if row[4] else [],
            "season": row[5].split(","),
            "favorite": bool(row[6])
        }
        for row in items
    ]


@app.get("/outfits")
async def get_outfits():
    conn = sql.connect("outfits.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, clothing_ids FROM outfits")
    items = cursor.fetchall()
    conn.close()
    # Convert to list of dicts
    return [
        {
            "id": row[0],
            "name": row[1],
            "clothing_ids": row[2]
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
    isFavorite: str = Form(...)
):
    result = process_and_save_image(file)
    image_path = result["image_path"]
    clothing_type = type
    color = ",".join(majorColors)
    minor_color = ",".join(minorColors) if minorColors else ""
    season = ",".join(season)
    favorite = 1 if isFavorite == "true" else 0

    conn = sql.connect("clothing.db")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO clothing (type, image_path, color, season, favorite, minor_color) VALUES (?, ?, ?, ?, ?, ?)",
        (clothing_type, image_path, color, season, favorite, minor_color)
    )
    conn.commit()
    clothing_id = cursor.lastrowid
    conn.close()

    return {
        "id": clothing_id,
        "type": clothing_type,
        "image_path": image_path,
        "color": color,
        "minor_color": minor_color,
        "season": season,
        "favorite": bool(favorite)
    }


@app.post("/generate-outfit")
async def generate_outfit():
    return {"message": "Outfit generation coming soon!"}


@app.post("/save-outfit")
async def save_outfit():
    return {"message": "Outfit saving coming soon!"}