from fastapi import FastAPI, Depends, HTTPException, Body, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from class_api import router as class_router
from class_map import class_map, competition_map
from sqlalchemy.orm import Session
from sqlalchemy import func, inspect, text
from database import SessionLocal, engine, DATABASE_URL
from models import SurveyResult, SchoolClass, ClassGroup, CellEditAudit
from schemas import SurveyResultCreate, LeaderboardEntry
from datetime import date, timedelta
from pathlib import Path
import base64
import shutil
import os

APP_MODE = os.getenv("APP_MODE", "preview").strip().lower()
if APP_MODE not in {"preview", "campaign"}:
    APP_MODE = "preview"

BASE_DIR = Path(__file__).resolve().parent
LEGACY_LOGO_UPLOAD_DIR = BASE_DIR / "uploads" / "class-logos"
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}

ALLOWED_CLASS_NAMES = set()
for class_set in class_map:
    for class_dict in class_set:
        for class_name in class_dict.keys():
            ALLOWED_CLASS_NAMES.add(class_name)

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


def get_default_logo_data(class_name: str) -> bytes | None:
    """Load default SVG logo from frontend public folder and return as binary."""
    svg_path = BASE_DIR.parent / "frontend" / "public" / "class-logos" / f"{class_name}.svg"
    if svg_path.exists():
        with open(svg_path, "rb") as f:
            return f.read()
    return None


def get_legacy_uploaded_logo_file(class_name: str) -> Path | None:
    """Find legacy filesystem upload if one exists from the earlier storage approach."""
    for ext in ALLOWED_IMAGE_EXTENSIONS:
        candidate = LEGACY_LOGO_UPLOAD_DIR / f"{class_name}{ext}"
        if candidate.exists():
            return candidate
    return None


def ensure_logo_data_column_exists() -> bool:
    """Add the `logo_data` column in existing deployments where the table already exists."""
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("school_classes")}
    if "logo_data" in columns:
        return False

    column_type = "BYTEA" if engine.dialect.name == "postgresql" else "BLOB"
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE school_classes ADD COLUMN logo_data {column_type}"))

    print("Added missing logo_data column to school_classes.")
    return True


def calendar_day_for_working_day(working_day_num: int, start_date: date) -> date:
    """
    Convert abstract working day number (1-10) to actual calendar date (Mon-Fri only).
    Skips weekends.
    
    Example: With start_date=2026-04-13 (Monday):
    - working_day_num 1 → 2026-04-13 (Mon)
    - working_day_num 5 → 2026-04-17 (Fri)
    - working_day_num 6 → 2026-04-20 (Mon)
    - working_day_num 10 → 2026-04-24 (Fri)
    """
    current = start_date
    working_days_seen = 0
    
    while working_days_seen < working_day_num:
        # weekday() returns 0-6 (Mon-Sun), so 5=Sat, 6=Sun
        if current.weekday() < 5:  # Monday to Friday
            working_days_seen += 1
            if working_days_seen == working_day_num:
                return current
        current += timedelta(days=1)
    
    return current


def get_all_default_logos() -> dict[str, bytes]:
    """Load all default SVG logos from frontend public folder."""
    logos = {}
    class_logos_dir = BASE_DIR.parent / "frontend" / "public" / "class-logos"
    for class_name in sorted(ALLOWED_CLASS_NAMES):
        svg_path = class_logos_dir / f"{class_name}.svg"
        if svg_path.exists():
            with open(svg_path, "rb") as f:
                logos[class_name] = f.read()
    return logos


def detect_image_mime_type(image_data: bytes) -> str:
    """Infer the MIME type from raw image bytes so uploaded photos render correctly."""
    if not image_data:
        return "application/octet-stream"

    stripped = image_data.lstrip()
    if stripped.startswith(b"<svg") or b"<svg" in stripped[:300]:
        return "image/svg+xml"
    if image_data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if image_data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if image_data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if image_data[:4] == b"RIFF" and image_data[8:12] == b"WEBP":
        return "image/webp"

    return "application/octet-stream"


