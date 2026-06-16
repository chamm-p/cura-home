"""Helper für system_settings (key→JSONB) und LLM-Backend-Auswahl."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_backend import LlmBackend
from app.models.system_setting import SystemSetting


async def get_setting(db: AsyncSession, key: str) -> dict:
    row = await db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    if row is None or not isinstance(row.value, dict):
        return {}
    return row.value


async def set_setting(
    db: AsyncSession, key: str, value: dict, *, actor_id: uuid.UUID | None = None
) -> dict:
    row = await db.scalar(select(SystemSetting).where(SystemSetting.key == key))
    if row is None:
        row = SystemSetting(key=key, value=value, updated_by=actor_id)
        db.add(row)
    else:
        row.value = value
        if actor_id is not None:
            row.updated_by = actor_id
    await db.flush()
    return value


async def get_active_backends(db: AsyncSession) -> list[LlmBackend]:
    rows = await db.scalars(
        select(LlmBackend).where(LlmBackend.is_active.is_(True)).order_by(LlmBackend.name)
    )
    return list(rows)


async def pick_backend(
    db: AsyncSession, *, config_key: str, require_vision: bool = False
) -> LlmBackend | None:
    """Wählt das Backend für einen Zweck (vision/pricing).

    Reihenfolge: explizit in der Config gesetztes Backend → erstes aktives mit
    passender Capability → erstes aktives überhaupt.
    """
    cfg = await get_setting(db, config_key)
    bid = cfg.get("backend_id")
    if bid:
        try:
            b = await db.get(LlmBackend, uuid.UUID(str(bid)))
        except (ValueError, TypeError):
            b = None
        if b and b.is_active:
            return b

    active = await get_active_backends(db)
    if require_vision:
        for b in active:
            if (b.capabilities or {}).get("supports_vision"):
                return b
    return active[0] if active else None
