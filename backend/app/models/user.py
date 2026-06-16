"""User model — OIDC-authenticated users only."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(150))
    oidc_subject: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e]),
        default=UserRole.USER,
    )
    first_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role.value})>"
