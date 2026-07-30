# app/ecosystem_sync/one_time_master_sync.py
#
# Standalone script — run manually once to copy users_master and
# location_master from Bisleri_01 into bisleri_ecosystem. NOT wired into the
# scheduler (see app/main.py / incremental_sync.py for the recurring job) —
# these two tables get an exact copy, no ongoing updates after that.
#
# Safe to re-run if something goes wrong partway (full upsert, not append),
# even though it's only meant to be invoked once in practice.
#
# Run with:  python -m app.ecosystem_sync.one_time_master_sync
import logging

from app.ecosystem_sync.connections import get_source_connection, get_target_connection
from app.ecosystem_sync.upsert import upsert_rows

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

LOCATION_MASTER_COLUMNS = ["warehouse_code", "warehouse_name", "site_code", "warehouse_id"]

# Source columns, in the exact order the SELECT below returns them.
USERS_MASTER_SOURCE_COLUMNS = [
    "username", "first_name", "last_name", "role", "warehouse_code",
    "warehouse_name", "site_code", "password", "email", "phone_number", "last_login",
]
# Target columns — source columns plus the 4 fields Bisleri_01 doesn't have.
# Backfill decision: NULL for the text fields, true for is_active (existing
# rows should read as active, matching how this DB's users are used today).
USERS_MASTER_TARGET_COLUMNS = USERS_MASTER_SOURCE_COLUMNS + [
    "copacker_location", "department", "gate_pass_location", "is_active",
]


def sync_location_master(source_conn, target_conn):
    with source_conn.cursor() as cur:
        cur.execute(f"SELECT {', '.join(LOCATION_MASTER_COLUMNS)} FROM location_master")
        rows = cur.fetchall()
    inserted, updated = upsert_rows(target_conn, "location_master", LOCATION_MASTER_COLUMNS, "warehouse_code", rows)
    logger.info("location_master: +%d inserted, ~%d updated", inserted, updated)


def sync_users_master(source_conn, target_conn):
    with source_conn.cursor() as cur:
        cur.execute(f"SELECT {', '.join(USERS_MASTER_SOURCE_COLUMNS)} FROM users_master")
        source_rows = cur.fetchall()

    backfilled_rows = [row + (None, None, None, True) for row in source_rows]

    inserted, updated = upsert_rows(target_conn, "users_master", USERS_MASTER_TARGET_COLUMNS, "username", backfilled_rows)
    logger.info("users_master: +%d inserted, ~%d updated", inserted, updated)


def main():
    source_conn = get_source_connection()
    target_conn = get_target_connection()
    try:
        # location_master first — users_master has a foreign key to it.
        sync_location_master(source_conn, target_conn)
        sync_users_master(source_conn, target_conn)
        target_conn.commit()
        logger.info("One-time master data sync complete.")
    except Exception:
        target_conn.rollback()
        logger.exception("One-time master data sync failed — rolled back, nothing partially applied.")
        raise
    finally:
        source_conn.close()
        target_conn.close()


if __name__ == "__main__":
    main()
