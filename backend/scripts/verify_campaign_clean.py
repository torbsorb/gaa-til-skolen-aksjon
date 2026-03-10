from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from models import SurveyResult, CellEditAudit


def verify_campaign_clean() -> int:
    db = SessionLocal()
    try:
        survey_rows = db.query(SurveyResult).count()
        audit_rows = db.query(CellEditAudit).count()

        print(f"survey_results rows: {survey_rows}")
        print(f"cell_edit_audit rows: {audit_rows}")

        if survey_rows == 0 and audit_rows == 0:
            print("OK: Campaign DB is clean.")
            return 0

        print("FAIL: Campaign DB is not clean.")
        print("Run your clean/reset process before APP_MODE=campaign.")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(verify_campaign_clean())
