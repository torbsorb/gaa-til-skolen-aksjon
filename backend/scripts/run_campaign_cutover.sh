#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "${APP_MODE:-}" != "campaign" ]]; then
  echo "INFO: APP_MODE is not campaign in current shell (APP_MODE=${APP_MODE:-unset})."
  echo "This script still proceeds with cleanup and checks."
fi

echo "Resetting campaign tables..."
python scripts/reset_campaign_data.py

echo "Verifying campaign DB is clean..."
python scripts/verify_campaign_clean.py

echo "Running preflight check..."
python scripts/preflight_deploy_check.py

echo "Cutover checks completed successfully."
