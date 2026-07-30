# app/ecosystem_sync/historical_backfill.py
#
# Standalone script — run manually ONCE to copy the full existing history of
# document_data, insights_data, and raw_materials_data from Bisleri_01 into
# bisleri_ecosystem (~10 months, ~4 lakh rows total, at time of writing).
# Not wired into the scheduler — see incremental_sync.py for the recurring
# 7-day/48h-window job that takes over keeping things fresh after this runs.
#
# Each table is fetched and upserted (INSERT ... ON CONFLICT DO UPDATE) in
# its own transaction — if a later table fails, tables already committed
# stay intact, nothing is lost. Safe to re-run if a retry is ever needed.
#
# Run with:  python -m app.ecosystem_sync.historical_backfill
import logging

from app.ecosystem_sync.connections import get_source_connection, get_target_connection
from app.ecosystem_sync.incremental_sync import (
    DOCUMENT_DATA_COLUMNS,
    INSIGHTS_DATA_SOURCE_COLUMNS,
    INSIGHTS_DATA_TARGET_COLUMNS,
    RAW_MATERIALS_DATA_COLUMNS,
)
from app.ecosystem_sync.upsert import upsert_rows

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _backfill_table(source_conn, target_conn, table, columns, conflict_col):
    with source_conn.cursor() as cur:
        cur.execute(f"SELECT {', '.join(columns)} FROM {table}")
        rows = cur.fetchall()
    inserted, updated = upsert_rows(target_conn, table, columns, conflict_col, rows)
    target_conn.commit()
    logger.info(
        "%s: +%d inserted, ~%d updated (%d rows fetched from source)",
        table, inserted, updated, len(rows),
    )


def _backfill_insights_data(source_conn, target_conn):
    """insights_data needs its own step: Bisleri_01 doesn't have
    interlayer_sheet_count yet (that feature was never deployed there), so
    it's backfilled as 0 on the way into bisleri_ecosystem."""
    with source_conn.cursor() as cur:
        cur.execute(f"SELECT {', '.join(INSIGHTS_DATA_SOURCE_COLUMNS)} FROM insights_data")
        rows = cur.fetchall()
    rows = [row + (0,) for row in rows]
    inserted, updated = upsert_rows(target_conn, "insights_data", INSIGHTS_DATA_TARGET_COLUMNS, "id", rows)
    target_conn.commit()
    logger.info(
        "insights_data: +%d inserted, ~%d updated (%d rows fetched from source)",
        inserted, updated, len(rows),
    )


def main():
    source_conn = get_source_connection()
    target_conn = get_target_connection()
    try:
        _backfill_table(source_conn, target_conn, "document_data", DOCUMENT_DATA_COLUMNS, "document_no")
        _backfill_insights_data(source_conn, target_conn)
        _backfill_table(source_conn, target_conn, "raw_materials_data", RAW_MATERIALS_DATA_COLUMNS, "id")
        logger.info("Historical backfill complete.")
    except Exception:
        target_conn.rollback()
        logger.exception(
            "Historical backfill failed partway — any table(s) already logged "
            "above committed successfully and are safe; re-run to retry the rest."
        )
        raise
    finally:
        source_conn.close()
        target_conn.close()


if __name__ == "__main__":
    main()
