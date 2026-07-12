# app/routers/ping.py
#
# REMOVED (security finding F17). The old public GET /ping/db endpoint was an
# unauthenticated, DB-touching health check that nothing in the app called
# (and it was broken on SQLAlchemy 2.x — raw "SELECT 1" needs text()).
#
# For a real database connectivity check, use the standalone diagnostic:
#     python scripts/check_db.py
#
# This file is intentionally empty and no longer registered in main.py.
# Safe to delete.
