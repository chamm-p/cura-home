"""Areas API — Hausbereiche CRUD (auf das aktive Haus gescopet)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_house, get_current_user
from app.database import get_db
from app.models.area import Area
from app.models.house import House
from app.models.user import User
from app.schemas.inventory import AreaIn, AreaOut, AreaUpdate
from app.services import houses as houses_svc

router = APIRouter(prefix="/api/areas", tags=["areas"])


@router.get("", response_model=list[AreaOut])
async def list_areas(
    db: AsyncSession = Depends(get_db),
    house: House = Depends(get_current_house),
    _: User = Depends(get_current_user),
):
    rows = await db.scalars(
        select(Area).where(Area.house_id == house.id).order_by(Area.sort_order, Area.name)
    )
    return list(rows)


@router.post("", response_model=AreaOut, status_code=201)
async def create_area(
    body: AreaIn,
    db: AsyncSession = Depends(get_db),
    house: House = Depends(get_current_house),
    _: User = Depends(get_current_user),
):
    area = Area(name=body.name.strip(), sort_order=body.sort_order, house_id=house.id)
    db.add(area)
    await db.flush()
    return area


@router.put("/{area_id}", response_model=AreaOut)
async def update_area(
    area_id: uuid.UUID,
    body: AreaUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    area = await db.get(Area, area_id)
    if not area:
        raise HTTPException(404, "Bereich nicht gefunden")
    await houses_svc.require_member(db, area.house_id, user)
    if body.name is not None:
        area.name = body.name.strip()
    if body.sort_order is not None:
        area.sort_order = body.sort_order
    await db.flush()
    return area


@router.delete("/{area_id}", status_code=204)
async def delete_area(
    area_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    area = await db.get(Area, area_id)
    if not area:
        raise HTTPException(404, "Bereich nicht gefunden")
    await houses_svc.require_member(db, area.house_id, user)
    # Objekte bleiben erhalten (area_id → NULL), bleiben aber im Haus.
    await db.delete(area)
    await db.flush()
    return None
