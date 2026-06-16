"""Settings API — LLM-Backends + System-Key-Value (Admin)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_admin_user, get_current_user
from app.core.security import encrypt_value
from app.database import get_db
from app.models.llm_backend import LlmBackend
from app.models.user import User
from app.schemas.settings import (
    LlmBackendIn,
    LlmBackendOut,
    LlmBackendUpdate,
    SearchConfigIn,
    SearchConfigOut,
    SettingValue,
)
from app.services import settings_store
from app.services.llm import LlmError, chat_completion

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _backend_out(b: LlmBackend) -> LlmBackendOut:
    return LlmBackendOut(
        id=b.id,
        name=b.name,
        api_base_url=b.api_base_url,
        model_id=b.model_id,
        capabilities=b.capabilities or {},
        is_active=b.is_active,
        has_api_key=bool(b.api_key_encrypted),
    )


# ─── LLM-Backends ───
@router.get("/llm-backends", response_model=list[LlmBackendOut])
async def list_backends(
    db: AsyncSession = Depends(get_db), _: User = Depends(get_admin_user)
):
    rows = await db.scalars(select(LlmBackend).order_by(LlmBackend.name))
    return [_backend_out(b) for b in rows]


@router.post("/llm-backends", response_model=LlmBackendOut, status_code=201)
async def create_backend(
    body: LlmBackendIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    b = LlmBackend(
        name=body.name.strip(),
        api_base_url=body.api_base_url.strip(),
        api_key_encrypted=encrypt_value(body.api_key) if body.api_key else None,
        model_id=body.model_id.strip(),
        capabilities={
            "supports_vision": body.supports_vision,
            "supports_tools": body.supports_tools,
        },
        is_active=body.is_active,
    )
    db.add(b)
    await db.flush()
    return _backend_out(b)


@router.put("/llm-backends/{backend_id}", response_model=LlmBackendOut)
async def update_backend(
    backend_id: uuid.UUID,
    body: LlmBackendUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    b = await db.get(LlmBackend, backend_id)
    if not b:
        raise HTTPException(404, "Backend nicht gefunden")
    if body.name is not None:
        b.name = body.name.strip()
    if body.api_base_url is not None:
        b.api_base_url = body.api_base_url.strip()
    # api_key: nur überschreiben, wenn ein neuer (nicht-leerer) Wert kommt.
    if body.api_key:
        b.api_key_encrypted = encrypt_value(body.api_key)
    if body.model_id is not None:
        b.model_id = body.model_id.strip()
    caps = dict(b.capabilities or {})
    if body.supports_vision is not None:
        caps["supports_vision"] = body.supports_vision
    if body.supports_tools is not None:
        caps["supports_tools"] = body.supports_tools
    b.capabilities = caps
    if body.is_active is not None:
        b.is_active = body.is_active
    await db.flush()
    return _backend_out(b)


@router.delete("/llm-backends/{backend_id}", status_code=204)
async def delete_backend(
    backend_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    b = await db.get(LlmBackend, backend_id)
    if not b:
        raise HTTPException(404, "Backend nicht gefunden")
    await db.delete(b)
    await db.flush()
    return None


@router.post("/llm-backends/{backend_id}/test")
async def test_backend(
    backend_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Kleiner Ping-Call gegen das Backend, um Erreichbarkeit/Key zu prüfen."""
    b = await db.get(LlmBackend, backend_id)
    if not b:
        raise HTTPException(404, "Backend nicht gefunden")
    try:
        data = await chat_completion(
            b,
            [{"role": "user", "content": "Antworte nur mit: OK"}],
            max_tokens=5,
            timeout=30.0,
        )
        from app.services.llm import first_message_content

        return {"ok": True, "sample": first_message_content(data)[:100]}
    except LlmError as e:
        return {"ok": False, "error": str(e)}


# ─── System-Key-Value (vision_config, pricing_config, label_config …) ───
@router.get("/kv/{key}", response_model=SettingValue)
async def get_kv(
    key: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return SettingValue(value=await settings_store.get_setting(db, key))


@router.put("/kv/{key}", response_model=SettingValue)
async def put_kv(
    key: str,
    body: SettingValue,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    value = await settings_store.set_setting(db, key, body.value, actor_id=admin.id)
    return SettingValue(value=value)


# ─── Such-Provider (Preisrecherche: SearXNG / Tavily) ───
@router.get("/search", response_model=SearchConfigOut)
async def get_search_config(
    db: AsyncSession = Depends(get_db), _: User = Depends(get_admin_user)
):
    cfg = await settings_store.get_setting(db, "search_config")
    return SearchConfigOut(
        provider=cfg.get("provider", "none"),
        searxng_url=cfg.get("searxng_url"),
        has_tavily_key=bool(cfg.get("tavily_api_key_encrypted")),
    )


@router.put("/search", response_model=SearchConfigOut)
async def put_search_config(
    body: SearchConfigIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    existing = await settings_store.get_setting(db, "search_config")
    # Tavily-Key nur überschreiben, wenn ein neuer (nicht-leerer) Wert kommt.
    enc = existing.get("tavily_api_key_encrypted")
    if body.tavily_api_key:
        enc = encrypt_value(body.tavily_api_key)
    value = {
        "provider": body.provider,
        "searxng_url": (body.searxng_url or "").strip() or None,
    }
    if enc:
        value["tavily_api_key_encrypted"] = enc
    await settings_store.set_setting(db, "search_config", value, actor_id=admin.id)
    return SearchConfigOut(
        provider=value["provider"],
        searxng_url=value.get("searxng_url"),
        has_tavily_key=bool(enc),
    )
