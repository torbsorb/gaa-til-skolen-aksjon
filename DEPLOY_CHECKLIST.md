# Deploy Checklist

This checklist is written for a preview-to-campaign rollout using Postgres.

## 1) Backend Environment
Set required backend environment variables in your hosting platform.

Quick command aliases from repository root:
- `make bootstrap`
- `make preflight`
- `make smoke`
- `make cutover`
- `make frontend-build`
- `make release`

Required:
- APP_MODE=preview
- DATABASE_URL=postgresql://...

Optional:
- PGSSLMODE=require

## 2) Frontend Environment
Set frontend environment variables in your hosting platform.

Recommended if backend is exposed on same host behind /api:
- Leave VITE_API_BASE_URL unset

Required if backend is on a different host:
- VITE_API_BASE_URL=https://api.your-domain.example

## 3) Deploy Backend (Preview)
Deploy backend with APP_MODE=preview and Postgres DATABASE_URL.

Run these checks in the backend runtime:

```bash
python scripts/preflight_deploy_check.py
```

Equivalent:

```bash
make preflight
```

Expected:
- PRECHECK OK

If you are migrating historical local SQLite data to Postgres:

```bash
python scripts/migrate_sqlite_to_postgres.py
```

## 4) Seed Preview Data (Optional)
Use if you want deterministic rehearsal data:

```bash
python scripts/seed_preview_data.py
```

## 5) Deploy Frontend
Build and deploy frontend.

Build command shortcut:

```bash
make frontend-build
```

If same-origin backend proxy is configured, API calls use /api by default.

## 6) Smoke Test (Preview)
Verify these endpoints from your deployed environment:
- GET /app-config
- GET /classes
- GET /results-table
- GET /standings

Verify UI behavior:
- Results page loads data
- Editable table saves values
- Preview mode shows simulation controls

## 7) Campaign Cutover
Before going live:

```bash
python scripts/reset_campaign_data.py
python scripts/verify_campaign_clean.py
```

Set:
- APP_MODE=campaign

Then run:

```bash
python scripts/preflight_deploy_check.py
```

Equivalent one-command sequence:

```bash
make cutover
```

Expected:
- PRECHECK OK
- survey_results_rows=0
- cell_edit_audit_rows=0

## 8) Smoke Test (Campaign)
Verify:
- Simulation controls are hidden
- Results and table pages load from live data flow
- Admin/teacher paths are accessible only through intended routes

## 9) Rollback Notes
If deployment fails:
- Roll back to previous backend release
- Keep database unchanged unless migration intentionally ran
- Re-run preflight after rollback to confirm state
