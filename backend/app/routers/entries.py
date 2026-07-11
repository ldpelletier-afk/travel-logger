from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import Category, Entry, Photo
from ..schemas import EntryIn, EntryOut, EntryPatch
from ..services import geo

router = APIRouter(prefix="/api/entries", tags=["entries"])

SORTS = {
    "name": Entry.name,
    "visit_date": Entry.visit_date,
    "created_at": Entry.created_at,
}


def _with_county_name(entry: Entry) -> EntryOut:
    out = EntryOut.model_validate(entry)
    if entry.county_fips:
        loc = geo.locate(entry.latitude, entry.longitude)
        out.county_name = loc["county_name"] if loc else None
    return out


def _derive_fips(entry: Entry) -> None:
    loc = geo.locate(entry.latitude, entry.longitude)
    entry.state_fips = loc["state_fips"] if loc else None
    entry.county_fips = loc["county_fips"] if loc else None


@router.get("", response_model=list[EntryOut])
def list_entries(
    db: Session = Depends(get_db),
    category_id: list[int] | None = Query(default=None),
    state_fips: str | None = None,
    status: str | None = Query(default=None, pattern="^(visited|candidate)$"),
    date_from: date | None = None,
    date_to: date | None = None,
    q: str | None = None,
    sort: str = Query(default="created_at", pattern="^(name|visit_date|created_at)$"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
):
    stmt = select(Entry).options(selectinload(Entry.photos))
    if category_id:
        stmt = stmt.where(Entry.category_id.in_(category_id))
    if state_fips:
        stmt = stmt.where(Entry.state_fips == state_fips)
    if status:
        stmt = stmt.where(Entry.status == status)
    if date_from:
        stmt = stmt.where(Entry.visit_date >= date_from)
    if date_to:
        stmt = stmt.where(Entry.visit_date <= date_to)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Entry.name.ilike(like), Entry.notes.ilike(like)))
    col = SORTS[sort]
    stmt = stmt.order_by(col.asc() if order == "asc" else col.desc())
    return [_with_county_name(e) for e in db.scalars(stmt).all()]


@router.get("/{entry_id}", response_model=EntryOut)
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(Entry, entry_id, options=[selectinload(Entry.photos)])
    if not entry:
        raise HTTPException(404, "Entry not found")
    return _with_county_name(entry)


@router.post("", response_model=EntryOut, status_code=201)
def create_entry(body: EntryIn, db: Session = Depends(get_db)):
    if not db.get(Category, body.category_id):
        raise HTTPException(422, "Unknown category_id")
    entry = Entry(**body.model_dump())
    _derive_fips(entry)
    db.add(entry)
    db.commit()
    return _with_county_name(entry)


@router.patch("/{entry_id}", response_model=EntryOut)
def update_entry(entry_id: int, body: EntryPatch, db: Session = Depends(get_db)):
    entry = db.get(Entry, entry_id)
    if not entry:
        raise HTTPException(404, "Entry not found")
    changes = body.model_dump(exclude_unset=True)
    if "category_id" in changes and not db.get(Category, changes["category_id"]):
        raise HTTPException(422, "Unknown category_id")
    if "cover_photo_id" in changes and changes["cover_photo_id"] is not None:
        photo = db.get(Photo, changes["cover_photo_id"])
        if not photo or photo.entry_id != entry_id:
            raise HTTPException(422, "cover_photo_id must be a photo of this entry")
    for k, v in changes.items():
        setattr(entry, k, v)
    if "latitude" in changes or "longitude" in changes:
        _derive_fips(entry)
    db.commit()
    return _with_county_name(entry)


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    from ..services.images import delete_photo_files

    entry = db.get(Entry, entry_id, options=[selectinload(Entry.photos)])
    if not entry:
        raise HTTPException(404, "Entry not found")
    files = [p for ph in entry.photos for p in (ph.original_path, ph.thumb_path, ph.midsize_path)]
    db.delete(entry)
    db.commit()
    delete_photo_files(files)
