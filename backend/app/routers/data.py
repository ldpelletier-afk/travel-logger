import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import PHOTOS_DIR, get_db
from ..models import Category, Entry, ManualCounty, Photo
from ..schemas import CategoryExport, EntryExport, ExportData, ImportSummary, PhotoExport

router = APIRouter(prefix="/api/data", tags=["data"])


@router.get("/export")
def export_data(db: Session = Depends(get_db)):
    data = ExportData(
        exported_at=datetime.now(timezone.utc),
        categories=[CategoryExport.model_validate(c) for c in db.scalars(select(Category)).all()],
        entries=[EntryExport.model_validate(e) for e in db.scalars(select(Entry)).all()],
        photos=[PhotoExport.model_validate(p) for p in db.scalars(select(Photo)).all()],
        manual_counties=list(db.scalars(select(ManualCounty.county_fips)).all()),
    )
    filename = f"travel-logger-export-{datetime.now().strftime('%Y-%m-%d')}.json"
    return Response(
        content=data.model_dump_json(indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import", response_model=ImportSummary)
async def import_data(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        payload = json.loads(await file.read())
        data = ExportData.model_validate(payload)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(422, f"Invalid export file: {exc}")

    # Photo files on disk are untouched — only the DB rows that reference
    # them (by path) are replaced. A full backup is this JSON plus a copy
    # of the data/photos directory.
    db.execute(delete(Photo))
    db.execute(delete(Entry))
    db.execute(delete(Category))
    db.execute(delete(ManualCounty))
    db.flush()

    for c in data.categories:
        db.add(Category(id=c.id, name=c.name, color=c.color, icon=c.icon, is_seed=c.is_seed))
    db.flush()

    for e in data.entries:
        db.add(
            Entry(
                id=e.id,
                name=e.name,
                category_id=e.category_id,
                latitude=e.latitude,
                longitude=e.longitude,
                address=e.address,
                state_fips=e.state_fips,
                county_fips=e.county_fips,
                status=e.status,
                visit_date=e.visit_date,
                notes=e.notes,
                cover_photo_id=e.cover_photo_id,
                osm_id=e.osm_id,
                created_at=e.created_at,
                updated_at=e.updated_at,
            )
        )
    db.flush()

    missing_photo_files = []
    for p in data.photos:
        db.add(
            Photo(
                id=p.id,
                entry_id=p.entry_id,
                original_path=p.original_path,
                thumb_path=p.thumb_path,
                midsize_path=p.midsize_path,
                caption=p.caption,
                exif_taken_at=p.exif_taken_at,
                exif_lat=p.exif_lat,
                exif_lng=p.exif_lng,
                uploaded_at=p.uploaded_at,
            )
        )
        if not (PHOTOS_DIR / p.thumb_path).exists():
            missing_photo_files.append(p.thumb_path)
    db.flush()

    for fips in data.manual_counties:
        db.add(ManualCounty(county_fips=fips))

    db.commit()

    return ImportSummary(
        categories=len(data.categories),
        entries=len(data.entries),
        photos=len(data.photos),
        manual_counties=len(data.manual_counties),
        missing_photo_files=missing_photo_files,
    )
