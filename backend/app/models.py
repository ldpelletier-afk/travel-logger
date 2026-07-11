from datetime import datetime, date

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    color: Mapped[str] = mapped_column(String(7))  # hex, e.g. #B5442E
    icon: Mapped[str] = mapped_column(String(40))
    is_seed: Mapped[bool] = mapped_column(default=False)

    entries: Mapped[list["Entry"]] = relationship(back_populates="category")


class Entry(Base):
    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    latitude: Mapped[float]
    longitude: Mapped[float]
    address: Mapped[str] = mapped_column(Text, default="")
    state_fips: Mapped[str | None] = mapped_column(String(2), index=True)
    county_fips: Mapped[str | None] = mapped_column(String(5), index=True)
    status: Mapped[str] = mapped_column(String(10), default="visited")  # visited | candidate
    visit_date: Mapped[date | None]
    notes: Mapped[str] = mapped_column(Text, default="")
    # References photos.id; no FK constraint to avoid a circular dependency
    # with photos.entry_id — validated in the photos router instead.
    cover_photo_id: Mapped[int | None]
    osm_id: Mapped[str | None] = mapped_column(String(40), unique=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    category: Mapped[Category] = relationship(back_populates="entries")
    photos: Mapped[list["Photo"]] = relationship(
        back_populates="entry", cascade="all, delete-orphan"
    )


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("entries.id", ondelete="CASCADE"))
    # Paths relative to data/photos/
    original_path: Mapped[str] = mapped_column(String(300))
    thumb_path: Mapped[str] = mapped_column(String(300))
    midsize_path: Mapped[str] = mapped_column(String(300))
    caption: Mapped[str] = mapped_column(Text, default="")
    exif_taken_at: Mapped[datetime | None]
    exif_lat: Mapped[float | None]
    exif_lng: Mapped[float | None]
    uploaded_at: Mapped[datetime] = mapped_column(server_default=func.now())

    entry: Mapped[Entry] = relationship(back_populates="photos")


class ManualCounty(Base):
    """Counties marked visited with no entry ("drove through it")."""

    __tablename__ = "manual_counties"
    __table_args__ = (UniqueConstraint("county_fips"),)

    county_fips: Mapped[str] = mapped_column(String(5), primary_key=True)
    marked_at: Mapped[datetime] = mapped_column(server_default=func.now())
