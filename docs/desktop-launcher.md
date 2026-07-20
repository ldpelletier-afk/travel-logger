# Desktop launcher (macOS)

`scripts/start.sh` and `scripts/stop.sh` do the real work — starting both
servers in the background, opening your browser, and shutting everything
down (including all child processes) again. `scripts/build-app.sh` wraps
both into a single double-clickable **Travel Logger.app**:

- **Open it** → starts the backend + frontend and opens your browser.
- **Quit it** (Cmd-Q, or right-click the Dock icon → Quit) → stops both
  servers and everything they spawned. No leftover background processes.

## Build it

```sh
scripts/build-app.sh              # installs to ~/Desktop by default
scripts/build-app.sh ~/Applications  # or pick another folder
```

Re-run it any time after pulling changes to `scripts/start.sh` /
`scripts/stop.sh` — it just overwrites the app; the app itself has no logic
of its own, it only calls those two scripts.

The generated `.app` hardcodes an absolute path to wherever you cloned the
repo, so it's built locally rather than committed or shared — running
`build-app.sh` is the "install" step for the launcher.

## Notes

- All the logic lives in `scripts/start.sh` / `scripts/stop.sh`; the app is
  a thin AppleScript wrapper (see `scripts/build-app.sh`).
- `start.sh` launches each server in its own detached session, which is what
  lets it (a) survive the wrapper app's own shell exiting and (b) be killed
  as a complete process group by `stop.sh` — so Quit reliably takes down
  everything, not just the top-level process.
- If double-clicking does nothing, open it once from Finder with
  **right-click → Open** (bypasses the unidentified-developer prompt for a
  locally-built app), then check `data/logs/backend.log` /
  `data/logs/frontend.log` for errors.
- Prefer a terminal? `scripts/start.sh` and `scripts/stop.sh` work standalone
  too — see the main [README](../README.md).
