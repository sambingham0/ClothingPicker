import json
from urllib.error import HTTPError, URLError

from fastapi import APIRouter, HTTPException

from services.assistant_proxy_service import proxy_assistant_json

router = APIRouter()


@router.get("/assistant/status")
async def get_assistant_status():
    try:
        return await proxy_assistant_json("/api/status")
    except (HTTPError, URLError, OSError, TimeoutError, json.JSONDecodeError) as ex:
        raise HTTPException(status_code=502, detail=f"Assistant status unavailable: {ex}")


@router.get("/assistant/logs")
async def get_assistant_logs(limit: int = 200):
    safe_limit = max(1, min(limit, 500))
    try:
        return await proxy_assistant_json(f"/api/logs?limit={safe_limit}")
    except (HTTPError, URLError, OSError, TimeoutError, json.JSONDecodeError) as ex:
        raise HTTPException(status_code=502, detail=f"Assistant logs unavailable: {ex}")
