# Travel Logger

Local-first, single-user app for logging visited places across the US —
catalog + county-choropleth map, inspired by mob-rule.com's county tracker.

No accounts, no cloud services, no API keys. Everything — the database,
your photos, and the US county/state boundaries — lives on your own disk.
The only network calls are ones you trigger yourself: looking up an
address, looking up state parks, or turning on the optional OpenStreetMap
basemap layer on the map.

## Features

- **Catalog** — card/list views, filter by category/state/date, full-text search
- **Map** — US choropleth of visited counties, state drill-down, clustered
  entry markers, click-through detail panel
- **Entries** — photos with drag-and-drop upload and automatic thumbnails,
  EXIF-based location/date autofill, address lookup (OpenStreetMap), pickers
  for all 63 US national parks and (on demand) state parks per state
- **Categories** — extensible in-app: name, color, icon
- **Stats** — counts by category, counties by state, first/last visit
- **Export/import** — full dataset as JSON for backup or migration

## Prerequisites

- Python 3.11+
- Node 20+
- macOS, Linux, or WSL (the `open`/notification bits in `scripts/*.sh` are
  macOS-specific conveniences — the app itself runs anywhere Python + Node do)

## Setup

```sh
git clone https://github.com/ldpelletier-afk/travel-logger.git
cd travel-logger

python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt

cd frontend && npm install && cd ..
```

## Run

```sh
./run.sh
```

Starts both servers in the foreground; Ctrl-C stops everything. Backend:
http://localhost:8000 (API docs at `/docs`). Frontend: http://localhost:5173.

On macOS you can instead run in the background and get a notification when
it's ready:

```sh
scripts/start.sh      # starts both servers, opens your browser
scripts/stop.sh       # stops them
```

If you'd like a double-clickable Desktop shortcut for those, see
[docs/desktop-launcher.md](docs/desktop-launcher.md).

## Seed sample data

```sh
cd backend && .venv/bin/python scripts/seed.py
```

Idempotent; seeds 8 categories and 12 example entries so you have something
to look at before adding your own.

## Notes

- County FIPS codes are derived server-side by point-in-polygon lookup
  against the bundled GeoJSON — never entered by hand.
- The county denominator is 3,144 (2023 vintage: Connecticut's 9 planning
  regions replaced its 8 counties), computed from the bundled file.
- Stack: Python / FastAPI / SQLAlchemy / SQLite backend; React / Vite /
  MapLibre GL frontend.
- `data/` (your database, photos, logs) is gitignored — it's created on
  first run and never leaves your machine.

## License

MIT — see [LICENSE](LICENSE).
