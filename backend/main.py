
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from class_api import router as class_router
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import SessionLocal
from models import SurveyResult, SchoolClass, ClassGroup
from schemas import SurveyResultCreate, LeaderboardEntry
from datetime import date


app = FastAPI()
app.include_router(class_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Backend is running"}

@app.post("/survey")
def submit_survey(result: SurveyResultCreate, db: Session = Depends(get_db)):
    # Check class exists
    school_class = db.query(SchoolClass).filter(SchoolClass.id == result.class_id).first()
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")
    # Check if already submitted for this date
    existing = db.query(SurveyResult).filter(
        SurveyResult.class_id == result.class_id,
        SurveyResult.date == result.date
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Survey already submitted for this class today")
    survey = SurveyResult(
        class_id=result.class_id,
        date=result.date,
        walked_count=result.walked_count,
        total_students=result.total_students
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return {"success": True, "survey_id": survey.id}

@app.get("/standings", response_model=list[LeaderboardEntry])
def get_standings(db: Session = Depends(get_db)):
    groups = db.query(ClassGroup).all()
    leaderboard = []
    for group in groups:
        class_entries = []
        for school_class in group.classes:
            results = db.query(SurveyResult).filter(SurveyResult.class_id == school_class.id).all()
            walked_total = sum(r.walked_count for r in results)
            # Always use the class's total_students value
            total_students = school_class.total_students
            percent_walked = (walked_total / total_students * 100) if total_students else 0
            class_entries.append({
                "group_id": group.id,
                "group_name": group.name,
                "class_id": school_class.id,
                "class_name": school_class.name,
                "walked_total": walked_total,
                "total_students": total_students,
                "percent_walked": percent_walked
            })
        # Always include all classes in all groups
        leaderboard.extend([LeaderboardEntry(**entry) for entry in class_entries])
    return leaderboard
