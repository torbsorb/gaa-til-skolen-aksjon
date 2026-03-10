from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
from models import SchoolClass, ClassGroup

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/classes")
def get_classes(db: Session = Depends(get_db)):
    classes = db.query(SchoolClass).all()
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
