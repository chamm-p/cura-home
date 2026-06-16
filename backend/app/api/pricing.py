"""Pricing API — Neupreis-Indikation (LLM / LLM+Websuche)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_house, get_current_user
from app.database import get_db
from app.models.house import House
from app.models.user import User
from app.schemas.pricing import PriceEstimateIn, PriceEstimateOut, PricingStatus
from app.services import pricing, settings_store
from app.services.llm import LlmError

router = APIRouter(prefix="/api/pricing", tags=["pricing"])


@router.get("/status", response_model=PricingStatus)
async def status(
    db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)
):
    cfg = await settings_store.get_setting(db, "pricing_config")
    backend = await settings_store.pick_backend(db, config_key="pricing_config")
    return PricingStatus(
        available=backend is not None,
        mode=cfg.get("mode", "llm"),
        backend=backend.name if backend else None,
    )


@router.post("/estimate", response_model=PriceEstimateOut)
async def estimate(
    body: PriceEstimateIn,
    db: AsyncSession = Depends(get_db),
    house: House = Depends(get_current_house),
    _: User = Depends(get_current_user),
):
    cfg = await settings_store.get_setting(db, "pricing_config")
    mode = cfg.get("mode", "llm")
    backend = await settings_store.pick_backend(db, config_key="pricing_config")
    if backend is None:
        raise HTTPException(400, "Kein LLM-Backend für Preis-Indikation konfiguriert")
    try:
        result = await pricing.estimate(
            backend, body.name, house.currency, mode, body.description
        )
    except LlmError as e:
        raise HTTPException(502, str(e))
    return PriceEstimateOut(**result)
