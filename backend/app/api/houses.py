"""Houses API — Häuser anlegen/teilen (Owner verwaltet Mitglieder)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.house import House, HouseMember, HouseRole
from app.models.user import User
from app.schemas.house import (
    AddMemberIn,
    HouseIn,
    HouseMemberOut,
    HouseOut,
    HouseUpdate,
)
from app.services import houses as houses_svc

router = APIRouter(prefix="/api/houses", tags=["houses"])


async def _house_out(db: AsyncSession, house: House, user_id: uuid.UUID) -> HouseOut:
    count = await db.scalar(
        select(func.count(HouseMember.id)).where(HouseMember.house_id == house.id)
    )
    role = HouseRole.OWNER.value if house.owner_id == user_id else HouseRole.MEMBER.value
    return HouseOut(
        id=house.id,
        name=house.name,
        owner_id=house.owner_id,
        role=role,
        is_owner=house.owner_id == user_id,
        member_count=int(count or 0),
    )


@router.get("", response_model=list[HouseOut])
async def list_houses(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """Alle Häuser, in denen der User Mitglied ist."""
    houses = list(
        await db.scalars(
            select(House)
            .join(HouseMember, HouseMember.house_id == House.id)
            .where(HouseMember.user_id == user.id)
            .order_by(House.created_at)
        )
    )
    # Sicherstellen, dass jeder User mindestens ein Haus hat.
    if not houses:
        houses = [await houses_svc.ensure_default_house(db, user)]
    return [await _house_out(db, h, user.id) for h in houses]


@router.post("", response_model=HouseOut, status_code=201)
async def create_house(
    body: HouseIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    house = House(name=body.name.strip(), owner_id=user.id)
    db.add(house)
    await db.flush()
    db.add(HouseMember(house_id=house.id, user_id=user.id, role=HouseRole.OWNER))
    await db.flush()
    return await _house_out(db, house, user.id)


@router.put("/{house_id}", response_model=HouseOut)
async def update_house(
    house_id: uuid.UUID,
    body: HouseUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    house = await houses_svc.require_owner(db, house_id, user)
    house.name = body.name.strip()
    await db.flush()
    return await _house_out(db, house, user.id)


@router.delete("/{house_id}", status_code=204)
async def delete_house(
    house_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Owner-only. Kaskade löscht Mitglieder, Bereiche und Objekte des Hauses.
    house = await houses_svc.require_owner(db, house_id, user)
    await db.delete(house)
    await db.flush()
    return None


# ─── Mitglieder ───
@router.get("/{house_id}/members", response_model=list[HouseMemberOut])
async def list_members(
    house_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    house = await houses_svc.require_member(db, house_id, user)
    rows = await db.execute(
        select(HouseMember, User)
        .join(User, User.id == HouseMember.user_id)
        .where(HouseMember.house_id == house_id)
        .order_by(HouseMember.created_at)
    )
    out = []
    for member, u in rows.all():
        out.append(
            HouseMemberOut(
                user_id=u.id,
                email=u.email,
                name=u.full_name or u.username,
                role=member.role.value,
                is_owner=u.id == house.owner_id,
            )
        )
    return out


@router.post("/{house_id}/members", response_model=HouseMemberOut, status_code=201)
async def add_member(
    house_id: uuid.UUID,
    body: AddMemberIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mitglied per E-Mail hinzufügen (Owner-only). User muss bereits existieren."""
    await houses_svc.require_owner(db, house_id, user)
    email = body.email.strip().lower()
    target = await db.scalar(select(User).where(func.lower(User.email) == email))
    if not target:
        raise HTTPException(
            404,
            "Kein Benutzer mit dieser E-Mail gefunden. Die Person muss sich zuerst "
            "einmal anmelden.",
        )
    if await houses_svc.get_membership(db, house_id, target.id):
        raise HTTPException(409, "Diese Person ist bereits Mitglied")
    db.add(HouseMember(house_id=house_id, user_id=target.id, role=HouseRole.MEMBER))
    await db.flush()
    return HouseMemberOut(
        user_id=target.id,
        email=target.email,
        name=target.full_name or target.username,
        role=HouseRole.MEMBER.value,
        is_owner=False,
    )


@router.delete("/{house_id}/members/{member_user_id}", status_code=204)
async def remove_member(
    house_id: uuid.UUID,
    member_user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mitglied entfernen — Owner-only, oder Selbst-Austritt. Owner unentfernbar."""
    house = await db.get(House, house_id)
    if not house:
        raise HTTPException(404, "Haus nicht gefunden")
    is_self = member_user_id == user.id
    if not is_self and house.owner_id != user.id:
        raise HTTPException(403, "Nur der Eigentümer darf Mitglieder entfernen")
    if member_user_id == house.owner_id:
        raise HTTPException(400, "Der Eigentümer kann nicht entfernt werden")
    membership = await houses_svc.get_membership(db, house_id, member_user_id)
    if not membership:
        raise HTTPException(404, "Mitglied nicht gefunden")
    await db.delete(membership)
    await db.flush()
    return None
