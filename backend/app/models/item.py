"""Item model — Inventarobjekte."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PriceSource(str, enum.Enum):
    MANUAL = "manual"
    LLM = "llm"
    WEBSEARCH = "websearch"


class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    house_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    area_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("areas.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Grobe Objektart (Möbel, Technik, …) — vom Vision-LLM vorgeschlagen.
    category: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_new: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    price_source: Mapped[PriceSource | None] = mapped_column(
        Enum(
            PriceSource,
            name="price_source",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=True,
    )
    # Wann der Neupreis ermittelt wurde (ein Preis altert — heute ≠ in 5 Jahren).
    price_determined_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Explizites Katalogisiert-Flag: gesetzt, sobald der Nutzer das Objekt
    # benannt/bestätigt hat. Frisch fotografierte Objekte sind unkatalogisiert.
    is_catalogued: Mapped[bool] = mapped_column(Boolean, default=False)
    # Custom-Field-Werte als JSONB (field-key → value). Checkbox: bool, Text: str.
    custom_values: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # onupdate als Python-Callable (nicht func.now()): so kennt SQLAlchemy den
    # neuen Wert direkt nach dem UPDATE und expired ihn nicht — sonst triggert
    # der Zugriff in _item_out ein Lazy-Reload (MissingGreenlet) im async-Kontext.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    area: Mapped["Area | None"] = relationship(back_populates="items")  # noqa: F821
    photos: Mapped[list["ItemPhoto"]] = relationship(  # noqa: F821
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="ItemPhoto.created_at",
    )

    def __repr__(self) -> str:
        return f"<Item {self.name or '(unbenannt)'}>"
