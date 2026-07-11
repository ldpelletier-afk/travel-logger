import json
import re
import urllib.request
from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query

from ..db import DATA_DIR, STATIC_DATA_DIR
from ..schemas import ParkPreset
from ..services import geo

router = APIRouter(prefix="/api/presets", tags=["presets"])

PRESETS_CACHE_DIR = DATA_DIR / "presets"
PRESETS_CACHE_DIR.mkdir(exist_ok=True)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "TravelLogger/1.0 (local personal-use app; contact: none)"


@lru_cache(maxsize=1)
def _national_parks() -> list[ParkPreset]:
    raw = json.loads((STATIC_DATA_DIR / "national_parks.json").read_text())
    return [ParkPreset(**p) for p in raw]


@router.get("/national-parks", response_model=list[ParkPreset])
def national_parks():
    return _national_parks()


def _overpass_query(state_abbr: str) -> str:
    return f"""
    [out:json][timeout:30];
    area["ISO3166-2"="US-{state_abbr}"]["admin_level"="4"]->.a;
    (
      node["leisure"="park"]["name"~"State Park",i](area.a);
      way["leisure"="park"]["name"~"State Park",i](area.a);
      relation["leisure"="park"]["name"~"State Park",i](area.a);
      node["boundary"="protected_area"]["protection_title"~"State Park",i](area.a);
      way["boundary"="protected_area"]["protection_title"~"State Park",i](area.a);
      relation["boundary"="protected_area"]["protection_title"~"State Park",i](area.a);
    );
    out center tags;
    """


def _fetch_state_parks(state_abbr: str) -> list[ParkPreset]:
    query = _overpass_query(state_abbr)
    req = urllib.request.Request(
        OVERPASS_URL,
        data=f"data={query}".encode(),
        headers={"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=35) as resp:
            payload = json.loads(resp.read())
    except Exception as exc:
        raise HTTPException(502, f"Couldn't reach OpenStreetMap's Overpass API: {exc}")

    seen: dict[str, ParkPreset] = {}
    for el in payload.get("elements", []):
        name = el.get("tags", {}).get("name")
        if not name:
            continue
        if el["type"] == "node":
            lat, lng = el.get("lat"), el.get("lon")
        else:
            center = el.get("center") or {}
            lat, lng = center.get("lat"), center.get("lon")
        if lat is None or lng is None:
            continue
        key = re.sub(r"\s+", " ", name.strip().lower())
        if key not in seen:
            seen[key] = ParkPreset(name=name.strip(), state=state_abbr, lat=lat, lng=lng)
    return sorted(seen.values(), key=lambda p: p.name)


@router.get("/state-parks", response_model=list[ParkPreset])
def state_parks(state_fips: str = Query(..., min_length=2, max_length=2)):
    info = geo.state_names().get(state_fips)
    if not info:
        raise HTTPException(422, "Unknown state_fips")

    cache_path = PRESETS_CACHE_DIR / f"state_parks_{state_fips}.json"
    if cache_path.exists():
        return [ParkPreset(**p) for p in json.loads(cache_path.read_text())]

    parks = _fetch_state_parks(info["abbr"])
    cache_path.write_text(json.dumps([p.model_dump() for p in parks]))
    return parks
