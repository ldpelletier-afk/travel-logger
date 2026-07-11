# Optional: a double-clickable Desktop launcher (macOS)

`scripts/start.sh` and `scripts/stop.sh` already do the real work — starting
both servers in the background, opening your browser, and shutting them
down again. This just wraps each one in a tiny `.app` so you can double-click
instead of opening a terminal.

## Create the launcher

1. Open **Script Editor** (in Applications/Utilities).
2. New document, paste in (adjust the path to wherever you cloned the repo):

   ```applescript
   do shell script "/path/to/travel-logger/scripts/start.sh > /dev/null 2>&1 &"
   ```

3. **File → Export…**, File Format: **Application**, save it as
   `Travel Logger` — anywhere you like (e.g. the Desktop).
4. Repeat with `scripts/stop.sh` for a `Stop Travel Logger` app.

Double-clicking either now runs the script in the background with no
terminal window. A macOS notification confirms it started/stopped.

## Notes

- These are just wrappers — all the logic lives in `scripts/start.sh` /
  `scripts/stop.sh`, so update those, not the `.app`, if you change how the
  app starts.
- If double-clicking does nothing, open the app once from Finder with
  **right-click → Open** (bypasses the unidentified-developer prompt for a
  locally-built app) and check `data/logs/backend.log` /
  `data/logs/frontend.log` for errors.
- Script Editor–exported apps run with your normal shell environment, so
  they'll find `node`/`npm` wherever your shell profile puts them.
