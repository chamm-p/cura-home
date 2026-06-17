"""Items API — Inventarobjekte: Liste/Filter, CRUD, Foto-Upload, Capture, Summen."""

from __future__ import annotations

import logging
import os
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.deps import get_current_house, get_current_user
from app.database import async_session, get_db
from app.models.area import Area
from app.models.house import House
from app.models.item import Item, PriceSource
from app.models.item_photo import ItemPhoto
from app.models.user import User
from app.schemas.inventory import (
    AreaSummary,
    CaptureResult,
    InventorySummary,
    ItemIn,
    ItemOut,
    ItemUpdate,
    PhotoOut,
)
from app.services import houses as houses_svc
from app.services import settings_store, vision
from app.services.images import save_photo
from app.services.llm import LlmError

settings = get_settings()
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/items", tags=["items"])


async def _recognize_background(item_id: uuid.UUID, image_bytes: bytes) -> None:
    """Läuft NACH der Capture-Antwort: erkennt das Objekt und setzt den Namen.

    Eigene DB-Session (die Request-Session ist längst geschlossen). Ein bereits
    vom Nutzer vergebener Name wird nicht überschrieben.
    """
    async with async_session() as db:
        try:
            backend = await settings_store.pick_backend(
                db, config_key="vision_config", require_vision=True
            )
            if backend is None:
                return
            result = await vision.recognize(backend, image_bytes)
            item = await db.get(Item, item_id)
            if item and not (item.name or "").strip():
                item.name = result["name"]
                if result.get("description") and not item.description:
                    item.description = result["description"]
                await db.commit()
        except LlmError as e:
            logger.info("Hintergrund-Vision fehlgeschlagen (%s): %s", item_id, e)
        except Exception as e:  # noqa: BLE001
            logger.warning("Hintergrund-Vision Fehler (%s): %s", item_id, e)


# ─── Serialisierung ───
def _photo_out(p: ItemPhoto) -> PhotoOut:
    url = f"/uploads/{p.file_path}"
    head, _, ext = url.rpartition(".")
    thumb_url = f"{head}_thumb.{ext}" if head else url
    return PhotoOut(id=p.id, url=url, thumb_url=thumb_url, is_primary=p.is_primary)


def _item_out(item: Item) -> ItemOut:
    return ItemOut(
        id=item.id,
        area_id=item.area_id,
        name=item.name,
        description=item.description,
        price_new=float(item.price_new) if item.price_new is not None else None,
        price_source=item.price_source.value if item.price_source else None,
        is_catalogued=item.is_catalogued,
        custom_values=item.custom_values or {},
        created_at=item.created_at,
        updated_at=item.updated_at,
        photos=[_photo_out(p) for p in item.photos],
    )


async def _get_item_loaded(db: AsyncSession, item_id: uuid.UUID, user: User) -> Item:
    item = await db.scalar(
        select(Item).where(Item.id == item_id).options(selectinload(Item.photos))
    )
    if not item:
        raise HTTPException(404, "Objekt nicht gefunden")
    # Zugriff nur, wenn der User Mitglied des zugehörigen Hauses ist.
    await houses_svc.require_member(db, item.house_id, user)
    return item


async def _validate_area(db: AsyncSession, area_id: uuid.UUID | None, house_id: uuid.UUID) -> None:
    """Stellt sicher, dass ein gesetzter Bereich zum aktiven Haus gehört."""
    if area_id is None:
        return
    area = await db.get(Area, area_id)
    if not area or area.house_id != house_id:
        raise HTTPException(400, "Bereich gehört nicht zu diesem Haus")


# ─── Liste mit Filtern ───
@router.get("", response_model=list[ItemOut])
async def list_items(
    db: AsyncSession = Depends(get_db),
    house: House = Depends(get_current_house),
    _: User = Depends(get_current_user),
    area_id: uuid.UUID | None = Query(default=None),
    uncatalogued: bool = Query(default=False),
    no_price: bool = Query(default=False),
):
    """Innerhalb des aktiven Hauses. area_id weglassen = ALLE Bereiche."""
    stmt = select(Item).where(Item.house_id == house.id).options(selectinload(Item.photos))
    if area_id is not None:
        stmt = stmt.where(Item.area_id == area_id)
    if uncatalogued:
        stmt = stmt.where(Item.is_catalogued.is_(False))
    if no_price:
        stmt = stmt.where(Item.price_new.is_(None))
    stmt = stmt.order_by(Item.created_at.desc())
    rows = await db.scalars(stmt)
    return [_item_out(i) for i in rows]


# ─── Summen (je Bereich + Total) ───
@router.get("/summary", response_model=InventorySummary)
async def summary(
    db: AsyncSession = Depends(get_db),
    house: House = Depends(get_current_house),
    _: User = Depends(get_current_user),
):
    areas = {
        a.id: a.name
        for a in await db.scalars(select(Area).where(Area.house_id == house.id))
    }
    items = list(await db.scalars(select(Item).where(Item.house_id == house.id)))

    buckets: dict[uuid.UUID | None, dict] = {}
    for it in items:
        b = buckets.setdefault(
            it.area_id,
            {"count": 0, "total": 0.0, "no_price": 0},
        )
        b["count"] += 1
        if it.price_new is not None:
            b["total"] += float(it.price_new)
        else:
            b["no_price"] += 1

    by_area = [
        AreaSummary(
            area_id=aid,
            area_name=(areas.get(aid) if aid else None) or "Ohne Bereich",
            item_count=b["count"],
            total_price=round(b["total"], 2),
            items_without_price=b["no_price"],
        )
        for aid, b in buckets.items()
    ]
    by_area.sort(key=lambda s: s.area_name.lower())
    return InventorySummary(
        by_area=by_area,
        total_price=round(sum(s.total_price for s in by_area), 2),
        total_items=sum(s.item_count for s in by_area),
    )


