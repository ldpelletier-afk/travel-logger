#!/usr/bin/env bash
# Stops whatever is listening on the backend/frontend ports, regardless of
# how it was started (PID files are best-effort; the port check is what
# actually matters). Safe to run when nothing is running.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/data/run"

notify() {
  osascript -e "display notification \"$1\" with title \"Travel Logger\"" >/dev/null 2>&1 || true
}

stopped_anything=0

for port in 8000 5173; do
  pids="$(lsof -ti ":$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
    stopped_anything=1
  fi
done

rm -f "$RUN_DIR/backend.pid" "$RUN_DIR/frontend.pid"

if [ "$stopped_anything" = "1" ]; then
  notify "Stopped"
else
  notify "Wasn't running"
fi
