"""LLM-Backend — OpenAI-kompatibler Endpunkt für Vision + Preis-Indikation.

Der API-Key wird Fernet-verschlüsselt abgelegt (``api_key_encrypted``),
nie im Klartext und nie ans Frontend ausgeliefert.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LlmBackend(Base):
    __tablename__ = "llm_backends"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # z.B. "https://api.openai.com/v1" oder "http://localhost:8000/v1"
    api_base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    api_key_encrypted: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    model_id: Mapped[str] = mapped_column(String(200), nullable=False)
    # capabilities: { supports_vision: bool, supports_tools: bool }
    capabilities: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<LlmBackend {self.name} ({self.model_id})>"
