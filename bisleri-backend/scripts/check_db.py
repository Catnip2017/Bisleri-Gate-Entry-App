"""Standalone database connectivity check.

Verifies the app can reach the Postgres database named in the backend .env
(DB_* settings). This replaces the old public GET /ping/db endpoint — a
DB-touching health check does not belong on the public API surface (see
security finding F17). Run it manually during setup / ops:

    cd bisleri-backend
    python scripts/check_db.py

Exit code 0 = healthy, 1 = failed (so it can be used in shell/CI checks).
"""
import sys
import pathlib

# allow running as `python scripts/check_db.py` from bisleri-backend/
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from sqlalchemy import text          # noqa: E402
from app.database import engine       # noqa: E402
from app.config import settings       # noqa: E402


def main() -> int:
    target = f"{settings.DB_NAME} @ {settings.DB_HOST}:{settings.DB_PORT}"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))   # text() required on SQLAlchemy 2.x
        print(f"OK  — database reachable: {target}")
        return 0
    except Exception as exc:
        print(f"FAIL — cannot reach {target}\n     {type(exc).__name__}: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
