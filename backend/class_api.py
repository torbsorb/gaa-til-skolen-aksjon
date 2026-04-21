import re

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
from models import SchoolClass, ClassGroup

router = APIRouter()

CLASS_NAME_SPLIT_RE = re.compile(r"(\d+)")


def class_name_sort_key(name: str) -> list[object]:
    """Natural sort key so class names like 1C/3C stay in expected order."""
    safe_name = name or ""
    key_parts: list[object] = []
    for token in CLASS_NAME_SPLIT_RE.split(safe_name):
        if not token:
            continue
        key_parts.append(int(token) if token.isdigit() else token.casefold())
    return key_parts

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/classes")
def get_classes(db: Session = Depends(get_db)):
    classes = sorted(
        db.query(SchoolClass).all(),
        key=lambda c: (class_name_sort_key(c.name), c.id),
    )
    return [
        {
            "id": c.id,
            "name": c.name,
            "group_id": c.group_id,
            "group_name": c.group.name if c.group else None,
            "total_students": c.total_students
        }
        for c in classes
    ]
