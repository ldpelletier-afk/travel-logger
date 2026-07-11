from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Entry, ManualCounty
from ..schemas import CountyStats, VisitedCounty
from ..services import geo

router = APIRouter(prefix="/api/counties", tags=["counties"])


def visited_map(db: Session) -> dict[str, list[str]]:
    """county_fips -> sources ('entry' and/or 'manual')."""
    out: dict[str, list[str]] = {}
    entry_fips = db.scalars(
        select(Entry.county_fips)
        .where(Entry.status == "visited", Entry.county_fips.is_not(None))
        .distinct()
    ).all()
    for f in entry_fips:
        out.setdefault(f, []).append("entry")
    for f in db.scalars(select(ManualCounty.county_fips)).all():
        out.setdefault(f, []).append("manual")
    return out


@router.get("/visited", response_model=list[VisitedCounty])
def visited_counties(db: Session = Depends(get_db)):
    return [
        VisitedCounty(county_fips=f, sources=s)
        for f, s in sorted(visited_map(db).items())
    ]


@router.get("/stats", response_model=CountyStats)
def county_stats(db: Session = Depends(get_db)):
    visited = len(visited_map(db))
    total = geo.county_total()
    return CountyStats(visited=visited, total=total, percent=round(100 * visited / total, 2))


@router.post("/{county_fips}/manual", status_code=201)
def mark_manual(county_fips: str, db: Session = Depends(get_db)):
    if len(county_fips) != 5 or not county_fips.isdigit():
        raise HTTPException(422, "county_fips must be 5 digits")
    if db.get(ManualCounty, county_fips):
        return {"county_fips": county_fips, "already_marked": True}
    db.add(ManualCounty(county_fips=county_fips))
    db.commit()
    return {"county_fips": county_fips, "already_marked": False}


@router.delete("/{county_fips}/manual", status_code=204)
def unmark_manual(county_fips: str, db: Session = Depends(get_db)):
    row = db.get(ManualCounty, county_fips)
    if not row:
        raise HTTPException(404, "County not manually marked")
    db.delete(row)
    db.commit()
