from pathlib import Path
import os
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from models import SurveyResult, CellEditAudit


def preflight_deploy_check() -> int:
    app_mode = os.getenv("APP_MODE", "preview").strip().lower()
    database_url = os.getenv("DATABASE_URL", "").strip()

    failures = []

    if app_mode not in {"preview", "campaign"}:
        failures.append("APP_MODE must be preview or campaign.")

    if not database_url:
        failures.append("DATABASE_URL is not set.")
    elif database_url.startswith("sqlite://"):
        failures.append("DATABASE_URL points to SQLite. Use Postgres for deployment.")

    db = SessionLocal()
    try:
        survey_rows = db.query(SurveyResult).count()
        audit_rows = db.query(CellEditAudit).count()
    except Exception as exc:
        failures.append(f"Database check failed: {exc}")
        survey_rows = -1
        audit_rows = -1
    finally:
        db.close()

    print(f"APP_MODE={app_mode}")
    print(f"DATABASE_URL_SET={'yes' if bool(database_url) else 'no'}")
    print(f"survey_results_rows={survey_rows}")
    print(f"cell_edit_audit_rows={audit_rows}")

    if app_mode == "campaign" and (survey_rows != 0 or audit_rows != 0):
        failures.append(
            "Campaign mode requires clean DB (survey_results and cell_edit_audit must be empty)."
        )

    if failures:
        print("PRECHECK FAIL:")
        for item in failures:
            print(f"- {item}")
        return 1

    print("PRECHECK OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(preflight_deploy_check())
