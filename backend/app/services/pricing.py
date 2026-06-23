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


# Preisniveau-Leitlinie für die Schätzung. „premium" ist Default, weil das
# Einsatzumfeld eher hochpreisige Markenware umfasst.
TIER_GUIDANCE = {
    "value": (
        "Orientiere dich am günstigen Einstiegssegment "
        "(No-Name/Discounter sind ok)."
    ),
    "standard": (
        "Orientiere dich am mittleren Marktsegment gängiger Markenprodukte."
    ),
    "premium": (
        "Gehe von Markenqualität in gehobener Ausführung aus. Ignoriere "
        "No-Name-, Gebraucht- und Billigangebote (einfache Marktplatz-Listings) "
        "und nenne den Neupreis eines hochwertigen Markenprodukts im oberen "
        "Preissegment."
    ),
}


def _tier_hint(tier: str | None) -> str:
    return TIER_GUIDANCE.get(tier or "premium", TIER_GUIDANCE["premium"])


# Das Preisniveau steuert die Zahl, soll aber nicht den Hinweistext einfärben.
NOTE_RULE = (
    'Halte "note" knapp, sachlich und neutral (z.B. Produktart oder Annahme). '
    'Verwende KEINE werbliche oder wertende Sprache wie "hochwertig", '
    '"Premium", "Markenqualität" oder "teuer".'
)


async def estimate(
    backend: LlmBackend,
    name: str,
    currency: str,
    mode: str,
    description: str | None = None,
    search: dict | None = None,
    tier: str | None = None,
) -> dict:
    """Liefert {price, currency, sources, mode, note}. Wirft LlmError.

    Im Modus ``websearch`` werden — sofern ``search`` echte Treffer enthält —
    diese als Kontext ans LLM gegeben (search-then-extract). Das LLM darf
    Quellen nur aus diesen Treffern wählen; das validieren wir nachträglich.
    Ohne Treffer (Provider nicht konfiguriert/erreichbar) fällt es auf die reine
    Schätzung zurück.
    """
    ctx = f" Zusatzinfo: {description}." if description else ""
    hint = _tier_hint(tier)
    results = (search or {}).get("results") or []
    grounded = mode == "websearch" and bool(results)

    if grounded:
        lines = []
        if search.get("answer"):
            lines.append(f"Zusammenfassung: {search['answer']}")
        for r in results:
            lines.append(f"- {r['title']} | {r['url']} | {r['content']}")
        context = "\n".join(lines)
        system = (
            "Du ermittelst den aktuellen Neupreis (fabrikneu) eines "
            "Haushaltsgegenstands aus echten Suchergebnissen und nennst die "
            "tatsächlich genutzten Quellen-URLs (NUR aus den vorgegebenen). "
            f"{hint}"
        )
        user = (
            f"Produkt: {name}.{ctx}\n\nSuchergebnisse:\n{context}\n\n"
            f"Ermittle den aktuellen Neupreis. {hint} Wähle Quellen-URLs "
            f"ausschließlich aus obigen Ergebnissen. {NOTE_RULE} Antworte "
            f'AUSSCHLIESSLICH als JSON in {currency}: {{"price": <Zahl>, '
            f'"currency": "{currency}", "sources": ["<url>", ...], '
            f'"note": "<kurzer Hinweis>"}}'
        )
    else:
        system = (
            "Du schätzt aus deinem Wissen den ungefähren Neupreis (fabrikneu) "
            f"von Haushaltsgegenständen. {hint}"
        )
        user = (
            f"Schätze den ungefähren Neupreis von: {name}.{ctx} {hint} "
            f"{NOTE_RULE} "
            f'Antworte AUSSCHLIESSLICH als JSON in {currency}: '
            f'{{"price": <Zahl>, "currency": "{currency}", '
            f'"sources": [], "note": "<kurzer Hinweis>"}}'
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

    sources = _coerce_sources(parsed.get("sources"))
    note = (parsed.get("note") or "").strip()[:300] or None
    if grounded:
        # Halluzinierte URLs verwerfen: nur echte Treffer zulassen.
        allowed = {r["url"] for r in results}
        sources = [s for s in sources if s in allowed] or [r["url"] for r in results[:3]]
    elif mode == "websearch":
        # Websuche war gewählt, lieferte aber keine Treffer → ehrlich kennzeichnen.
        note = "Websuche nicht verfügbar — LLM-Schätzung"
        sources = []

    return {
        "price": _coerce_price(parsed.get("price")),
        "currency": currency,
        "sources": sources,
        "mode": mode,
        "note": note,
    }