def ensure_reference_data(db: Session) -> bool:
    # Keep existing data intact; only add missing groups/classes and safe logo defaults.
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

    existing_classes = {c.name: c for c in db.query(SchoolClass).all()}
    default_logos = get_all_default_logos()

    for class_name, total_students in class_totals.items():
        group_name = class_to_group.get(class_name)
        if group_name is None:
            continue

        group_obj = groups_by_name.get(group_name)
        if group_obj is None:
            continue

        legacy_logo_file = get_legacy_uploaded_logo_file(class_name)
        desired_logo_data = (
            legacy_logo_file.read_bytes()
            if legacy_logo_file is not None
            else default_logos.get(class_name)
        )

        existing_class = existing_classes.get(class_name)
        if existing_class is not None:
            if existing_class.total_students != total_students:
                existing_class.total_students = total_students
                changed = True
            if existing_class.logo_data is None and desired_logo_data is not None:
                existing_class.logo_data = desired_logo_data
                changed = True
            continue

        db.add(
            SchoolClass(
                name=class_name,
                group_id=group_obj.id,
                total_students=total_students,
                logo_data=desired_logo_data,
            )
        )
        changed = True

    if changed:
        db.commit()

    return changed


def expected_preview_dates() -> list[date]:
    start_date = date(2026, 4, 13)
    return [calendar_day_for_working_day(day, start_date) for day in range(1, 11)]


def preview_data_needs_refresh(db: Session) -> bool:
    existing_dates = [row[0] for row in db.query(SurveyResult.date).distinct().order_by(SurveyResult.date).all()]
    if not existing_dates:
        return False
    return existing_dates != expected_preview_dates()


def seed_preview_data(db: Session, force: bool = False) -> bool:
    """Populate 10 working days of realistic fake survey data for preview/demo mode."""
    if not force and db.query(SurveyResult).count() > 0:
        return False  # Already has data, don't overwrite.

    import random
    random.seed(42)  # Deterministic so every cold-start gets identical data.

    classes = db.query(SchoolClass).all()
    if not classes:
        return False

    base_date = date(2026, 4, 13)  # Monday, start of campaign
    for school_class in classes:
        # Each class has its own "baseline" walk rate (60–95 %) with per-day noise.
        baseline = random.uniform(0.60, 0.95)
        for working_day in range(1, 11):
            rate = max(0.0, min(1.0, baseline + random.uniform(-0.10, 0.10)))
            walked = round(school_class.total_students * rate)
            target_date = calendar_day_for_working_day(working_day, base_date)
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
    global APP_MODE
    db = SessionLocal()
    try:
        ensure_logo_data_column_exists()

        # Auto-switch to campaign mode on/after Apr 13 if not explicitly set
        campaign_start = date(2026, 4, 13)
        if date.today() >= campaign_start and os.getenv("APP_MODE") is None:
            APP_MODE = "campaign"

        if ensure_reference_data(db):
            print("Bootstrapped missing class/group reference data and logo defaults.")
        if APP_MODE == "preview":
            if preview_data_needs_refresh(db):
                db.query(CellEditAudit).delete()
                db.query(SurveyResult).delete()
                db.commit()
                seed_preview_data(db, force=True)
                print("Refreshed preview simulation data to the April weekday schedule.")
            elif seed_preview_data(db):
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
def class_logo_map(db: Session = Depends(get_db)):
    """Return map of class names to data URLs from database-backed logos."""
    logo_map = {}
    for school_class in db.query(SchoolClass).all():
        if school_class.logo_data:
            b64_data = base64.b64encode(school_class.logo_data).decode("utf-8")
            mime_type = detect_image_mime_type(school_class.logo_data)
            logo_map[school_class.name] = f"data:{mime_type};base64,{b64_data}"
    return {"logos": logo_map}


