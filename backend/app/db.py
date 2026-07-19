from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
PHOTOS_DIR = DATA_DIR / "photos"
STATIC_DATA_DIR = Path(__file__).resolve().parent / "static_data"

DATA_DIR.mkdir(exist_ok=True)
PHOTOS_DIR.mkdir(exist_ok=True)

engine = create_engine(
    f"sqlite:///{DATA_DIR / 'app.db'}",
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _enable_fk(dbapi_conn, _):
    dbapi_conn.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    """Add columns to an existing SQLite file that predates them.

    `Base.metadata.create_all` only creates missing tables, not missing
    columns on tables that already exist — this project has no Alembic,
    so new columns get a one-line guarded ALTER TABLE here instead.
    """
    with engine.connect() as conn:
        cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(entries)")}
        if "address" not in cols:
            conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN address TEXT DEFAULT ''")
        if "country" not in cols:
            # Existing entries predate multi-country support and are all US.
            conn.exec_driver_sql("ALTER TABLE entries ADD COLUMN country VARCHAR(2) DEFAULT 'US'")
        mc_cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(manual_counties)")}
        if mc_cols and "country" not in mc_cols:
            conn.exec_driver_sql("ALTER TABLE manual_counties ADD COLUMN country VARCHAR(2) DEFAULT 'US'")
        conn.commit()
