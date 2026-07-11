#!/usr/bin/env bash
# Starts the backend + frontend in the background (if not already running)
# and opens the app in the default browser. Safe to run again while it's
# already up — it just reopens the browser tab.
set -uo pipefail

# When double-clicked from Finder, macOS gives the app a bare PATH that
# omits Homebrew — where node/npm live. Put the usual spots back so the
# frontend dev server can start.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/data/run"
LOG_DIR="$ROOT/data/logs"
mkdir -p "$RUN_DIR" "$LOG_DIR"

notify() {
  osascript -e "display notification \"$1\" with title \"Travel Logger\"" >/dev/null 2>&1 || true
}

port_listening() {
  lsof -ti ":$1" >/dev/null 2>&1
}

if ! port_listening 8000; then
  (cd "$ROOT/backend" && exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000) \
    >"$LOG_DIR/backend.log" 2>&1 &
  echo $! >"$RUN_DIR/backend.pid"
fi

if ! port_listening 5173; then
  (cd "$ROOT/frontend" && exec npm run dev -- --port 5173 --strictPort) \
    >"$LOG_DIR/frontend.log" 2>&1 &
  echo $! >"$RUN_DIR/frontend.pid"
fi

# Wait for the frontend to actually accept connections before opening it.
for _ in $(seq 1 30); do
  if port_listening 5173; then
    break
  fi
  sleep 0.5
done

open "http://localhost:5173"
notify "Running at localhost:5173"
