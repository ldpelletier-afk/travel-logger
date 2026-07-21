"""Photo storage: originals + 400px thumb + 1600px midsize, EXIF extraction."""

from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps
from PIL.ExifTags import GPSTAGS, TAGS
from pillow_heif import register_heif_opener

from ..db import PHOTOS_DIR

# Teach Pillow to decode HEIC/HEIF (iPhone photos) alongside JPEG/PNG/etc.
# Renditions are still written as JPEG, so the browser never has to display
# HEIC directly.
register_heif_opener()

THUMB_EDGE = 400
MIDSIZE_EDGE = 1600


def _dms_to_deg(dms, ref) -> float:
    deg = float(dms[0]) + float(dms[1]) / 60 + float(dms[2]) / 3600
    return -deg if ref in ("S", "W") else deg


def read_exif(img: Image.Image) -> dict:
    """Extract taken_at and GPS coordinates; missing/malformed EXIF -> {}."""
    out: dict = {}
    try:
        exif = img.getexif()
        tags = {TAGS.get(k, k): v for k, v in exif.items()}
        ifd = exif.get_ifd(0x8769)  # Exif sub-IFD holds DateTimeOriginal
        tags.update({TAGS.get(k, k): v for k, v in ifd.items()})
        raw_dt = tags.get("DateTimeOriginal") or tags.get("DateTime")
        if raw_dt:
            out["taken_at"] = datetime.strptime(str(raw_dt), "%Y:%m:%d %H:%M:%S")
        gps_ifd = exif.get_ifd(0x8825)
        gps = {GPSTAGS.get(k, k): v for k, v in gps_ifd.items()}
        if "GPSLatitude" in gps and "GPSLongitude" in gps:
            out["lat"] = _dms_to_deg(gps["GPSLatitude"], gps.get("GPSLatitudeRef", "N"))
            out["lng"] = _dms_to_deg(gps["GPSLongitude"], gps.get("GPSLongitudeRef", "E"))
    except Exception:
        pass
    return out


def store_photo(entry_id: int, photo_id: int, raw: bytes, orig_name: str) -> dict:
    """Write original + renditions under data/photos/{entry_id}/.

    Returns paths (relative to data/photos/) and extracted EXIF.
    """
    ext = Path(orig_name).suffix.lower() or ".jpg"
    d = PHOTOS_DIR / str(entry_id)
    d.mkdir(parents=True, exist_ok=True)

    original = d / f"{photo_id}_original{ext}"
    original.write_bytes(raw)

    img = Image.open(original)
    exif = read_exif(img)
    img = ImageOps.exif_transpose(img)  # bake phone rotation into pixels
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    paths = {"original_path": f"{entry_id}/{original.name}"}
    for key, edge, suffix in (
        ("thumb_path", THUMB_EDGE, "thumb"),
        ("midsize_path", MIDSIZE_EDGE, "mid"),
    ):
        rend = img.copy()
        rend.thumbnail((edge, edge))
        out = d / f"{photo_id}_{suffix}.jpg"
        rend.save(out, "JPEG", quality=85)
        paths[key] = f"{entry_id}/{out.name}"
    return {**paths, "exif": exif}


def delete_photo_files(paths: list[str]) -> None:
    for rel in paths:
        p = PHOTOS_DIR / rel
        if p.is_file() and p.resolve().is_relative_to(PHOTOS_DIR.resolve()):
            p.unlink()
