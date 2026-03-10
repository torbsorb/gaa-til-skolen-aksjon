from pathlib import Path
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[1]))

from models import Base, ClassGroup, SchoolClass, SurveyResult, CellEditAudit


def normalize_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def migrate_sqlite_to_postgres() -> int:
    backend_dir = Path(__file__).resolve().parents[1]
    source_url = os.getenv("SQLITE_SOURCE_URL") or f"sqlite:///{backend_dir / 'survey.db'}"
    target_url = os.getenv("DATABASE_URL")

    if not target_url:
        print("FAIL: DATABASE_URL is not set.")
        return 1

    source_url = normalize_db_url(source_url)
    target_url = normalize_db_url(target_url)

    if not source_url.startswith("sqlite://"):
        print("FAIL: SQLITE_SOURCE_URL must point to a sqlite database.")
        return 1

    if target_url.startswith("sqlite://"):
        print("FAIL: DATABASE_URL must point to postgres for this migration script.")
        return 1

    source_engine = create_engine(source_url, connect_args={"check_same_thread": False})
    target_engine = create_engine(target_url, pool_pre_ping=True)

    SourceSession = sessionmaker(bind=source_engine, autocommit=False, autoflush=False)
    TargetSession = sessionmaker(bind=target_engine, autocommit=False, autoflush=False)

    Base.metadata.create_all(bind=target_engine)

    source_db = SourceSession()
    target_db = TargetSession()

    try:
        groups = source_db.query(ClassGroup).order_by(ClassGroup.id).all()
        classes = source_db.query(SchoolClass).order_by(SchoolClass.id).all()
        survey_rows = source_db.query(SurveyResult).order_by(SurveyResult.id).all()
        audit_rows = source_db.query(CellEditAudit).order_by(CellEditAudit.id).all()

        target_db.query(SurveyResult).delete()
        target_db.query(CellEditAudit).delete()
        target_db.query(SchoolClass).delete()
        target_db.query(ClassGroup).delete()
        target_db.flush()

        for row in groups:
            target_db.add(ClassGroup(id=row.id, name=row.name))

        for row in classes:
            target_db.add(
                SchoolClass(
                    id=row.id,
                    name=row.name,
                    group_id=row.group_id,
                    total_students=row.total_students,
                )
            )

        for row in survey_rows:
            target_db.add(
                SurveyResult(
                    id=row.id,
                    class_id=row.class_id,
                    date=row.date,
                    walked_count=row.walked_count,
                    total_students=row.total_students,
                )
            )

        for row in audit_rows:
            target_db.add(
                CellEditAudit(
                    id=row.id,
                    class_id=row.class_id,
                    date=row.date,
                    edit_count=row.edit_count,
                )
            )

        target_db.commit()

        print("OK: Migration completed.")
        print(f"class_groups: {len(groups)}")
        print(f"school_classes: {len(classes)}")
        print(f"survey_results: {len(survey_rows)}")
        print(f"cell_edit_audit: {len(audit_rows)}")
        return 0
    except Exception as exc:
        target_db.rollback()
        print(f"FAIL: Migration failed: {exc}")
        return 1
    finally:
        source_db.close()
        target_db.close()


if __name__ == "__main__":
    raise SystemExit(migrate_sqlite_to_postgres())
