"""Area model — Hausbereiche (Küche, Flur, Schlafzimmer …)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Area(Base):
    __tablename__ = "areas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    house_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    items: Mapped[list["Item"]] = relationship(  # noqa: F821
        back_populates="area", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Area {self.name}>"
