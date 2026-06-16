"""Houses-Zugriffslogik — Mitgliedschaft, Owner-Prüfung, Default-Haus."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.house import House, HouseMember, HouseRole
from app.models.user import User


async def get_membership(
    db: AsyncSession, house_id: uuid.UUID, user_id: uuid.UUID
) -> HouseMember | None:
    return await db.scalar(
        select(HouseMember).where(
            HouseMember.house_id == house_id, HouseMember.user_id == user_id
        )
    )


async def require_member(db: AsyncSession, house_id: uuid.UUID, user: User) -> House:
    house = await db.get(House, house_id)
    if not house:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Haus nicht gefunden")
    if not await get_membership(db, house_id, user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Kein Zugriff auf dieses Haus")
    return house


async def require_owner(db: AsyncSession, house_id: uuid.UUID, user: User) -> House:
    house = await db.get(House, house_id)
    if not house:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Haus nicht gefunden")
    if house.owner_id != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Nur der Eigentümer darf das Haus verwalten"
        )
    return house


async def ensure_default_house(db: AsyncSession, user: User) -> House:
    """Liefert das Standard-Haus des Users (legt es beim ersten Mal an).

    Bevorzugt ein selbst angelegtes Haus; falls keines existiert, wird
    „Mein Zuhause" erstellt und der User als Owner-Mitglied eingetragen.
    """
    house = await db.scalar(
        select(House).where(House.owner_id == user.id).order_by(House.created_at).limit(1)
    )
    if house:
        return house
    house = House(name="Mein Zuhause", owner_id=user.id)
    db.add(house)
    await db.flush()
    db.add(HouseMember(house_id=house.id, user_id=user.id, role=HouseRole.OWNER))
    await db.flush()
    return house
