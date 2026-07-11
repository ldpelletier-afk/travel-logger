"""Seed the database with categories and sample entries.

Run from the project root:  backend/.venv/bin/python -m backend.scripts.seed
Idempotent: skips anything that already exists (matched by name).
"""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import Category, Entry  # noqa: E402
from app.services import geo  # noqa: E402

CATEGORIES = [
    # (name, color, icon)
    ("historical marker", "#B5442E", "landmark"),
    ("monument", "#7A5C3E", "tower"),
    ("memorial", "#5B6770", "flame"),
    ("covered bridge", "#8C4A2F", "bridge"),
    ("museum", "#3E5C76", "building"),
    ("national park", "#3F6B4F", "tree"),
    ("state park", "#6B8E4E", "trees"),
    ("scenic overlook", "#4C7A8C", "binoculars"),
    ("other", "#6B7280", "map-pin"),
]

ENTRIES = [
    # (name, category, lat, lng, visit_date, notes)
    ("Gettysburg National Military Park", "national park", 39.8110, -77.2311,
     date(2024, 6, 14), "Walked Pickett's Charge line at dusk."),
    ("Lincoln Memorial", "memorial", 38.8893, -77.0502,
     date(2023, 4, 2), "Early morning, almost empty."),
    ("Knox's Headquarters Marker", "historical marker", 41.4459, -74.0565,
     date(2024, 9, 21), "Roadside marker on NY 94, Vails Gate."),
    ("Cornish-Windsor Covered Bridge", "covered bridge", 43.4726, -72.3833,
     date(2022, 10, 8), "Longest wooden covered bridge in the US; NH/VT line."),
    ("The Henry Ford Museum", "museum", 42.3034, -83.2344,
     date(2023, 7, 19), "Full day. The Rosa Parks bus."),
    ("Acadia National Park — Cadillac Mtn", "national park", 44.3528, -68.2247,
     date(2022, 8, 30), "Sunrise from the summit."),
    ("Washington Monument", "monument", 38.8895, -77.0353,
     date(2023, 4, 2), None),
    ("Hawk's Nest Overlook", "scenic overlook", 41.4573, -74.8032,
     date(2024, 5, 11), "Route 97 switchbacks over the Delaware."),
    ("Bennington Battle Monument", "monument", 42.8892, -73.2141,
     date(2022, 10, 9), "306 ft obelisk; elevator to the observation level."),
    ("Antietam National Battlefield", "national park", 39.4747, -77.7453,
     date(2024, 6, 15), "Burnside Bridge, Bloody Lane."),
    ("Mystic Seaport Museum", "museum", 41.3623, -71.9668,
     date(2025, 3, 22), "Charles W. Morgan whaleship."),
    ("West Cornwall Covered Bridge", "covered bridge", 41.8715, -73.3652,
     date(2025, 3, 23), "Still carries traffic over the Housatonic."),
]


def main() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        cats = {}
        for name, color, icon in CATEGORIES:
            cat = db.query(Category).filter_by(name=name).first()
            if not cat:
                cat = Category(name=name, color=color, icon=icon, is_seed=True)
                db.add(cat)
                db.flush()
            cats[name] = cat
        added = 0
        for name, cat_name, lat, lng, visit, notes in ENTRIES:
            if db.query(Entry).filter_by(name=name).first():
                continue
            loc = geo.locate(lat, lng)
            db.add(Entry(
                name=name,
                category_id=cats[cat_name].id,
                latitude=lat,
                longitude=lng,
                state_fips=loc["state_fips"] if loc else None,
                county_fips=loc["county_fips"] if loc else None,
                visit_date=visit,
                notes=notes or "",
            ))
            added += 1
        db.commit()
        print(f"Seeded {len(CATEGORIES)} categories, added {added} entries.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
