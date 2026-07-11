from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Entry, Photo
from ..schemas import PhotoOut
from ..services.images import delete_photo_files, store_photo

router = APIRouter(prefix="/api", tags=["photos"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/tiff", "image/heic"}


@router.post("/entries/{entry_id}/photos", response_model=PhotoOut, status_code=201)
async def upload_photo(entry_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    entry = db.get(Entry, entry_id)
    if not entry:
        raise HTTPException(404, "Entry not found")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, f"Unsupported type {file.content_type}")

    photo = Photo(entry_id=entry_id, original_path="", thumb_path="", midsize_path="")
    db.add(photo)
    db.flush()  # allocate photo.id for the filenames

    raw = await file.read()
    try:
        result = store_photo(entry_id, photo.id, raw, file.filename or "photo.jpg")
    except Exception as exc:
        db.rollback()
        raise HTTPException(422, f"Could not process image: {exc}")

    photo.original_path = result["original_path"]
    photo.thumb_path = result["thumb_path"]
    photo.midsize_path = result["midsize_path"]
    exif = result["exif"]
    photo.exif_taken_at = exif.get("taken_at")
    photo.exif_lat = exif.get("lat")
    photo.exif_lng = exif.get("lng")

    if entry.cover_photo_id is None:
        entry.cover_photo_id = photo.id  # first upload becomes the cover
    db.commit()
    return photo


@router.patch("/photos/{photo_id}", response_model=PhotoOut)
def update_caption(photo_id: int, body: dict, db: Session = Depends(get_db)):
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(404, "Photo not found")
    if "caption" in body:
        photo.caption = str(body["caption"])
    db.commit()
    return photo


@router.delete("/photos/{photo_id}", status_code=204)
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(404, "Photo not found")
    entry = db.get(Entry, photo.entry_id)
    files = [photo.original_path, photo.thumb_path, photo.midsize_path]
    if entry and entry.cover_photo_id == photo_id:
        entry.cover_photo_id = None
    db.delete(photo)
    db.commit()
    delete_photo_files(files)
