"""Custom-Field definitions — administrierbare Zusatzfelder.

Werte werden direkt am Item in ``items.custom_values`` (JSONB, key→value)
gehalten; hier liegen nur die Definitionen (Label, Typ, Reihenfolge).
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FieldType(str, enum.Enum):
    CHECKBOX = "checkbox"
    TEXT = "text"


class CustomFieldDef(Base):
    __tablename__ = "custom_field_defs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Stabiler Key, unter dem der Wert in items.custom_values liegt.
    key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    field_type: Mapped[FieldType] = mapped_column(
        Enum(
            FieldType,
            name="custom_field_type",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=FieldType.TEXT,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# Hinweis: CustomFieldValue als eigene Tabelle wäre normalisierter, aber für
# wenige Felder pro Item ist JSONB am Item einfacher und reicht. Klasse bleibt
# als Platzhalter, falls später Normalisierung gewünscht ist.
class CustomFieldValue(Base):
    __tablename__ = "custom_field_values"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.id", ondelete="CASCADE"),
        primary_key=True,
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_field_defs.id", ondelete="CASCADE"),
        primary_key=True,
    )
    value: Mapped[str | None] = mapped_column(String(2000), nullable=True)
