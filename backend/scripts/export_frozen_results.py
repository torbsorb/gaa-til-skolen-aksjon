import argparse
import base64
import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
import re
import sys

from sqlalchemy import func

sys.path.append(str(Path(__file__).resolve().parents[1]))

from class_map import class_map, competition_map
from database import SessionLocal
from models import CellEditAudit, ClassGroup, SchoolClass, SurveyResult


CLASS_NAME_SPLIT_RE = re.compile(r"(\d+)")


def class_name_sort_key(name: str) -> list[object]:
    safe_name = name or ""
    key_parts: list[object] = []
    for token in CLASS_NAME_SPLIT_RE.split(safe_name):
        if not token:
            continue
        key_parts.append(int(token) if token.isdigit() else token.casefold())
    return key_parts


def detect_image_mime_type(image_data: bytes) -> str:
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


def calendar_day_for_working_day(working_day_num: int, start_date: date) -> date:
    current = start_date
    working_days_seen = 0

    while working_days_seen < working_day_num:
        if current.weekday() < 5:
            working_days_seen += 1
            if working_days_seen == working_day_num:
                return current
        current += timedelta(days=1)

    return current


def working_day_for_calendar_date(calendar_date: date, start_date: date) -> int | None:
    if calendar_date < start_date:
        return None

    current = start_date
    working_day = 0

    while current <= calendar_date:
        if current.weekday() < 5:
            working_day += 1
            if current == calendar_date:
                return working_day if working_day <= 10 else None
        if working_day > 10:
            return None
        current += timedelta(days=1)

    return None


def build_group_maps() -> tuple[dict[str, int], dict[str, str]]:
    group_name_to_id: dict[str, int] = {}
    class_to_group_name: dict[str, str] = {}

    for idx, group in enumerate(competition_map, start=1):
        for group_name, class_names in group.items():
            group_name_to_id[group_name] = idx
            for class_name in class_names:
                class_to_group_name[class_name] = group_name

    return group_name_to_id, class_to_group_name


def fallback_classes() -> list[dict[str, object]]:
    group_name_to_id, class_to_group_name = build_group_maps()
    fallback_rows: list[dict[str, object]] = []
    next_id = 1

    for class_set in class_map:
        for class_dict in class_set:
            for class_name, total_students in class_dict.items():
                group_name = class_to_group_name.get(class_name, "Ukjent")
                fallback_rows.append(
                    {
                        "id": next_id,
                        "name": class_name,
                        "group_id": group_name_to_id.get(group_name, 0),
                        "group_name": group_name,
                        "total_students": total_students,
                    }
                )
                next_id += 1

    return sorted(
        fallback_rows,
        key=lambda c: (c["group_id"], class_name_sort_key(str(c["name"])), c["id"]),
    )


def export_snapshot(output_path: Path) -> int:
    db = SessionLocal()
    try:
        db_classes = db.query(SchoolClass).all()
        db_results = db.query(SurveyResult).all()
        db_audits = db.query(CellEditAudit).all()

        group_name_to_id, class_to_group_name = build_group_maps()

        if db_classes:
            classes = sorted(
                [
                    {
                        "id": c.id,
                        "name": c.name,
                        "group_id": c.group_id
                        if c.group_id is not None
                        else group_name_to_id.get(class_to_group_name.get(c.name, ""), 0),
                        "group_name": (
                            c.group.name
                            if c.group
                            else class_to_group_name.get(c.name, "Ukjent")
                        ),
                        "total_students": c.total_students,
                    }
                    for c in db_classes
                ],
                key=lambda c: (c["group_id"], class_name_sort_key(str(c["name"])), c["id"]),
            )
        else:
            classes = fallback_classes()

        base_date = min((r.date for r in db_results), default=date(2026, 4, 13))

        table: dict[str, dict[str, int | str]] = {}
        edit_counts: dict[str, dict[str, int]] = {}
        for cls in classes:
            cls_key = str(cls["id"])
            table[cls_key] = {str(day): "" for day in range(1, 11)}
            edit_counts[cls_key] = {str(day): 0 for day in range(1, 11)}

        for row in db_results:
            day_num = working_day_for_calendar_date(row.date, base_date)
            if day_num and 1 <= day_num <= 10:
                class_key = str(row.class_id)
                if class_key in table:
                    table[class_key][str(day_num)] = row.walked_count

        for row in db_audits:
            day_num = working_day_for_calendar_date(row.date, base_date)
            if day_num and 1 <= day_num <= 10:
                class_key = str(row.class_id)
                if class_key in edit_counts:
                    edit_counts[class_key][str(day_num)] = row.edit_count

        walked_totals = {
            class_id: walked_total
            for class_id, walked_total in (
                db.query(SurveyResult.class_id, func.sum(SurveyResult.walked_count))
                .group_by(SurveyResult.class_id)
                .all()
            )
        }

        days_elapsed = db.query(func.count(func.distinct(SurveyResult.date))).scalar() or 0

        standings: list[dict[str, object]] = []
        for cls in classes:
            total_students = int(cls["total_students"])
            walked_total = int(walked_totals.get(cls["id"], 0))
            denominator = total_students * days_elapsed
            percent_walked = (walked_total / denominator * 100) if denominator else 0.0
            standings.append(
                {
                    "group_id": int(cls["group_id"]),
                    "group_name": cls["group_name"],
                    "class_id": int(cls["id"]),
                    "class_name": cls["name"],
                    "walked_total": walked_total,
                    "total_students": total_students,
                    "percent_walked": percent_walked,
                }
            )

        standings.sort(
            key=lambda row: (
                int(row["group_id"]),
                -float(row["percent_walked"]),
                class_name_sort_key(str(row["class_name"])),
                int(row["class_id"]),
            )
        )

        logos: dict[str, str] = {}
        for school_class in db_classes:
            if school_class.logo_data:
                mime_type = detect_image_mime_type(school_class.logo_data)
                b64_data = base64.b64encode(school_class.logo_data).decode("utf-8")
                logos[school_class.name] = f"data:{mime_type};base64,{b64_data}"

        snapshot = {
            "metadata": {
                "exported_at_utc": datetime.now(UTC).isoformat(),
                "source": "database",
                "frozen": True,
                "note": "Replace this file by rerunning export_frozen_results.py before shutting down backend/postgres.",
            },
            "app_config": {
                "app_mode": "archived",
                "simulation_enabled": False,
                "frozen": True,
            },
            "classes": classes,
            "standings": standings,
            "results_table": {
                "table": table,
                "edit_counts": edit_counts,
                "base_date": str(base_date),
            },
            "logos": logos,
        }

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        print(f"OK: wrote frozen snapshot to {output_path}")
        print(f"classes={len(classes)} standings={len(standings)} logos={len(logos)}")
        return 0
    except Exception as exc:
        print(f"FAIL: could not export frozen snapshot: {exc}")
        return 1
    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export frozen results snapshot used by static frontend mode."
    )
    parser.add_argument(
        "--output",
        default=str(
            Path(__file__).resolve().parents[2] / "frontend" / "public" / "frozen-results.json"
        ),
        help="Output JSON path. Default: frontend/public/frozen-results.json",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    raise SystemExit(export_snapshot(Path(args.output).resolve()))
