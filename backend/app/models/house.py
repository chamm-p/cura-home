"""House model — Haus/Wohnung als geteilter Inventar-Container.

Bereiche und Objekte gehören zu einem Haus. Ein Haus wird von einem User
angelegt (owner) und kann mit weiteren Usern geteilt werden; alle Mitglieder
haben gleiche Rechte am Inventar, nur der Owner verwaltet Mitgliedschaft und
kann das Haus umbenennen/löschen. Muster aus curai (Workspaces).
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class HouseRole(str, enum.Enum):
    OWNER = "owner"
    MEMBER = "member"


class House(Base):
    __tablename__ = "houses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # ISO-4217-Währungscode, gilt für alle Preise/Summen des Hauses.
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="EUR", server_default="EUR"
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    members: Mapped[list["HouseMember"]] = relationship(
        back_populates="house", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<House {self.name}>"


class HouseMember(Base):
    __tablename__ = "house_members"
    __table_args__ = (
        UniqueConstraint("house_id", "user_id", name="uq_house_members_house_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    house_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("houses.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[HouseRole] = mapped_column(
        Enum(HouseRole, name="house_role", values_callable=lambda e: [m.value for m in e]),
        default=HouseRole.MEMBER,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    house: Mapped["House"] = relationship(back_populates="members")
