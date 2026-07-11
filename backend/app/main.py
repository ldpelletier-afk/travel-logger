from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .db import Base, engine, run_migrations, PHOTOS_DIR, STATIC_DATA_DIR
from .routers import categories, counties, data, entries, photos, presets, stats

Base.metadata.create_all(engine)
run_migrations()

app = FastAPI(title="Travel Logger")

# Vite dev server origin; harmless in production where FastAPI serves the build.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories.router)
app.include_router(entries.router)
app.include_router(photos.router)
app.include_router(counties.router)
app.include_router(stats.router)
app.include_router(data.router)
app.include_router(presets.router)

# Photo renditions (thumb/midsize) and bundled boundary GeoJSON.
app.mount("/photos", StaticFiles(directory=PHOTOS_DIR), name="photos")
app.mount("/geo", StaticFiles(directory=STATIC_DATA_DIR), name="geo")


@app.get("/api/health")
def health():
    return {"ok": True}
