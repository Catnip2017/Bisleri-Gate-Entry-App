# app/ecosystem_sync/connections.py
#
# SOURCE_DB = Bisleri_01 — the live, currently-in-production database, still
# serving the legacy app. This job only ever SELECTs from it.
#
# TARGET_DB = bisleri_ecosystem — this app's own primary database
# (same as app.database's engine). The only DB this job ever writes to.
#
# There is no dedicated read-only DB role available for SOURCE_DB, so
# get_source_connection() enforces read-only at the Postgres protocol level
# instead: psycopg2's set_session(readonly=True) puts the whole session in
# a state where PostgreSQL itself rejects any INSERT/UPDATE/DELETE/DDL, no
# matter what the code does — not just a convention this file follows.
import psycopg2
from app.config import settings

SOURCE_DB = {
    "host": settings.ECOSYSTEM_SOURCE_DB_HOST,
    "port": settings.ECOSYSTEM_SOURCE_DB_PORT,
    "database": settings.ECOSYSTEM_SOURCE_DB_NAME,
    "user": settings.ECOSYSTEM_SOURCE_DB_USER,
    "password": settings.ECOSYSTEM_SOURCE_DB_PASSWORD,
}

TARGET_DB = {
    "host": settings.DB_HOST,
    "port": settings.DB_PORT,
    "database": settings.DB_NAME,
    "user": settings.DB_USER,
    "password": settings.DB_PASSWORD,
}


def get_source_connection():
    conn = psycopg2.connect(**SOURCE_DB)
    conn.set_session(readonly=True, autocommit=True)
    return conn


def get_target_connection():
    return psycopg2.connect(**TARGET_DB)
