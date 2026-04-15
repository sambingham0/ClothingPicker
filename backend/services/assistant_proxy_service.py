import asyncio
import json
import os
from urllib.request import Request, urlopen

ASSISTANT_BASE_URL = os.getenv("VOICEASSISTANT_BASE_URL", "http://127.0.0.1:7181").rstrip("/")


def fetch_assistant_json(path: str, timeout: float = 2.0):
    request = Request(
        f"{ASSISTANT_BASE_URL}{path}",
        headers={"Accept": "application/json"},
    )

    with urlopen(request, timeout=timeout) as response:
        payload = response.read().decode("utf-8")
        return json.loads(payload) if payload.strip() else {}


async def proxy_assistant_json(path: str, timeout: float = 2.0):
    return await asyncio.to_thread(fetch_assistant_json, path, timeout)
