import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent


def _resolve_path(env_name: str, default_path: Path) -> Path:
    raw_value = os.getenv(env_name)
    if not raw_value:
        return default_path

    candidate = Path(raw_value).expanduser()
    if not candidate.is_absolute():
        candidate = (BASE_DIR / candidate).resolve()

    return candidate


CLOTHING_DB_PATH = _resolve_path("CLOTHING_DB_PATH", BASE_DIR / "clothing.db")
CLOTHING_STORAGE_DIR = _resolve_path("CLOTHING_STORAGE_DIR", BASE_DIR / "storage")


def ensure_runtime_paths() -> None:
    CLOTHING_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    CLOTHING_STORAGE_DIR.mkdir(parents=True, exist_ok=True)