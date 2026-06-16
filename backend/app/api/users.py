"""User API — current user."""

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
