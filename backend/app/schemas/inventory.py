"""Pydantic-Schemas für Bereiche und Inventarobjekte."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ─── Areas ───
class AreaIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    sort_order: int = 0


class AreaUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    sort_order: int | None = None


class AreaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    sort_order: int


# ─── Photos ───
class PhotoOut(BaseModel):
    id: uuid.UUID
    url: str
    thumb_url: str
    is_primary: bool


# ─── Items ───
class ItemIn(BaseModel):
    area_id: uuid.UUID | None = None
    name: str | None = Field(default=None, max_length=300)
    category: str | None = Field(default=None, max_length=40)
    description: str | None = None
    price_new: float | None = None
    is_catalogued: bool | None = None
    for_sale: bool | None = None
    for_disposal: bool | None = None
    needs_verification: bool | None = None
    custom_values: dict | None = None


class ItemUpdate(ItemIn):
    pass


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    area_id: uuid.UUID | None
    name: str | None
    category: str | None
    description: str | None
    price_new: float | None
    price_source: str | None
    price_determined_at: datetime | None = None
    is_catalogued: bool
    for_sale: bool
    for_disposal: bool
    needs_verification: bool
    custom_values: dict
    created_at: datetime
    updated_at: datetime
    photos: list[PhotoOut] = []


class ProcessRequest(BaseModel):
    item_ids: list[uuid.UUID]


class ProcessResult(BaseModel):
    scheduled: int


class AreaSummary(BaseModel):
    area_id: uuid.UUID | None
    area_name: str
    item_count: int
    total_price: float
    items_without_price: int


class InventorySummary(BaseModel):
    by_area: list[AreaSummary]
    total_price: float
    total_items: int
