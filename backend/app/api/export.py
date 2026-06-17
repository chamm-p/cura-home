"""Export API — Inventarliste als PDF (mit Summe je Bereich + Total)."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_house, get_current_user
from app.database import get_db
from app.models.area import Area
from app.models.house import House
from app.models.item import Item
from app.models.user import User
from app.services import pdf

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/pdf")
async def export_pdf(
    db: AsyncSession = Depends(get_db),
    house: House = Depends(get_current_house),
    _: User = Depends(get_current_user),
    area_id: uuid.UUID | None = Query(default=None),
    uncatalogued: bool = Query(default=False),
    no_price: bool = Query(default=False),
):
    stmt = (
        select(Item).where(Item.house_id == house.id).options(selectinload(Item.photos))
    )
    if area_id is not None:
        stmt = stmt.where(Item.area_id == area_id)
    if uncatalogued:
        stmt = stmt.where(Item.is_catalogued.is_(False))
    if no_price:
        stmt = stmt.where(Item.price_new.is_(None))
    items = list(await db.scalars(stmt))

    area_names = {
        a.id: a.name
        for a in await db.scalars(select(Area).where(Area.house_id == house.id))
    }

    # Nach Bereich gruppieren (wie im UI: „Ohne Bereich" zuletzt).
    buckets: dict[uuid.UUID | None, list[Item]] = {}
    for it in items:
        buckets.setdefault(it.area_id, []).append(it)

    groups = []
    for aid, its in buckets.items():
        its.sort(key=lambda i: (i.name or "").lower())
        groups.append(
            {
                "name": (area_names.get(aid) if aid else None) or "Ohne Bereich",
                "items": its,
                "count": len(its),
                "sum": sum(float(i.price_new) for i in its if i.price_new is not None),
            }
        )
    groups.sort(key=lambda g: (g["name"] == "Ohne Bereich", g["name"].lower()))

    total = sum(g["sum"] for g in groups)
    total_count = len(items)

    parts = []
    if area_id is not None:
        parts.append(f"Bereich: {area_names.get(area_id, 'unbekannt')}")
    if uncatalogued:
        parts.append("nur unkatalogisierte")
    if no_price:
        parts.append("nur ohne Preis")
    filter_note = "Gefiltert: " + ", ".join(parts) if parts else None

    html = pdf.inventory_html(
        house_name=house.name,
        currency=house.currency,
        groups=groups,
        total=total,
        total_count=total_count,
        filter_note=filter_note,
        generated_at=datetime.now(timezone.utc),
    )
    content = pdf.render_pdf(html)
    filename = f"inventar-{house.name}.pdf".replace(" ", "_")
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
