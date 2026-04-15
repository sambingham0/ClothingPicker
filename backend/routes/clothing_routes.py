from typing import List, Optional

from fastapi import APIRouter, File, Form, UploadFile

from services.clothing_service import (
    create_clothing_item,
    delete_clothing_item,
    generate_outfit,
    list_clothing_items,
)

router = APIRouter()


@router.get("/clothing")
async def get_clothing():
    return list_clothing_items()


@router.post("/upload")
async def upload_clothing(
    file: UploadFile = File(...),
    type: str = Form(...),
    majorColors: List[str] = Form(...),
    minorColors: Optional[List[str]] = Form(None),
    season: List[str] = Form(...),
    occasion: List[str] = Form(...),
    fit: str = Form(...),
    sleeveLength: Optional[str] = Form(None),
    bottomStyle: Optional[str] = Form(None),
):
    return create_clothing_item(
        file=file,
        clothing_type=type,
        major_colors=majorColors,
        minor_colors=minorColors,
        seasons=season,
        occasions=occasion,
        fit=fit,
        sleeve_length=sleeveLength,
        bottom_style=bottomStyle,
    )


@router.delete("/clothing/{clothing_id}")
async def delete_clothing(clothing_id: int):
    return delete_clothing_item(clothing_id)


@router.get("/generate-outfit")
async def generate_outfit_route(
    selected_outer: Optional[int] = None,
    selected_top: Optional[int] = None,
    selected_bottom: Optional[int] = None,
    top_n: int = 3,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
):
    return generate_outfit(
        selected_outer=selected_outer,
        selected_top=selected_top,
        selected_bottom=selected_bottom,
        top_n=top_n,
        latitude=latitude,
        longitude=longitude,
    )
