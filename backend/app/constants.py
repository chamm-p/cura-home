"""App-weite Konstanten."""

# Grobe Objektart-Kategorien (Tagging). Bewusst wenige, breite Kategorien.
# Bei Änderung auch frontend/src/lib/categories.ts anpassen.
CATEGORIES = [
    "Möbel",
    "Technik",
    "Kochen",
    "Haushalt",
    "Hobby",
    "Kleidung",
    "Schmuck",
    "Sonstiges",
]

_CAT_LOWER = {c.lower(): c for c in CATEGORIES}


def normalize_category(value: str | None) -> str | None:
    """Bringt einen (LLM-)Wert auf eine gültige Kategorie oder None."""
    if not value:
        return None
    return _CAT_LOWER.get(str(value).strip().lower())


def find_category(text: str | None) -> str | None:
    """Sucht eine gültige Kategorie als Teilstring (toleranter als exact match —
    für LLM-Freitext wie „Kategorie: Kochen")."""
    if not text:
        return None
    exact = normalize_category(text)
    if exact:
        return exact
    t = str(text).lower()
    for c in CATEGORIES:
        if c.lower() in t:
            return c
    return None
