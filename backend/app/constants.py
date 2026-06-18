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
