# Backend (FastAPI)

This backend provides API endpoints for:
- Upserting daily survey results per class/day
- Fetching standings and table data for the frontend
- Exposing app mode configuration for preview/campaign behavior

## Setup
1. Ensure Python 3.8+ is installed.
2. (Recommended) Use a virtual environment.
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the server:
   ```bash
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Local Development (Postgres-First)
Use this to keep local behavior as close to deployment as possible.

Quick one-command bootstrap from repository root:

```bash
./scripts/bootstrap_local_postgres.sh
```

This command:
- Starts local Postgres via Docker Compose.
- Waits until Postgres is ready.
- Creates `backend/.env` from `backend/.env.example` if missing.
- Installs backend Python dependencies.
- Migrates SQLite data into Postgres only when Postgres is empty and SQLite has classes.

1. Start local Postgres from repository root:

```bash
docker compose up -d postgres
```

On macOS, this requires a running Docker-compatible daemon (for example Docker Desktop, Colima, or OrbStack).

2. Create local backend env file:

```bash
cd backend
cp .env.example .env
```

3. Export variables from `.env` when running backend:

```bash
set -a
source .env
set +a
```

4. One-time data migration from SQLite (optional):

```bash
python scripts/migrate_sqlite_to_postgres.py
```

5. Start backend:

```bash
uvicorn main:app --reload
```

Notes:
- Local Postgres defaults to `sslmode=disable` automatically.
- Remote Postgres defaults to `sslmode=require` automatically.
- You can always override with `PGSSLMODE`.

## Environment Variables
- `DATABASE_URL`:
  - Optional.
  - If set, backend uses this database URL.
  - If not set, backend uses local SQLite database at `backend/survey.db`.
  - `postgres://...` is normalized to `postgresql://...` automatically.
- `APP_MODE`:
  - Optional.
  - Allowed values: `preview`, `campaign`.
  - Default: `preview`.
  - Exposed via `GET /app-config`.
- `PGSSLMODE`:
  - Optional.
  - Used for Postgres connections when `sslmode` is missing in `DATABASE_URL`.
  - Default behavior: `disable` for localhost, `require` for non-local hosts.

Production example file:
- `backend/.env.production.example`

## Postgres Deployment Cutover
Use this when moving from local SQLite to hosted Postgres.

1. Set `DATABASE_URL` to your Postgres connection string.
2. Keep `APP_MODE=preview` during migration and rehearsal.
3. Run migration script:

```bash
cd backend
python scripts/migrate_sqlite_to_postgres.py
```

Optional source override:

```bash
SQLITE_SOURCE_URL=sqlite:////absolute/path/to/survey.db python scripts/migrate_sqlite_to_postgres.py
```

Migration behavior:
- Creates tables in Postgres if missing.
- Clears destination tables before import.
- Copies `class_groups`, `school_classes`, `survey_results`, and `cell_edit_audit`.
- Preserves primary keys.

## Preview vs Campaign
- `preview` mode:
  - Frontend simulation controls are available.
  - Intended for rehearsals, demos, and QA.
- `campaign` mode:
  - Frontend simulation controls are hidden.
  - Frontend uses live day progression only.
  - Intended for real event operation.

## Deployment Scripts
Scripts live in `backend/scripts`.

### 1) Seed preview data
Use before rehearsal/demo environments.

```bash
cd backend
python scripts/seed_preview_data.py
```

This script:
- Clears `survey_results` and `cell_edit_audit`.
- Inserts deterministic 10-day data for all classes.
- Includes storyline adjustments to create changing leaders.

### 2) Reset campaign data
Use before launch-day cutover to clear rehearsal data.

```bash
cd backend
python scripts/reset_campaign_data.py
```

Exit behavior:
- Exit code `0`: Reset completed and both tables are empty.
- Exit code `1`: Reset was incomplete.

### 3) Verify campaign DB is clean
Use right before going live.

```bash
cd backend
python scripts/verify_campaign_clean.py
```

Exit behavior:
- Exit code `0`: DB is clean (`survey_results` and `cell_edit_audit` are empty).
- Exit code `1`: DB is not clean.

### 4) Deployment preflight check
Use immediately before deployment or mode switch.

```bash
cd backend
python scripts/preflight_deploy_check.py
```

What it validates:
- `APP_MODE` is either `preview` or `campaign`
- `DATABASE_URL` is set and is not SQLite
- Database can be queried
- If `APP_MODE=campaign`, both `survey_results` and `cell_edit_audit` are empty

### 5) One-command campaign cutover checks
Run this in backend after setting environment variables:

```bash
cd backend
./scripts/run_campaign_cutover.sh
```

This script runs, in order:
- `reset_campaign_data.py`
- `verify_campaign_clean.py`
- `preflight_deploy_check.py`

### 6) Endpoint smoke test
Run this after deployment to confirm core API endpoints are reachable:

```bash
cd backend
./scripts/smoke_test_endpoints.sh
```

Optional custom backend URL:

```bash
BASE_URL=https://api.your-domain.example ./scripts/smoke_test_endpoints.sh
```

## Suggested Operational Flow
1. `APP_MODE=preview`
2. Configure `DATABASE_URL` (Postgres)
3. (Optional) migrate existing SQLite data with `python scripts/migrate_sqlite_to_postgres.py`
4. Seed with `python scripts/seed_preview_data.py`
5. Rehearse on production-like environment
6. Clear data with `python scripts/reset_campaign_data.py`
7. Verify clean state with `python scripts/verify_campaign_clean.py`
8. Switch to `APP_MODE=campaign`
9. Run `python scripts/preflight_deploy_check.py`
10. Start live campaign

Additional release guide:
- See `RELEASE_NOTES.md` in repository root for launch-day command order and expected outputs.

Makefile shortcuts (run from repository root):
- `make bootstrap`
- `make preflight`
- `make smoke`
- `make cutover`
- `make frontend-build`
- `make release`

## Key Endpoints
- `POST /survey` — Create a survey row
- `PUT /survey` — Upsert a survey row and increment edit-audit count
- `GET /standings` — Group standings with cumulative percentage
- `GET /results-table` — Table-formatted class/day results and edit counts
- `GET /app-config` — Current app mode + simulation capability
- `GET /admin/deployment-status` — Mode + campaign clean status + row counts
- `POST /admin/mark-clean` — Localhost-only clean-state reset helper
