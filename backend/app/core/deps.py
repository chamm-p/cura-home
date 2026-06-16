"""FastAPI dependencies — current user / admin gating."""

import uuid

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.database import get_db
from app.models.user import User, UserRole


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    sub = payload.get("sub")
    try:
        user_id = uuid.UUID(str(sub))
    except (ValueError, TypeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token subject")
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found / inactive")
    return user


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")
    return user


async def get_current_house(
    x_house_id: str | None = Header(default=None, alias="X-House-Id"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aktives Haus aus dem X-House-Id-Header (mit Mitgliedschaftsprüfung).

    Ohne Header → Standard-Haus des Users (wird bei Bedarf angelegt).
    """
    from app.services import houses

    if x_house_id:
        try:
            house_id = uuid.UUID(x_house_id)
        except (ValueError, TypeError):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ungültige House-Id")
        return await houses.require_member(db, house_id, user)
    return await houses.ensure_default_house(db, user)
