from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Entry, ManualCounty
from ..schemas import CountryCountyStats, CountyStats, VisitedCounty
from ..services import geo

router = APIRouter(prefix="/api/counties", tags=["counties"])


def visited_map(db: Session) -> dict[str, dict]:
    """county_fips -> {country, sources}. US GEOIDs (5-digit) and CA CDUIDs
    (4-digit) never collide, so a flat fips key is safe."""
    out: dict[str, dict] = {}
    rows = db.execute(
        select(Entry.county_fips, Entry.country)
        .where(Entry.status == "visited", Entry.county_fips.is_not(None))
        .distinct()
    ).all()
    for fips, country in rows:
        out.setdefault(fips, {"country": country or "US", "sources": []})["sources"].append("entry")
    for fips, country in db.execute(select(ManualCounty.county_fips, ManualCounty.country)).all():
        entry = out.setdefault(fips, {"country": country or "US", "sources": []})
        entry["sources"].append("manual")
    return out


@router.get("/visited", response_model=list[VisitedCounty])
def visited_counties(db: Session = Depends(get_db)):
    return [
        VisitedCounty(country=v["country"], county_fips=f, sources=v["sources"])
        for f, v in sorted(visited_map(db).items())
    ]


@router.get("/stats", response_model=CountyStats)
def county_stats(db: Session = Depends(get_db)):
    totals = geo.subdivision_total()
    visited_by_country = {c: 0 for c in geo.COUNTRIES}
    for v in visited_map(db).values():
        if v["country"] in visited_by_country:
            visited_by_country[v["country"]] += 1
    return CountyStats(
        by_country=[
            CountryCountyStats(
                country=c,
                visited=visited_by_country[c],
                total=totals[c],
                percent=round(100 * visited_by_country[c] / totals[c], 2) if totals[c] else 0.0,
            )
            for c in geo.COUNTRIES
        ]
    )


def _validate(country: str, county_fips: str) -> None:
    if country not in geo.COUNTRIES:
        raise HTTPException(422, "country must be US or CA")
    expected = 5 if country == "US" else 4
    if len(county_fips) != expected or not county_fips.isdigit():
        raise HTTPException(422, f"{country} county_fips must be {expected} digits")


@router.post("/{country}/{county_fips}/manual", status_code=201)
def mark_manual(country: str, county_fips: str, db: Session = Depends(get_db)):
    _validate(country, county_fips)
    if db.get(ManualCounty, county_fips):
        return {"county_fips": county_fips, "already_marked": True}
    db.add(ManualCounty(county_fips=county_fips, country=country))
    db.commit()
    return {"county_fips": county_fips, "already_marked": False}


@router.delete("/{country}/{county_fips}/manual", status_code=204)
def unmark_manual(country: str, county_fips: str, db: Session = Depends(get_db)):
    row = db.get(ManualCounty, county_fips)
    if not row:
        raise HTTPException(404, "County not manually marked")
    db.delete(row)
    db.commit()
