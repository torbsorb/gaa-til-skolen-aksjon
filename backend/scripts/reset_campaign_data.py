from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from models import SurveyResult, CellEditAudit


def reset_campaign_data() -> int:
    db = SessionLocal()
    try:
        survey_before = db.query(SurveyResult).count()
        audit_before = db.query(CellEditAudit).count()

        db.query(SurveyResult).delete()
        db.query(CellEditAudit).delete()
        db.commit()

        survey_after = db.query(SurveyResult).count()
        audit_after = db.query(CellEditAudit).count()

        print(f"survey_results: {survey_before} -> {survey_after}")
        print(f"cell_edit_audit: {audit_before} -> {audit_after}")

        if survey_after == 0 and audit_after == 0:
            print("OK: Campaign data reset completed.")
            return 0

        print("FAIL: Campaign data reset incomplete.")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(reset_campaign_data())
