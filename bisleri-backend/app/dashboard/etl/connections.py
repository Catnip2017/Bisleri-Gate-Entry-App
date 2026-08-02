# app/dashboard/etl/connections.py
#
# Raw psycopg2 connection dicts for the two databases the dashboard ETL
# touches, built from the app's single settings mechanism (matches the
# pattern already established in app/routers/rpa.py for RPA_DB_*).
#
# SOURCE_DB — READ-ONLY access only, ever (see data_sync.py's
# set_session(readonly=True)). Which database this actually points at is
# controlled by DASHBOARD_SOURCE_IS_BISLERI01 (app/config.py):
#   True  (current default) -> the real, live Bisleri_01 mfabric pipeline
#           directly (ECOSYSTEM_SOURCE_DB_*), since that pipeline is a
#           rolling ~7-day window with no equivalent feed into
#           bisleri_ecosystem yet.
#   False -> this app's own primary DB (DB_*), i.e. bisleri_ecosystem, once
#           that has a real mfabric feed or is trusted as the production
#           source of truth.
#
# HISTORICAL_DB = Bisleri_dashboard — the only DB this ETL ever writes to.
from app.config import settings

if settings.DASHBOARD_SOURCE_IS_BISLERI01:
    SOURCE_DB = {
        "host": settings.ECOSYSTEM_SOURCE_DB_HOST,
        "port": settings.ECOSYSTEM_SOURCE_DB_PORT,
        "database": settings.ECOSYSTEM_SOURCE_DB_NAME,
        "user": settings.ECOSYSTEM_SOURCE_DB_USER,
        "password": settings.ECOSYSTEM_SOURCE_DB_PASSWORD,
    }
else:
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
