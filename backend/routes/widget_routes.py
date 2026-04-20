import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from scoring.weather_score import fetch_current_weather
from services.spotify_control_service import execute_spotify_control_action
from services.spotify_widget_payload_service import fetch_spotify_widget_payload

router = APIRouter()


class SpotifyControlRequest(BaseModel):
    action: str
    volumePercent: Optional[int] = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@router.get("/widgets/weather")
async def get_weather_widget(latitude: Optional[float] = None, longitude: Optional[float] = None):
    weather = await asyncio.to_thread(fetch_current_weather, latitude, longitude)
    return {
        "requestedAtUtc": _utc_now_iso(),
        "weather": weather,
    }


@router.get("/widgets/spotify")
async def get_spotify_widget():
    return await asyncio.to_thread(fetch_spotify_widget_payload)


@router.post("/widgets/spotify/control")
async def post_spotify_control(payload: SpotifyControlRequest):
    response_body, status_code = await asyncio.to_thread(
        execute_spotify_control_action,
        payload.action,
        payload.volumePercent,
    )
    return JSONResponse(content=response_body, status_code=status_code)
