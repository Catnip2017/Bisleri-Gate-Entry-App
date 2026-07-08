# app/dashboard/etl/connections.py
#
# Raw psycopg2 connection dicts for the two databases the dashboard ETL
# touches, built from the app's single settings mechanism (matches the
# pattern already established in app/routers/rpa.py for RPA_DB_*).
#
# SOURCE_DB  = the operational Bisleri_01 DB (same one app/database.py's
#              SQLAlchemy engine points at) — READ-ONLY access only, ever.
# HISTORICAL_DB = Bisleri_dashboard — the only DB this ETL ever writes to.
from app.config import settings

SOURCE_DB = {
    "host": settings.DB_HOST,
    "port": settings.DB_PORT,
    "database": settings.DB_NAME,
    "user": settings.DB_USER,
    "password": settings.DB_PASSWORD,
}

HISTORICAL_DB = {
    "host": settings.HISTORICAL_DB_HOST,
    "port": settings.HISTORICAL_DB_PORT,
    "database": settings.HISTORICAL_DB_NAME,
    "user": settings.HISTORICAL_DB_USER,
    "password": settings.HISTORICAL_DB_PASSWORD,
}
