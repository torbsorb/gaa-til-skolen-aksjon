.PHONY: bootstrap preflight smoke smoke-remote cutover seed-preview reset-campaign verify-clean frontend-build release

BACKEND_DIR := backend
FRONTEND_DIR := frontend
ROOT_DIR := $(CURDIR)

ifeq ($(wildcard $(ROOT_DIR)/.venv/bin/python),$(ROOT_DIR)/.venv/bin/python)
PYTHON ?= $(ROOT_DIR)/.venv/bin/python
else
PYTHON ?= python3
endif

ENV_LOAD = set -a; [ -f .env ] && . ./.env || true; set +a;

bootstrap:
	./scripts/bootstrap_local_postgres.sh

preflight:
	cd $(BACKEND_DIR) && $(ENV_LOAD) $(PYTHON) scripts/preflight_deploy_check.py

smoke:
	cd $(BACKEND_DIR) && $(ENV_LOAD) ./scripts/smoke_test_endpoints.sh

# Usage: make smoke-remote BASE_URL=https://api.example.com
smoke-remote:
	cd $(BACKEND_DIR) && $(ENV_LOAD) BASE_URL="$(BASE_URL)" ./scripts/smoke_test_endpoints.sh

cutover:
	cd $(BACKEND_DIR) && $(ENV_LOAD) ./scripts/run_campaign_cutover.sh

seed-preview:
	cd $(BACKEND_DIR) && $(ENV_LOAD) $(PYTHON) scripts/seed_preview_data.py

reset-campaign:
	cd $(BACKEND_DIR) && $(ENV_LOAD) $(PYTHON) scripts/reset_campaign_data.py

verify-clean:
	cd $(BACKEND_DIR) && $(ENV_LOAD) $(PYTHON) scripts/verify_campaign_clean.py

frontend-build:
	cd $(FRONTEND_DIR) && npm run build

release: preflight smoke frontend-build
	@echo "Release checks completed successfully."
