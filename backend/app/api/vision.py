"""Vision API — Objekterkennung auf einem Foto (ohne Speichern)."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import settings_store, vision
from app.services.llm import LlmError

router = APIRouter(prefix="/api/vision", tags=["vision"])


@router.get("/status")
async def vision_status(
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    backend = await settings_store.pick_backend(
        db, config_key="vision_config", require_vision=True
    )
    return {"available": backend is not None, "backend": backend.name if backend else None}


@router.post("/recognize")
async def recognize(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Leere Datei")
    backend = await settings_store.pick_backend(
        db, config_key="vision_config", require_vision=True
    )
    if backend is None:
        raise HTTPException(400, "Kein Vision-Backend konfiguriert")
    try:
        return await vision.recognize(backend, data)
    except LlmError as e:
        raise HTTPException(502, str(e))
