# Release Notes

## Deployment Readiness Update (2026-03-10)

### Summary
The project is now prepared for a Postgres-first deployment workflow with preview-to-campaign cutover controls.

### Completed
- Added Postgres-aware backend database configuration.
- Added SQLite-to-Postgres migration script.
- Added deterministic preview seeding script.
- Added campaign reset and clean verification scripts.
- Added deployment preflight check script.
- Added one-command local Postgres bootstrap script.
- Added one-command campaign cutover check script.
- Updated frontend API base behavior for safer production defaults.
- Added deployment documentation and checklist.

### Production Safety Controls
- `APP_MODE` gates preview/campaign behavior.
- `preflight_deploy_check.py` validates:
  - app mode
  - non-SQLite deployment DB
  - DB query health
  - clean DB requirement in campaign mode

### Launch-Day Command Sequence
Run in backend runtime environment:

```bash
python scripts/preflight_deploy_check.py
```

Expected output includes:
- `PRECHECK OK`

Campaign cutover sequence:

```bash
./scripts/run_campaign_cutover.sh
```

Expected output includes:
- `Resetting campaign tables...`
- `Verifying campaign DB is clean...`
- `Running preflight check...`
- `PRECHECK OK`

### Frontend Deployment Note
- Frontend defaults to `/api` unless `VITE_API_BASE_URL` is explicitly set.
- If backend is hosted on a different origin, set:
  - `VITE_API_BASE_URL=https://api.your-domain.example`

### Post-Deploy Verification
- Load public results page.
- Verify teacher portal routes.
- Confirm `/app-config`, `/classes`, `/results-table`, `/standings` return successful responses.
- In campaign mode, confirm simulation controls are hidden.
