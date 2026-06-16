"""cura-home — FastAPI application entrypoint."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.core.security import validate_secrets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cura-home")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail-fast: Secrets müssen gültig sein, bevor Requests bedient werden.
    validate_secrets()
    os.makedirs(settings.uploads_dir, exist_ok=True)
    logger.info("cura-home %s gestartet", settings.app_version)
    yield


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": settings.app_version}


# ─── Routers ───
from app.api import (  # noqa: E402
    areas,
    auth,
    houses,
    items,
    settings as settings_api,
    users,
    vision,
)

for _r in (auth, users, houses, areas, items, vision, settings_api):
    app.include_router(_r.router)

# Phase 3 — pricing, custom_fields, labels, export werden hier ergänzt.

# Hochgeladene Fotos statisch ausliefern (Thumbnails/Originale).
os.makedirs(settings.uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")
