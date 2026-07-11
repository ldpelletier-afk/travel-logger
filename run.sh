#!/usr/bin/env bash
# One-command local run: backend on :8000, frontend dev server on :5173.
# Ctrl-C stops everything. Bootstraps dependencies on first run.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -r backend/requirements.txt
fi

if [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install)
fi

trap 'kill 0' EXIT

(cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000) &
(cd frontend && npm run dev) &

wait