@app.post("/admin/class-logo/{class_name}")
def upload_class_logo(class_name: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a logo for a class and store in database."""
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
            "image/svg+xml": ".svg",
        }
        ext = content_type_map.get(file.content_type or "", "")

    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    # Read the binary file content
    file_content = file.file.read()

    # Find the school class and update its logo_data
    school_class = db.query(SchoolClass).filter(SchoolClass.name == normalized_class_name).first()
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found in database")

    try:
        school_class.logo_data = file_content
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"Failed to save logo for {normalized_class_name}: {exc}")
        raise HTTPException(status_code=500, detail="Could not save logo in database") from exc

    return {
        "success": True,
        "class_name": normalized_class_name,
        "message": "Logo uploaded successfully",
    }


@app.delete("/admin/class-logo/{class_name}")
def reset_class_logo(class_name: str, db: Session = Depends(get_db)):
    """Reset class logo to default by loading original SVG into database."""
    normalized_class_name = class_name.strip().upper()
    if normalized_class_name not in ALLOWED_CLASS_NAMES:
        raise HTTPException(status_code=404, detail="Unknown class")

    school_class = db.query(SchoolClass).filter(SchoolClass.name == normalized_class_name).first()
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found in database")
    
    # Load default logo from frontend folder
    default_logo = get_default_logo_data(normalized_class_name)

    try:
        school_class.logo_data = default_logo
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"Failed to reset logo for {normalized_class_name}: {exc}")
        raise HTTPException(status_code=500, detail="Could not reset logo in database") from exc

    return {
        "success": True,
        "class_name": normalized_class_name,
        "reset_to_default": True,
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
    custom_logo_rows = db.query(SchoolClass).filter(SchoolClass.logo_data.isnot(None)).count()
    return {
        "app_mode": APP_MODE,
        "simulation_enabled": APP_MODE == "preview",
        "campaign_db_clean": survey_rows == 0 and audit_rows == 0,
        "survey_results_rows": survey_rows,
        "cell_edit_audit_rows": audit_rows,
        "logo_storage": "database",
        "database_backend": "postgresql" if DATABASE_URL.startswith("postgresql://") else "sqlite",
        "classes_with_logo_data": custom_logo_rows,
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
def working_day_for_calendar_date(calendar_date: date, start_date: date) -> int | None:
    """
    Convert calendar date back to working day number (1-10).
    Returns None if the date is not a working day or outside the 10-day window.
    """
    if calendar_date < start_date:
        return None
    
    current = start_date
    working_day = 0
    
    while current <= calendar_date:
        if current.weekday() < 5:  # Monday to Friday
            working_day += 1
            if current == calendar_date:
                return working_day if working_day <= 10 else None
        if working_day > 10:
            return None
        current += timedelta(days=1)
    
    return None


@app.get("/results-table")
def get_results_table(db: Session = Depends(get_db)):
    # Get all classes
    classes = db.query(SchoolClass).all()
    # Get all survey results
    results = db.query(SurveyResult).all()
    # Determine the base date (earliest date in results, or default to Apr 13)
    if results:
        base_date = min(r.date for r in results)
    else:
        base_date = date(2026, 4, 13)
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
        # Convert calendar date to working day number
        day_num = working_day_for_calendar_date(r.date, base_date)
        if day_num and 1 <= day_num <= 10:
            table[r.class_id][str(day_num)] = r.walked_count

    audits = db.query(CellEditAudit).all()
    for a in audits:
        # Convert calendar date to working day number
        day_num = working_day_for_calendar_date(a.date, base_date)
        if day_num and 1 <= day_num <= 10 and a.class_id in edit_counts:
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
    # Use earliest existing date as day 1, or Apr 13 if no rows exist yet.
    first_result = db.query(SurveyResult).order_by(SurveyResult.date).first()
    base_date = first_result.date if first_result else date(2026, 4, 13)
    # Convert working day number to calendar date (skipping weekends)
    target_date = calendar_day_for_working_day(day, base_date)
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
    trusted_localhost = client_host in {"127.0.0.1", "::1", "localhost"}
    forwarded_for = request.headers.get("x-forwarded-for")
    provided_token = request.headers.get("x-admin-token", "").strip()
    configured_token = os.getenv("ADMIN_MARK_CLEAN_TOKEN", "").strip()

    # Remote requests behind a proxy must provide a secret token.
    # This blocks spoofing localhost via X-Forwarded-For.
    token_is_valid = bool(configured_token) and provided_token == configured_token
    if not (token_is_valid or (trusted_localhost and not forwarded_for)):
        raise HTTPException(
            status_code=403,
            detail="Only direct localhost or a valid admin token can mark database clean",
        )

    db.query(CellEditAudit).delete()
    db.commit()
    return {"success": True}
