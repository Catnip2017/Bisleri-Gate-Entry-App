"""
Create / prepare the application database for a NEW (usually local) install.

What it does, in order:
  1. Connects to the database named by DB_NAME in bisleri-backend/.env.
     If that database does not exist yet, it creates it.
  2. If the database has no tables, it loads "DB Schemas/schema_bisleri_ecosystem.sql"
     (the full current schema, already stamped at the latest Alembic revision).
     If tables already exist it leaves the structure alone - move an existing
     database forward with `alembic upgrade head` instead.
  3. Loads the reference data (departments, gate pass locations, cancel reasons).
  4. With --sample-data, also loads fictional demo data (see seed_sample_data.py).

Why not just `alembic upgrade head`?  The first migrations assume tables that
were originally created by hand, so Alembic cannot build an EMPTY database.

Run from the bisleri-backend folder:

    python scripts/init_db.py                  # structure + reference data
    python scripts/init_db.py --sample-data    # ... plus demo data for local testing
"""
import argparse
import os
import sys

import psycopg2
from psycopg2 import sql

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
REPO = os.path.dirname(BACKEND)
SCHEMA_FILE = os.path.join(REPO, "DB Schemas", "schema_bisleri_ecosystem.sql")
for p in (BACKEND, HERE):
    if p not in sys.path:
        sys.path.insert(0, p)

import seed_sample_data  # noqa: E402


def _connect(settings, dbname):
    return psycopg2.connect(host=settings.DB_HOST, port=settings.DB_PORT, user=settings.DB_USER,
                            password=settings.DB_PASSWORD, dbname=dbname)


def ensure_database(settings):
    try:
        return _connect(settings, settings.DB_NAME)
    except psycopg2.OperationalError as exc:
        if "does not exist" not in str(exc):
            raise
    print(f"Database '{settings.DB_NAME}' does not exist - creating it ...")
    admin = _connect(settings, "postgres")
    admin.autocommit = True
    with admin.cursor() as cur:
        cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(settings.DB_NAME)))
    admin.close()
    return _connect(settings, settings.DB_NAME)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sample-data", action="store_true", help="also load fictional demo data (local only)")
    ap.add_argument("--allow-existing-users", action="store_true",
                    help="load demo data even if non-demo users already exist")
    args = ap.parse_args()

    from app.config import settings
    if args.sample_data and settings.DB_HOST not in seed_sample_data.LOCAL_HOSTS:
        raise SystemExit(f"Refusing to load sample data: DB_HOST is '{settings.DB_HOST}', not a local database.")

    conn = ensure_database(settings)
    try:
        with conn, conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
            if cur.fetchone()[0] == 0:
                if not os.path.isfile(SCHEMA_FILE):
                    raise SystemExit(f"Schema file not found: {SCHEMA_FILE}")
                print("Empty database - loading schema_bisleri_ecosystem.sql ...")
                with open(SCHEMA_FILE, encoding="utf-8") as fh:
                    cur.execute(fh.read())
                print("Schema created (Alembic revision stamped at head).")
            else:
                print("Tables already exist - structure left untouched "
                      "(use `alembic upgrade head` to move an existing database forward).")
            seed_sample_data.seed_reference_data(cur)
            print("Reference data ready (departments, gate pass locations, cancel reasons).")
            if args.sample_data:
                if seed_sample_data.seed_sample_data(cur, settings.DB_HOST, args.allow_existing_users):
                    print("Sample data loaded.")
                    seed_sample_data.print_logins()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
