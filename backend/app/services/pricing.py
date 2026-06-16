"""Preis-Indikation — Neupreis-Schätzung via LLM (optional mit Websuche)."""

from __future__ import annotations

import logging
import re

from json_repair import repair_json

from app.models.llm_backend import LlmBackend
from app.services.llm import LlmError, chat_completion, first_message_content

logger = logging.getLogger(__name__)


def _coerce_price(v) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace(",", ".")
    m = re.search(r"\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


def _coerce_sources(v) -> list[str]:
    if not v:
        return []
    if isinstance(v, str):
        return [v]
    if isinstance(v, (list, tuple)):
        return [str(x) for x in v if x][:8]
    return []


async def estimate(
    backend: LlmBackend,
    name: str,
    currency: str,
    mode: str,
    description: str | None = None,
) -> dict:
    """Liefert {price, currency, sources, mode, note}. Wirft LlmError."""
    ctx = f" Zusatzinfo: {description}." if description else ""

    if mode == "websearch":
        system = (
            "Du recherchierst den aktuellen Neupreis (Anschaffungspreis fabrikneu) "
            "von Haushaltsgegenständen und nennst, wenn möglich, Quellen-URLs."
        )
        user = (
            f"Ermittle den aktuellen Neupreis von: {name}.{ctx} "
            f"Nutze deine Web-/Such-Fähigkeiten, falls vorhanden. "
            f'Antworte AUSSCHLIESSLICH als JSON in {currency}: '
            f'{{"price": <Zahl>, "currency": "{currency}", '
            f'"sources": ["<url>", ...], "note": "<kurzer Hinweis>"}}'
        )
    else:
        system = (
            "Du schätzt aus deinem Wissen den ungefähren Neupreis (fabrikneu) "
            "von Haushaltsgegenständen."
        )
        user = (
            f"Schätze den ungefähren Neupreis von: {name}.{ctx} "
            f'Antworte AUSSCHLIESSLICH als JSON in {currency}: '
            f'{{"price": <Zahl>, "currency": "{currency}", '
            f'"sources": [], "note": "Schätzung ohne Websuche"}}'
        )

    data = await chat_completion(
        backend,
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=500,
        temperature=0.2,
    )
    content = first_message_content(data).strip()
    if not content:
        raise LlmError("LLM lieferte leere Antwort")

    cleaned = content.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        parsed = repair_json(cleaned, return_objects=True)
    except Exception:  # noqa: BLE001
        parsed = {}
    if not isinstance(parsed, dict):
        parsed = {}

    return {
        "price": _coerce_price(parsed.get("price")),
        "currency": currency,
        "sources": _coerce_sources(parsed.get("sources")),
        "mode": mode,
        "note": (parsed.get("note") or "").strip()[:300] or None,
    }
