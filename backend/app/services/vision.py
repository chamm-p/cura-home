"""Vision-Erkennung: Foto → Inventarname via OpenAI-kompatiblem Vision-LLM."""

from __future__ import annotations

import logging

from json_repair import repair_json

from app.constants import CATEGORIES, find_category, normalize_category
from app.models.llm_backend import LlmBackend
from app.services.images import normalize_for_vision
from app.services.llm import LlmError, chat_completion, first_message_content, image_part

logger = logging.getLogger(__name__)

_SYSTEM = (
    "Du bist ein Assistent zur Inventarerfassung im Haushalt. Du erkennst auf "
    "Fotos das Hauptobjekt, benennst es knapp und alltagstauglich auf Deutsch "
    "und ordnest es einer groben Kategorie zu."
)

_CATS = ", ".join(CATEGORIES)
_USER = (
    "Welches Inventarobjekt ist auf dem Foto das Hauptmotiv? Antworte AUSSCHLIESSLICH "
    "als JSON in diesem Format:\n"
    '{"name": "<kurzer Name, max. 4 Wörter>", "category": "<eine Kategorie>", '
    '"description": "<optional, 1 kurzer Satz>"}\n'
    f"category MUSS genau eine aus dieser Liste sein: {_CATS}. "
    "Beispiele: \"Mikrowelle\" → Kochen, \"Esstischstuhl\" → Möbel, "
    "\"Bohrmaschine\" → Hobby, \"Laptop\" → Technik. "
    "Keine Erklärungen außerhalb des JSON."
)


async def recognize(backend: LlmBackend, image_bytes: bytes) -> dict:
    """Liefert {name, description}. Wirft LlmError bei Backend-Problemen."""
    small = normalize_for_vision(image_bytes)
    messages = [
        {"role": "system", "content": _SYSTEM},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": _USER},
                image_part(small, "image/jpeg"),
            ],
        },
    ]
    data = await chat_completion(backend, messages, max_tokens=300, temperature=0.1)
    content = first_message_content(data).strip()
    if not content:
        raise LlmError("Vision-LLM lieferte leere Antwort")

    # Robust gegen ```json-Fences und kleinere JSON-Fehler.
    cleaned = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    try:
        parsed = repair_json(cleaned, return_objects=True)
    except Exception:  # noqa: BLE001
        parsed = {}
    if not isinstance(parsed, dict):
        parsed = {}

    name = (parsed.get("name") or "").strip()
    if not name:
        # Fallback: erste Zeile als Name nehmen.
        name = content.splitlines()[0].strip()[:120]
    return {
        "name": name[:300],
        "category": normalize_category(parsed.get("category")),
        "description": (parsed.get("description") or "").strip()[:1000] or None,
    }


async def categorize(backend: LlmBackend, name: str) -> str | None:
    """Ordnet einen Objektnamen (Text, ohne Foto) einer groben Kategorie zu."""
    system = "Du ordnest Haushaltsgegenstände genau einer groben Kategorie zu."
    user = (
        f'Kategorisiere den Gegenstand "{name}". Wähle GENAU eine Kategorie aus: '
        f"{_CATS}. Antworte ausschließlich mit dem Kategorienamen."
    )
    data = await chat_completion(
        backend,
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=20,
        temperature=0.0,
    )
    return find_category(first_message_content(data))
