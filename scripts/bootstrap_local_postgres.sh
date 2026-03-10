#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

if ! command -v docker >/dev/null 2>&1; then
  echo "FAIL: docker is not installed or not in PATH."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "FAIL: docker daemon is not running."
  echo "Start your Docker runtime (for example Docker Desktop, Colima, or OrbStack) and try again."
  exit 1
fi

echo "Starting local Postgres service..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres

echo "Waiting for Postgres readiness..."
for attempt in $(seq 1 30); do
  if docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres pg_isready -U gotilskole -d gotilskole >/dev/null 2>&1; then
    echo "Postgres is ready."
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo "FAIL: Postgres did not become ready in time."
    exit 1
  fi
  sleep 1
done

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  echo "Creating backend/.env from .env.example..."
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi

echo "Installing backend Python dependencies..."
python3 -m pip install -r "$BACKEND_DIR/requirements.txt"

set -a
source "$BACKEND_DIR/.env"
set +a

if [[ "${DATABASE_URL:-}" != postgresql://* ]] && [[ "${DATABASE_URL:-}" != postgres://* ]]; then
  echo "FAIL: DATABASE_URL in backend/.env must point to Postgres."
  exit 1
fi

echo "Checking whether migration is needed..."
read -r target_count source_count < <(
  cd "$BACKEND_DIR"
  python3 - <<'PY'
from pathlib import Path
import sqlite3
from database import SessionLocal
from models import SchoolClass

source_db = Path(__file__).resolve().parent / "survey.db"
source_count = 0
if source_db.exists():
    conn = sqlite3.connect(source_db)
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM school_classes")
        source_count = int(cur.fetchone()[0] or 0)
    except sqlite3.Error:
        source_count = 0
    finally:
        conn.close()

db = SessionLocal()
try:
    target_count = db.query(SchoolClass).count()
finally:
    db.close()

print(target_count, source_count)
PY
)

if [[ "$target_count" -eq 0 && "$source_count" -gt 0 ]]; then
  echo "Postgres is empty and local SQLite has data. Running migration..."
  (cd "$BACKEND_DIR" && python3 scripts/migrate_sqlite_to_postgres.py)
else
  echo "Skipping migration (Postgres classes: $target_count, SQLite classes: $source_count)."
fi

echo
echo "Bootstrap complete."
echo "Next steps:"
echo "1) cd backend && set -a && source .env && set +a && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
echo "2) cd frontend && npm install && npm run dev"