# ─── Einzelnes Objekt ───
@router.get("/{item_id}", response_model=ItemOut)
async def get_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _item_out(await _get_item_loaded(db, item_id, user))


@router.post("", response_model=ItemOut, status_code=201)
async def create_item(
    body: ItemIn,
    db: AsyncSession = Depends(get_db),
    house: House = Depends(get_current_house),
    _: User = Depends(get_current_user),
):
    await _validate_area(db, body.area_id, house.id)
    item = Item(
        house_id=house.id,
        area_id=body.area_id,
        name=(body.name or None),
        description=body.description,
        price_new=body.price_new,
        price_source=PriceSource.MANUAL if body.price_new is not None else None,
        is_catalogued=bool(body.is_catalogued) if body.is_catalogued is not None else bool(body.name),
        custom_values=body.custom_values or {},
    )
    db.add(item)
    await db.flush()
    await db.refresh(item, attribute_names=["photos"])
    return _item_out(item)


@router.put("/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: uuid.UUID,
    body: ItemUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = await _get_item_loaded(db, item_id, user)
    data = body.model_dump(exclude_unset=True)
    if "area_id" in data:
        await _validate_area(db, data["area_id"], item.house_id)
        item.area_id = data["area_id"]
    if "name" in data:
        item.name = (data["name"] or None)
    if "description" in data:
        item.description = data["description"]
    if "price_new" in data:
        item.price_new = data["price_new"]
        # Manuelle Preiseingabe markiert die Quelle als manuell.
        item.price_source = PriceSource.MANUAL if data["price_new"] is not None else None
    if "custom_values" in data and data["custom_values"] is not None:
        item.custom_values = data["custom_values"]
    if "is_catalogued" in data and data["is_catalogued"] is not None:
        item.is_catalogued = data["is_catalogued"]
    await db.flush()
    return _item_out(item)


@router.delete("/{item_id}", status_code=204)
async def delete_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = await db.get(Item, item_id)
    if not item:
        raise HTTPException(404, "Objekt nicht gefunden")
    await houses_svc.require_member(db, item.house_id, user)
    await db.delete(item)
    await db.flush()
    return None


# ─── Foto-Upload zu bestehendem Objekt ───
@router.post("/{item_id}/photos", response_model=ItemOut)
async def add_photo(
    item_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = await _get_item_loaded(db, item_id, user)
    data = await file.read()
    if not data:
        raise HTTPException(400, "Leere Datei")
    rel, _thumb = save_photo(settings.uploads_dir, item.id, data)
    is_first = len(item.photos) == 0
    db.add(ItemPhoto(item_id=item.id, file_path=rel, is_primary=is_first))
    await db.flush()
    await db.refresh(item, attribute_names=["photos"])
    return _item_out(item)


# ─── Capture: Foto → neues Objekt + Vision-Erkennung ───
@router.post("/capture", response_model=CaptureResult, status_code=201)
async def capture(
    background_tasks: BackgroundTasks,
    area_id: uuid.UUID | None = Form(default=None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    house: House = Depends(get_current_house),
    _: User = Depends(get_current_user),
):
    """Speichert Foto + Objekt sofort; die Vision-Erkennung läuft im Hintergrund."""
    data = await file.read()
    if not data:
        raise HTTPException(400, "Leere Datei")
    await _validate_area(db, area_id, house.id)

    item = Item(house_id=house.id, area_id=area_id, is_catalogued=False)
    db.add(item)
    await db.flush()

    rel, _thumb = save_photo(settings.uploads_dir, item.id, data)
    db.add(ItemPhoto(item_id=item.id, file_path=rel, is_primary=True))
    # Sofort committen, damit der Hintergrund-Task das Objekt sicher findet.
    await db.commit()
    await db.refresh(item, attribute_names=["photos"])

    # Vision asynchron anstoßen (blockiert die Aufnahme nicht).
    backend = await settings_store.pick_backend(
        db, config_key="vision_config", require_vision=True
    )
    if backend is not None:
        background_tasks.add_task(_recognize_background, item.id, data)
        vision_status = "pending"
    else:
        vision_status = "skipped"

    return CaptureResult(item=_item_out(item), vision_status=vision_status)


@router.post("/{item_id}/recognize", response_model=ItemOut)
async def recognize_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Erkennt ein bestehendes Objekt erneut anhand seines (primären) Fotos."""
    item = await _get_item_loaded(db, item_id, user)
    if not item.photos:
        raise HTTPException(400, "Kein Foto vorhanden")
    backend = await settings_store.pick_backend(
        db, config_key="vision_config", require_vision=True
    )
    if backend is None:
        raise HTTPException(400, "Kein Vision-Backend konfiguriert")

    primary = next((p for p in item.photos if p.is_primary), item.photos[0])
    path = os.path.join(settings.uploads_dir, primary.file_path)
    try:
        with open(path, "rb") as f:
            data = f.read()
    except OSError:
        raise HTTPException(404, "Foto-Datei nicht gefunden")

    try:
        result = await vision.recognize(backend, data)
    except LlmError as e:
        raise HTTPException(502, str(e))

    item.name = result["name"]
    if result.get("description"):
        item.description = result["description"]
    await db.flush()
    return _item_out(item)
