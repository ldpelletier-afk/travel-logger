from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Category, Entry
from ..schemas import CategoryIn, CategoryOut

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    counts = dict(
        db.execute(
            select(Entry.category_id, func.count()).group_by(Entry.category_id)
        ).all()
    )
    cats = db.scalars(select(Category).order_by(Category.name)).all()
    out = []
    for c in cats:
        item = CategoryOut.model_validate(c)
        item.entry_count = counts.get(c.id, 0)
        out.append(item)
    return out


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryIn, db: Session = Depends(get_db)):
    if db.scalar(select(Category).where(Category.name == body.name)):
        raise HTTPException(409, "Category name already exists")
    cat = Category(**body.model_dump())
    db.add(cat)
    db.commit()
    return cat


@router.patch("/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: int, body: CategoryIn, db: Session = Depends(get_db)):
    cat = db.get(Category, cat_id)
    if not cat:
        raise HTTPException(404, "Category not found")
    dup = db.scalar(select(Category).where(Category.name == body.name, Category.id != cat_id))
    if dup:
        raise HTTPException(409, "Category name already exists")
    for k, v in body.model_dump().items():
        setattr(cat, k, v)
    db.commit()
    return cat


@router.delete("/{cat_id}", status_code=204)
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, cat_id)
    if not cat:
        raise HTTPException(404, "Category not found")
    in_use = db.scalar(select(func.count()).where(Entry.category_id == cat_id))
    if in_use:
        raise HTTPException(409, f"Category has {in_use} entries; reassign them first")
    db.delete(cat)
    db.commit()
