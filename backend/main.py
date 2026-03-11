from fastapi import FastAPI, Depends, HTTPException, Body, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from class_api import router as class_router
from class_map import class_map, competition_map
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import SessionLocal
from models import SurveyResult, SchoolClass, ClassGroup, CellEditAudit
from schemas import SurveyResultCreate, LeaderboardEntry
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote
import shutil
import os

APP_MODE = os.getenv("APP_MODE", "preview").strip().lower()
if APP_MODE not in {"preview", "campaign"}:
    APP_MODE = "preview"

BASE_DIR = Path(__file__).resolve().parent
LOGO_UPLOAD_DIR = BASE_DIR / "uploads" / "class-logos"
LOGO_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

ALLOWED_CLASS_NAMES = set()
for class_set in class_map:
    for class_dict in class_set:
        for class_name in class_dict.keys():
            ALLOWED_CLASS_NAMES.add(class_name)

app = FastAPI()
app.include_router(class_router)
app.mount("/uploaded-class-logos", StaticFiles(directory=str(LOGO_UPLOAD_DIR)), name="uploaded-class-logos")
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


def get_uploaded_logo_file(class_name: str) -> Path | None:
    for ext in ALLOWED_IMAGE_EXTENSIONS:
        candidate = LOGO_UPLOAD_DIR / f"{class_name}{ext}"
        if candidate.exists():
            return candidate
    return None


def build_uploaded_logo_url(request: Request, class_name: str, file_path: Path) -> str:
    version = int(file_path.stat().st_mtime)
    base = str(request.base_url).rstrip("/")
    safe_name = quote(class_name)
    return f"{base}/uploaded-class-logos/{safe_name}{file_path.suffix}?v={version}"


def ensure_reference_data(db: Session) -> bool:
    # Keep existing data intact; only add missing groups/classes.
    changed = False

    groups_by_name = {g.name: g for g in db.query(ClassGroup).all()}
    for group in competition_map:
        for group_name in group.keys():
            if group_name not in groups_by_name:
                new_group = ClassGroup(name=group_name)
                db.add(new_group)
                db.flush()
                groups_by_name[group_name] = new_group
                changed = True

    class_to_group = {}
    for group in competition_map:
        for group_name, class_names in group.items():
            for class_name in class_names:
                class_to_group[class_name] = group_name

    class_totals = {}
    for class_set in class_map:
        for class_dict in class_set:
            for class_name, total_students in class_dict.items():
                class_totals[class_name] = total_students

    existing_class_names = {c.name for c in db.query(SchoolClass).all()}
    for class_name, total_students in class_totals.items():
        if class_name in existing_class_names:
            continue
        group_name = class_to_group.get(class_name)
        if group_name is None:
            continue
        group_obj = groups_by_name.get(group_name)
        if group_obj is None:
            continue
        db.add(
            SchoolClass(
                name=class_name,
                group_id=group_obj.id,
                total_students=total_students,
            )
        )
        changed = True

    if changed:
        db.commit()

    return changed


def seed_preview_data(db: Session, force: bool = False) -> bool:
    """Populate 10 days of realistic fake survey data for preview/demo mode."""
    if not force and db.query(SurveyResult).count() > 0:
        return False  # Already has data, don't overwrite.

    import random
    random.seed(42)  # Deterministic so every cold-start gets identical data.

    classes = db.query(SchoolClass).all()
    if not classes:
        return False

    base_date = date(2026, 3, 1)
    for school_class in classes:
        # Each class has its own "baseline" walk rate (60–95 %) with per-day noise.
        baseline = random.uniform(0.60, 0.95)
        for day in range(1, 11):
            rate = max(0.0, min(1.0, baseline + random.uniform(-0.10, 0.10)))
            walked = round(school_class.total_students * rate)
            target_date = base_date + timedelta(days=day - 1)
            db.add(
                SurveyResult(
                    class_id=school_class.id,
                    date=target_date,
                    walked_count=walked,
                    total_students=school_class.total_students,
                )
            )

    db.commit()
    return True


@app.on_event("startup")
def bootstrap_reference_data():
    db = SessionLocal()
    try:
        if ensure_reference_data(db):
            print("Bootstrapped missing class/group reference data.")
        if APP_MODE == "preview":
            if seed_preview_data(db):
                print("Seeded preview simulation data.")
    finally:
        db.close()


