from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app_config import BASE_DIR, CLOTHING_STORAGE_DIR, ensure_runtime_paths
from db.create_db import create_clothing_db
from routes.assistant_routes import router as assistant_router
from routes.clothing_routes import router as clothing_router
from routes.widget_routes import router as widget_router

FRONTEND_DIR = BASE_DIR.parent / "frontend"

ensure_runtime_paths()

app = FastAPI()
app.mount("/images", StaticFiles(directory=str(CLOTHING_STORAGE_DIR)), name="images")

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
    ensure_runtime_paths()
    create_clothing_db()


@app.get("/")
def read_root():
    return RedirectResponse(url="/dashboard/index.html")


app.include_router(assistant_router)
app.include_router(widget_router)
app.include_router(clothing_router)

app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
