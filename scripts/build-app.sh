#!/usr/bin/env bash
# Builds a single double-clickable "Travel Logger.app" that:
#   • starts the backend + frontend and opens your browser when you open it
#   • shuts EVERYTHING down (all background processes) when you Quit it (Cmd-Q)
#
# The app is a thin AppleScript wrapper around scripts/start.sh / stop.sh.
# This builder is portable and safe to commit; the .app it generates hardcodes
# an absolute path to this machine, so build it locally rather than committing
# the .app itself.
#
# Usage:  scripts/build-app.sh [destination-dir]   (default: ~/Desktop)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-$HOME/Desktop}"
APP="$DEST/Travel Logger.app"

# A stay-open app: on launch it starts the servers; on quit it stops them.
# We deliberately do NOT background start.sh (no trailing `&`): AppleScript
# would kill a backgrounded job the instant `do shell script` returns, before
# it could launch anything. Instead we let it run to completion — start.sh
# launches the servers in their own detached sessions and returns in a couple
# of seconds, and those sessions outlive both it and this app's shell.
# `on quit` runs synchronously, so the servers are gone before the app exits.
read -r -d '' SRC <<APPLESCRIPT || true
property startScript : "$ROOT/scripts/start.sh"
property stopScript : "$ROOT/scripts/stop.sh"

on run
	do shell script quoted form of startScript & " > /dev/null 2>&1"
end run

on quit
	do shell script quoted form of stopScript & " > /dev/null 2>&1"
	continue quit
end quit
APPLESCRIPT

rm -rf "$APP"
# -s compiles a stay-open applet (the `on quit` handler runs before it exits);
# osacompile apps are dock-visible by default, so no plist surgery is needed.
osacompile -o "$APP" -s -e "$SRC"

echo "Built: $APP"
echo "Open it to start Travel Logger; Quit it (Cmd-Q) to stop everything."