@app.post("/admin/reset-preview-data")
def reset_preview_data(db: Session = Depends(get_db)):
    """Delete all survey results and re-seed preview data. Only available in preview mode."""
    if APP_MODE != "preview":
        raise HTTPException(status_code=403, detail="Only available in preview mode")
    db.query(CellEditAudit).delete()
    db.query(SurveyResult).delete()
    db.commit()
    seed_preview_data(db, force=True)
    return {"success": True, "message": "Simulerte data gjenopprettet"}


@app.get("/")
def read_root():
    return {"message": "Backend is running"}


@app.get("/app-config")
def app_config():
    return {
        "app_mode": APP_MODE,
        "simulation_enabled": APP_MODE == "preview",
    }


@app.get("/admin/class-logo-map")
def class_logo_map(request: Request):
    logo_map = {}
    for class_name in sorted(ALLOWED_CLASS_NAMES):
        file_path = get_uploaded_logo_file(class_name)
        if file_path:
            logo_map[class_name] = build_uploaded_logo_url(request, class_name, file_path)
    return {"logos": logo_map}


@app.post("/admin/class-logo/{class_name}")
def upload_class_logo(class_name: str, request: Request, file: UploadFile = File(...)):
    normalized_class_name = class_name.strip().upper()
    if normalized_class_name not in ALLOWED_CLASS_NAMES:
        raise HTTPException(status_code=404, detail="Unknown class")

    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        content_type_map = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }
        ext = content_type_map.get(file.content_type or "", "")

    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    for existing_ext in ALLOWED_IMAGE_EXTENSIONS:
        existing_file = LOGO_UPLOAD_DIR / f"{normalized_class_name}{existing_ext}"
        if existing_file.exists():
            existing_file.unlink()

    output_file = LOGO_UPLOAD_DIR / f"{normalized_class_name}{ext}"
    with output_file.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    return {
        "success": True,
        "class_name": normalized_class_name,
        "logo_url": build_uploaded_logo_url(request, normalized_class_name, output_file),
    }


@app.delete("/admin/class-logo/{class_name}")
def reset_class_logo(class_name: str):
    normalized_class_name = class_name.strip().upper()
    if normalized_class_name not in ALLOWED_CLASS_NAMES:
        raise HTTPException(status_code=404, detail="Unknown class")

    removed = False
    for existing_ext in ALLOWED_IMAGE_EXTENSIONS:
        existing_file = LOGO_UPLOAD_DIR / f"{normalized_class_name}{existing_ext}"
        if existing_file.exists():
            existing_file.unlink()
            removed = True

    return {
        "success": True,
        "class_name": normalized_class_name,
        "reset_to_default": True,
        "removed_uploaded_file": removed,
    }


@app.post("/admin/reset-and-seed-preview")
def reset_and_seed_preview(db: Session = Depends(get_db)):
    if APP_MODE != "preview":
        raise HTTPException(status_code=403, detail="Only available in preview mode")
    db.query(CellEditAudit).delete()
    db.query(SurveyResult).delete()
    db.commit()
    seeded = seed_preview_data(db)
    return {"ok": True, "seeded": seeded}


@app.get("/admin/deployment-status")
def deployment_status(db: Session = Depends(get_db)):
    survey_rows = db.query(SurveyResult).count()
    audit_rows = db.query(CellEditAudit).count()
    return {
        "app_mode": APP_MODE,
        "simulation_enabled": APP_MODE == "preview",
        "campaign_db_clean": survey_rows == 0 and audit_rows == 0,
        "survey_results_rows": survey_rows,
        "cell_edit_audit_rows": audit_rows,
    }


