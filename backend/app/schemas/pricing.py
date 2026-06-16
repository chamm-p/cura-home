"""Schemas für die Preis-Indikation."""

from pydantic import BaseModel, Field


class PriceEstimateIn(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    description: str | None = None


class PriceEstimateOut(BaseModel):
    price: float | None
    currency: str
    sources: list[str] = []
    mode: str
    note: str | None = None


class PricingStatus(BaseModel):
    available: bool
    mode: str
    backend: str | None = None
    search_provider: str = "none"
