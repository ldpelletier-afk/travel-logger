from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: str = Field(min_length=1, max_length=40)


class CategoryOut(CategoryIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_seed: bool
    entry_count: int = 0


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    entry_id: int
    thumb_path: str
    midsize_path: str
    caption: str
    exif_taken_at: datetime | None
    exif_lat: float | None
    exif_lng: float | None
    uploaded_at: datetime


class EntryIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category_id: int
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address: str = ""
    status: Literal["visited", "candidate"] = "visited"
    visit_date: date | None = None
    notes: str = ""
    osm_id: str | None = None


class EntryPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category_id: int | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    address: str | None = None
    status: Literal["visited", "candidate"] | None = None
    visit_date: date | None = None
    notes: str | None = None
    cover_photo_id: int | None = None


class EntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    category_id: int
    latitude: float
    longitude: float
    address: str
    country: str | None = None
    state_fips: str | None
    county_fips: str | None
    county_name: str | None = None
    status: str
    visit_date: date | None
    notes: str
    cover_photo_id: int | None
    osm_id: str | None
    created_at: datetime
    updated_at: datetime
    photos: list[PhotoOut] = []


class CountryCountyStats(BaseModel):
    country: str  # US | CA
    visited: int
    total: int
    percent: float


class CountyStats(BaseModel):
    """Visited-subdivision counters, reported per country (US counties,
    CA census divisions)."""
    by_country: list[CountryCountyStats]


class VisitedCounty(BaseModel):
    country: str
    county_fips: str
    sources: list[Literal["entry", "manual"]]


class CategoryCount(BaseModel):
    category_id: int
    name: str
    color: str
    icon: str
    count: int


class StateVisitStats(BaseModel):
    country: str  # US | CA
    state_fips: str
    name: str
    abbr: str
    visited: int
    total: int
    percent: float


class Stats(BaseModel):
    total_entries: int
    total_photos: int
    by_category: list[CategoryCount]
    first_visit_date: date | None
    last_visit_date: date | None
    by_state: list[StateVisitStats]


class CategoryExport(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: str
    icon: str
    is_seed: bool


class EntryExport(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    category_id: int
    latitude: float
    longitude: float
    address: str
    country: str | None = None
    state_fips: str | None
    county_fips: str | None
    status: str
    visit_date: date | None
    notes: str
    cover_photo_id: int | None
    osm_id: str | None
    created_at: datetime
    updated_at: datetime


class PhotoExport(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    entry_id: int
    original_path: str
    thumb_path: str
    midsize_path: str
    caption: str
    exif_taken_at: datetime | None
    exif_lat: float | None
    exif_lng: float | None
    uploaded_at: datetime


class ExportData(BaseModel):
    version: int = 1
    exported_at: datetime
    categories: list[CategoryExport]
    entries: list[EntryExport]
    photos: list[PhotoExport]
    manual_counties: list[str]


class ImportSummary(BaseModel):
    categories: int
    entries: int
    photos: int
    manual_counties: int
    missing_photo_files: list[str]


class ParkPreset(BaseModel):
    name: str
    state: str | None = None
    lat: float
    lng: float