@app.post("/survey")
def submit_survey(result: SurveyResultCreate, db: Session = Depends(get_db)):
    # Check class exists
    school_class = (
        db.query(SchoolClass).filter(SchoolClass.id == result.class_id).first()
    )
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")
    # Check if already submitted for this date
    existing = (
        db.query(SurveyResult)
        .filter(
            SurveyResult.class_id == result.class_id, SurveyResult.date == result.date
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Survey already submitted for this class today"
        )
    survey = SurveyResult(
        class_id=result.class_id,
        date=result.date,
        walked_count=result.walked_count,
        total_students=result.total_students,
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return {"success": True, "survey_id": survey.id}


@app.get("/standings", response_model=list[LeaderboardEntry])
def get_standings(db: Session = Depends(get_db)):
    groups = db.query(ClassGroup).all()
    # Number of competition days with at least one submitted result.
    days_elapsed = db.query(func.count(func.distinct(SurveyResult.date))).scalar() or 0
    leaderboard = []
    for group in groups:
        class_entries = []
        for school_class in group.classes:
            results = (
                db.query(SurveyResult)
                .filter(SurveyResult.class_id == school_class.id)
                .all()
            )
            walked_total = sum(r.walked_count for r in results)
            # Always use the class's total_students value
            total_students = school_class.total_students
            denominator = total_students * days_elapsed
            percent_walked = (walked_total / denominator * 100) if denominator else 0
            class_entries.append(
                {
                    "group_id": group.id,
                    "group_name": group.name,
                    "class_id": school_class.id,
                    "class_name": school_class.name,
                    "walked_total": walked_total,
                    "total_students": total_students,
                    "percent_walked": percent_walked,
                }
            )
        # Always include all classes in all groups
        leaderboard.extend([LeaderboardEntry(**entry) for entry in class_entries])
    return leaderboard


# --- Editable Table Endpoints ---
@app.get("/results-table")
def get_results_table(db: Session = Depends(get_db)):
    # Get all classes
    classes = db.query(SchoolClass).all()
    # Get all survey results
    results = db.query(SurveyResult).all()
    # Determine the base date (earliest date in results, or today if none)
    if results:
        base_date = min(r.date for r in results)
    else:
        base_date = date.today()
    # Build dicts: {class_id: {day: value}}
    table = {}
    edit_counts = {}
    for c in classes:
        table[c.id] = {}
        edit_counts[c.id] = {}
        for day in range(1, 11):
            table[c.id][str(day)] = ""
            edit_counts[c.id][str(day)] = 0
    for r in results:
        day_num = (r.date - base_date).days + 1
        if 1 <= day_num <= 10:
            table[r.class_id][str(day_num)] = r.walked_count

    audits = db.query(CellEditAudit).all()
    for a in audits:
        day_num = (a.date - base_date).days + 1
        if 1 <= day_num <= 10 and a.class_id in edit_counts:
            edit_counts[a.class_id][str(day_num)] = a.edit_count

    return {"table": table, "edit_counts": edit_counts, "base_date": str(base_date)}


# Upsert a single cell (class/day)
@app.put("/survey")
def upsert_survey(
    class_id: int = Body(...),
    day: int = Body(...),
    walked_count: int = Body(...),
    db: Session = Depends(get_db),
):
    # Use earliest existing date as day 1, or today if no rows exist yet.
    first_result = db.query(SurveyResult).order_by(SurveyResult.date).first()
    base_date = first_result.date if first_result else date.today()
    target_date = base_date + timedelta(days=day - 1)
    # Find or create the result
    result = (
        db.query(SurveyResult)
        .filter(SurveyResult.class_id == class_id, SurveyResult.date == target_date)
        .first()
    )
    school_class = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")
    if result:
        result.walked_count = walked_count
        result.total_students = school_class.total_students
    else:
        result = SurveyResult(
            class_id=class_id,
            date=target_date,
            walked_count=walked_count,
            total_students=school_class.total_students,
        )
        db.add(result)

    audit = (
        db.query(CellEditAudit)
        .filter(CellEditAudit.class_id == class_id, CellEditAudit.date == target_date)
        .first()
    )
    if audit:
        audit.edit_count += 1
    else:
        audit = CellEditAudit(class_id=class_id, date=target_date, edit_count=1)
        db.add(audit)

    db.commit()
    return {"success": True, "edit_count": audit.edit_count}


@app.post("/admin/mark-clean")
def mark_clean(request: Request, db: Session = Depends(get_db)):
    client_host = request.client.host if request.client else ""
    if client_host not in {"127.0.0.1", "::1", "localhost"}:
        raise HTTPException(status_code=403, detail="Only localhost can mark database clean")

    db.query(CellEditAudit).delete()
    db.commit()
    return {"success": True}
