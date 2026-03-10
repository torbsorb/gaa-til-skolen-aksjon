#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"

endpoints=(
  "/app-config"
  "/classes"
  "/results-table"
  "/standings"
)

echo "Running smoke tests against: $BASE_URL"

for endpoint in "${endpoints[@]}"; do
  url="$BASE_URL$endpoint"
  status_code="$(curl -sS -o /tmp/smoke_body.txt -w "%{http_code}" "$url")"
  if [[ "$status_code" != "200" ]]; then
    echo "FAIL $endpoint (HTTP $status_code)"
    echo "Response preview:"
    head -c 300 /tmp/smoke_body.txt || true
    echo
    exit 1
  fi
  echo "OK   $endpoint"
done

echo "Smoke tests passed."
