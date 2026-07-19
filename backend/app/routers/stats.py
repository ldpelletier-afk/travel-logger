from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Category, Entry, Photo
from ..schemas import CategoryCount, StateVisitStats, Stats
from ..services import geo
from .counties import visited_map

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=Stats)
def get_stats(db: Session = Depends(get_db)):
    total_entries = db.scalar(select(func.count()).select_from(Entry)) or 0
    total_photos = db.scalar(select(func.count()).select_from(Photo)) or 0

    rows = db.execute(
        select(Category.id, Category.name, Category.color, Category.icon, func.count(Entry.id))
        .outerjoin(Entry, Entry.category_id == Category.id)
        .group_by(Category.id)
        .order_by(Category.name)
    ).all()
    by_category = [
        CategoryCount(category_id=cid, name=name, color=color, icon=icon, count=count)
        for cid, name, color, icon, count in rows
    ]

    first_date, last_date = db.execute(
        select(func.min(Entry.visit_date), func.max(Entry.visit_date))
    ).one()

    visited = visited_map(db)
    by_state = []
    for (country, fips), info in sorted(geo.region_breakdown().items()):
        geoids = info["geoids"]
        visited_count = sum(1 for g in geoids if g in visited)
        total = len(geoids)
        by_state.append(
            StateVisitStats(
                country=country,
                state_fips=fips,
                name=info["name"],
                abbr=info["abbr"],
                visited=visited_count,
                total=total,
                percent=round(100 * visited_count / total, 1) if total else 0.0,
            )
        )

    return Stats(
        total_entries=total_entries,
        total_photos=total_photos,
        by_category=by_category,
        first_visit_date=first_date,
        last_visit_date=last_date,
        by_state=by_state,
    )
