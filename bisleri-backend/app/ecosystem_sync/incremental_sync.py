# app/ecosystem_sync/incremental_sync.py
#
# Read-only pull from Bisleri_01 (the live production DB) into
# bisleri_ecosystem (this app's own DB), on a rolling schedule — see
# app/main.py for the APScheduler job (every 12 hours, fires on startup too).
#
# Window sizes:
#   document_data      — trailing 7 days by document_date. No reliable
#                         "inserted at" column exists on this table, so we
#                         re-scan a safety margin and upsert (harmless to
#                         re-touch rows already synced).
#   insights_data       — trailing 48 hours by date. Matches the app's own
#   raw_materials_data    edit-window business rule (edits are only ever
#                         possible within 48h of creation), so this window
#                         provably catches both new rows AND edits to rows
#                         from a previous run — no separate watermark needed.
#
# Every table is upserted (INSERT ... ON CONFLICT DO UPDATE), so reprocessing
# rows already synced is always safe. Nothing is ever deleted here — Bisleri_01
# doesn't hard-delete from these tables, so there's nothing to propagate.
import logging

from app.ecosystem_sync.connections import get_source_connection, get_target_connection
from app.ecosystem_sync.upsert import upsert_rows

logger = logging.getLogger(__name__)

DOCUMENT_DATA_WINDOW_DAYS = 7
EDIT_WINDOW_HOURS = 48

DOCUMENT_DATA_COLUMNS = [
    "document_no", "site", "document_type", "document_date", "e_way_bill_no",
    "transporter_name", "vehicle_no", "irn_no", "warehouse_code", "warehouse_name",
    "route_code", "route_no", "customer_code", "customer_name", "direct_dispatch",
    "total_quantity", "gate_entry_no", "from_warehouse_code", "to_warehouse_code",
    "sub_document_type", "salesman",
]

# interlayer_sheet_count doesn't exist on Bisleri_01 yet — that feature was
# committed but never pulled/deployed to the live production server. Backfilled
# as 0 on the target side, matching the target column's own NOT NULL DEFAULT 0.
INSIGHTS_DATA_SOURCE_COLUMNS = [
    "id", "gate_entry_no", "document_type", "sub_document_type", "document_no",
    "vehicle_no", "warehouse_name", "date", "time", "movement_type", "remarks",
    "warehouse_code", "site_code", "security_name", "security_username",
    "document_date", "driver_name", "km_reading", "loader_count", "loader_names",
    "last_edited_at", "edit_count",
]
INSIGHTS_DATA_TARGET_COLUMNS = INSIGHTS_DATA_SOURCE_COLUMNS + ["interlayer_sheet_count"]

RAW_MATERIALS_DATA_COLUMNS = [
    "id", "gate_entry_no", "gate_type", "vehicle_no", "document_no",
    "name_of_party", "description_of_material", "quantity", "date_time",
    "security_name", "security_username", "warehouse_code", "site_code",
    "last_edited_at", "edit_count",
]


def _fetch_window(source_conn, table, columns, date_column, window_clause):
    query = f"""
        SELECT {", ".join(columns)}
        FROM {table}
        WHERE {date_column} >= {window_clause}
    """
    with source_conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()


def sync_document_data(source_conn, target_conn):
    rows = _fetch_window(
        source_conn, "document_data", DOCUMENT_DATA_COLUMNS,
        "document_date", f"now() - interval '{DOCUMENT_DATA_WINDOW_DAYS} days'",
    )
    inserted, updated = upsert_rows(target_conn, "document_data", DOCUMENT_DATA_COLUMNS, "document_no", rows)
    return inserted, updated


def sync_insights_data(source_conn, target_conn):
    rows = _fetch_window(
        source_conn, "insights_data", INSIGHTS_DATA_SOURCE_COLUMNS,
        "date", f"now() - interval '{EDIT_WINDOW_HOURS} hours'",
    )
    rows = [row + (0,) for row in rows]  # backfill interlayer_sheet_count
    inserted, updated = upsert_rows(target_conn, "insights_data", INSIGHTS_DATA_TARGET_COLUMNS, "id", rows)
    return inserted, updated


def sync_raw_materials_data(source_conn, target_conn):
    rows = _fetch_window(
        source_conn, "raw_materials_data", RAW_MATERIALS_DATA_COLUMNS,
        "date_time", f"now() - interval '{EDIT_WINDOW_HOURS} hours'",
    )
    inserted, updated = upsert_rows(target_conn, "raw_materials_data", RAW_MATERIALS_DATA_COLUMNS, "id", rows)
    return inserted, updated


def run_ecosystem_incremental_sync():
    source_conn = None
    target_conn = None
    try:
        source_conn = get_source_connection()
        target_conn = get_target_connection()

        results = {}
        for name, sync_fn in (
            ("document_data", sync_document_data),
            ("insights_data", sync_insights_data),
            ("raw_materials_data", sync_raw_materials_data),
        ):
            inserted, updated = sync_fn(source_conn, target_conn)
            results[name] = (inserted, updated)

        target_conn.commit()
        summary = ", ".join(f"{t}: +{i}/~{u}" for t, (i, u) in results.items())
        logger.info("[EcosystemSync] %s", summary)
    except Exception:
        if target_conn:
            target_conn.rollback()
        logger.exception("[EcosystemSync] incremental sync failed")
    finally:
        if source_conn:
            source_conn.close()
        if target_conn:
            target_conn.close()
