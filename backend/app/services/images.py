"""Foto-Handling: Speichern + Herunterskalieren (Pillow)."""

from __future__ import annotations

import io
import logging
import os
import uuid

from PIL import Image, ImageFile, ImageOps

# Tolerant gegenüber leicht abgeschnittenen Bildern (kommt bei Handy-Uploads
# gelegentlich vor) — sonst wirft Pillow „Truncated File Read".
ImageFile.LOAD_TRUNCATED_IMAGES = True

logger = logging.getLogger(__name__)

MAX_DIM = 1600  # längste Kante; spart Platz und beschleunigt Vision-Calls
THUMB_DIM = 400


def _load(image_bytes: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(image_bytes))
    # EXIF-Orientierung anwenden (iPhone-Hochformat), dann RGB.
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return img


def save_photo(
    uploads_dir: str, item_id: uuid.UUID, image_bytes: bytes
) -> tuple[str, str]:
    """Speichert Original (herunterskaliert) + Thumbnail als JPEG.

    Liefert (file_path, thumb_path) relativ zu uploads_dir.
    """
    item_dir = os.path.join(uploads_dir, str(item_id))
    os.makedirs(item_dir, exist_ok=True)
    name = uuid.uuid4().hex

    img = _load(image_bytes)
    img.thumbnail((MAX_DIM, MAX_DIM))
    rel = f"{item_id}/{name}.jpg"
    img.convert("RGB").save(os.path.join(uploads_dir, rel), "JPEG", quality=85)

    thumb = img.copy()
    thumb.thumbnail((THUMB_DIM, THUMB_DIM))
    thumb_rel = f"{item_id}/{name}_thumb.jpg"
    thumb.convert("RGB").save(os.path.join(uploads_dir, thumb_rel), "JPEG", quality=80)

    return rel, thumb_rel


def normalize_for_vision(image_bytes: bytes) -> bytes:
    """Skaliert ein Bild für den Vision-Call herunter (JPEG, max. MAX_DIM)."""
    img = _load(image_bytes)
    img.thumbnail((MAX_DIM, MAX_DIM))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "JPEG", quality=85)
    return buf.getvalue()
