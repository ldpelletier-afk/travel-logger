#!/usr/bin/env bash
# Stops the app and EVERY background process it spawned. start.sh launches each
# server in its own session (its own process group), so killing that whole
# group takes the server AND its children (npm -> vite, uvicorn workers, any
# esbuild helpers) down together. A pattern sweep mops up anything detached.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/data/run"

notify() {
  osascript -e "display notification \"$1\" with title \"Travel Logger\"" >/dev/null 2>&1 || true
}

stopped_anything=0

# Kill the process group each port listener belongs to (negative PID = group).
for port in 8000 5173; do
  for pid in $(lsof -ti ":$port" 2>/dev/null || true); do
    pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')"
    if [ -n "$pgid" ]; then
      kill -TERM "-$pgid" 2>/dev/null || true
    fi
    kill -TERM "$pid" 2>/dev/null || true
    stopped_anything=1
  done
done

# Safety net: any lingering dev processes belonging to this project.
for pat in "uvicorn app.main:app" "$ROOT/frontend" "$ROOT/backend"; do
  for pid in $(pgrep -f "$pat" 2>/dev/null || true); do
    kill -TERM "$pid" 2>/dev/null && stopped_anything=1 || true
  done
done

rm -f "$RUN_DIR/backend.pid" "$RUN_DIR/frontend.pid"

if [ "$stopped_anything" = "1" ]; then
  notify "Stopped"
else
  notify "Wasn't running"
fi
