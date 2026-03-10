from datetime import date, timedelta
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from database import SessionLocal
from models import SchoolClass, SurveyResult, CellEditAudit


PROFILES = {
    1:  (0.14, 0.92, 0.40, 0.22),
    2:  (0.15, 0.96, 0.38, 0.18),
    3:  (0.13, 0.74, 0.52, 0.30),
    4:  (0.12, 0.56, 0.78, 0.40),
    5:  (0.14, 0.50, 0.60, 0.86),
    6:  (0.11, 0.42, 0.94, 0.34),
    7:  (0.12, 0.46, 0.58, 0.74),
    8:  (0.13, 0.34, 0.96, 0.36),
    9:  (0.10, 0.22, 0.44, 0.98),
    10: (0.11, 0.24, 0.46, 0.96),
    11: (0.14, 0.96, 0.34, 0.18),
    12: (0.13, 0.78, 0.52, 0.34),
    13: (0.12, 0.62, 0.72, 0.44),
    14: (0.11, 0.30, 0.96, 0.36),
    15: (0.12, 0.44, 0.66, 0.62),
    16: (0.11, 0.40, 0.56, 0.82),
    17: (0.10, 0.36, 0.52, 0.88),
    18: (0.09, 0.20, 0.42, 0.99),
}


def early(day: int) -> float:
    if day <= 3:
        return 1.0
    if day <= 5:
        return (5.0 - day) / 2.0
    return 0.0


def mid(day: int) -> float:
    if day <= 2:
        return 0.0
    if day <= 4:
        return (day - 2.0) / 2.0
    if day <= 7:
        return 1.0
    if day == 8:
        return 0.6
    return 0.2


def late(day: int) -> float:
    if day <= 6:
        return 0.0
    if day <= 8:
        return (day - 6.0) / 2.0
    return 1.0


def generate_count(class_id: int, total_students: int, day_idx: int) -> int:
    base, e_w, m_w, l_w = PROFILES[class_id]
    frac = (
        base
        + 0.32 * e_w * early(day_idx)
        + 0.32 * m_w * mid(day_idx)
        + 0.32 * l_w * late(day_idx)
        + ((class_id % 11) - 5) * 0.004
        + (((class_id * day_idx) % 5) - 2) * 0.008
    )
    walked = round(total_students * frac)
    return max(0, min(total_students, walked))


def seed_preview_data() -> None:
    db = SessionLocal()
    try:
        classes = db.query(SchoolClass).order_by(SchoolClass.id).all()
        if not classes:
            raise RuntimeError("No classes found. Run class initialization first.")

        db.query(SurveyResult).delete()
        db.query(CellEditAudit).delete()

        start_date = date(2026, 3, 1)
        rows = []
        for school_class in classes:
            if school_class.id not in PROFILES:
                raise RuntimeError(f"Missing profile for class id {school_class.id}")
            for day_idx in range(1, 11):
                d = start_date + timedelta(days=day_idx - 1)
                walked = generate_count(
                    school_class.id,
                    school_class.total_students,
                    day_idx,
                )
                rows.append(
                    SurveyResult(
                        class_id=school_class.id,
                        date=d,
                        walked_count=walked,
                        total_students=school_class.total_students,
                    )
                )

        db.add_all(rows)
        db.commit()

        # Add storyline tweaks for shifting leaders across the campaign.
        def set_count(class_id: int, date_str: str, value: int):
            row = (
                db.query(SurveyResult)
                .filter(
                    SurveyResult.class_id == class_id,
                    SurveyResult.date == date.fromisoformat(date_str),
                )
                .first()
            )
            if row is None:
                return
            row.walked_count = max(0, min(value, row.total_students))

        # Class 11 leads early.
        set_count(11, "2026-03-01", 12)
        # Class 2 surges mid-campaign.
        for date_str, value in [
            ("2026-03-04", 15),
            ("2026-03-05", 11),
            ("2026-03-06", 12),
            ("2026-03-08", 3),
            ("2026-03-09", 2),
            ("2026-03-10", 1),
        ]:
            set_count(2, date_str, value)
        # Class 8 wins late.
        for date_str, value in [
            ("2026-03-08", 18),
            ("2026-03-09", 20),
            ("2026-03-10", 22),
        ]:
            set_count(8, date_str, value)

        db.commit()

        row_count = db.query(SurveyResult).count()
        print(f"Seed complete. Inserted {row_count} survey rows.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_preview_data()
