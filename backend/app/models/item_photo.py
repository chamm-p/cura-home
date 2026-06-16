"""ItemPhoto model — Fotos eines Inventarobjekts."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ItemPhoto(Base):
    __tablename__ = "item_photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id", ondelete="CASCADE"), index=True
    )
    # Dateiname relativ zu uploads_dir (z.B. "<item_id>/<uuid>.jpg").
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    item: Mapped["Item"] = relationship(back_populates="photos")  # noqa: F821
