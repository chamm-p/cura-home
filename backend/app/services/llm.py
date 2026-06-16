"""Minimaler OpenAI-kompatibler Chat-Client (Vision + Tools).

Spricht den /chat/completions-Endpunkt eines beliebigen OpenAI-kompatiblen
Backends an (OpenAI, vLLM, Ollama, …). Der API-Key liegt Fernet-verschlüsselt
am LlmBackend und wird nur hier in-memory entschlüsselt.
"""

from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from app.core.security import decrypt_value
from app.models.llm_backend import LlmBackend

logger = logging.getLogger(__name__)


class LlmError(RuntimeError):
    """Fehler beim LLM-Aufruf (HTTP, Timeout, Parsing)."""


def image_data_url(image_bytes: bytes, mime: str) -> str:
    b64 = base64.b64encode(image_bytes).decode()
    return f"data:{mime};base64,{b64}"


def image_part(image_bytes: bytes, mime: str) -> dict[str, Any]:
    return {"type": "image_url", "image_url": {"url": image_data_url(image_bytes, mime)}}


async def chat_completion(
    backend: LlmBackend,
    messages: list[dict[str, Any]],
    *,
    temperature: float = 0.2,
    max_tokens: int = 512,
    tools: list | None = None,
    tool_choice: Any = None,
    timeout: float = 90.0,
) -> dict[str, Any]:
    base = backend.api_base_url.rstrip("/")
    key = decrypt_value(backend.api_key_encrypted) if backend.api_key_encrypted else None

    payload: dict[str, Any] = {
        "model": backend.model_id,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools:
        payload["tools"] = tools
    if tool_choice is not None:
        payload["tool_choice"] = tool_choice

    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{base}/chat/completions", json=payload, headers=headers
            )
    except httpx.HTTPError as e:
        raise LlmError(f"LLM-Backend nicht erreichbar: {e}") from e

    if resp.status_code >= 400:
        logger.error("LLM-Call %s fehlgeschlagen (%s): %s", base, resp.status_code, resp.text[:300])
        raise LlmError(f"LLM-Backend-Fehler ({resp.status_code})")
    return resp.json()


def first_message_content(data: dict[str, Any]) -> str:
    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError):
        return ""


async def list_models(api_base_url: str, api_key: str | None) -> list[str]:
    """Holt die verfügbaren Modell-IDs vom OpenAI-kompatiblen /models-Endpunkt."""
    base = api_base_url.rstrip("/")
    headers = {"Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(f"{base}/models", headers=headers)
    except httpx.HTTPError as e:
        raise LlmError(f"Endpunkt nicht erreichbar: {e}") from e
    if resp.status_code >= 400:
        raise LlmError(f"/models-Abfrage fehlgeschlagen ({resp.status_code})")
    try:
        data = resp.json()
    except ValueError as e:
        raise LlmError("Ungültige Antwort vom /models-Endpunkt") from e

    # OpenAI: {"data": [{"id": ...}]}; manche liefern {"models": [...]} oder Strings.
    items = data.get("data") or data.get("models") or []
    ids: list[str] = []
    for m in items:
        if isinstance(m, dict):
            mid = m.get("id") or m.get("name") or m.get("model")
            if mid:
                ids.append(str(mid))
        elif isinstance(m, str):
            ids.append(m)
    return sorted(set(ids))
