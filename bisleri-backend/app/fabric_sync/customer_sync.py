# app/fabric_sync/customer_sync.py
#
# Daily full pull of the Customer master (FABRIC_CUSTOMER_TABLE, default
# Customer_R2_qvd) from the Fabric Lakehouse into gate_pass_customers.
#
# No reliable "last modified" column exists on the source, so this always
# pulls the WHOLE table and upserts (INSERT ... ON CONFLICT DO UPDATE) —
# cheap for a customer-master-sized table, self-heals any drift, and needs
# no watermark/incremental tracking.
#
# Customers no longer present in the source pull are soft-deactivated
# (is_active = false) — never hard-deleted, so a gate pass created against
# a customer who is later retired in D365 can still resolve their details.
# An empty pull is treated as a source problem, not "zero customers", and
# skips the deactivation pass entirely rather than wiping the table.
#
# Vendor and Fixed Asset sync are intentionally NOT built yet (on hold —
# the join to LogisticsPostalAddress isn't confirmed for either master).
import logging

from app.fabric_sync.connections import get_fabric_connection, get_target_connection
from app.ecosystem_sync.upsert import upsert_rows
from app.config import settings

logger = logging.getLogger(__name__)

# Fabric column -> gate_pass_customers column, in select/insert order.
CUSTOMER_COLUMN_MAP = {
    "Customer_No": "customer_code",
    "Cust_Name": "customer_name",
    "City": "city",
    "Post_Code": "post_code",
    "Phone_No": "phone_no",
}
TARGET_COLUMNS = list(CUSTOMER_COLUMN_MAP.values()) + ["contact", "is_active"]


def _fetch_customers(fabric_conn):
    source_cols = ", ".join(CUSTOMER_COLUMN_MAP.keys())
    query = f"SELECT {source_cols} FROM {settings.FABRIC_CUSTOMER_TABLE}"
    with fabric_conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
    # contact isn't sourced from Fabric (kept null per spec); every row
    # present in this pull is active — rows that stop appearing here are
    # handled separately by _deactivate_missing, not by this default.
    return [tuple(row) + (None, True) for row in rows]


def _deactivate_missing(target_conn, seen_codes) -> int:
    if not seen_codes:
        logger.warning(
            "[FabricCustomerSync] source returned zero rows — skipping "
            "deactivation pass (treating as a source-side problem, not "
            "an empty customer master)"
        )
        return 0
    with target_conn.cursor() as cur:
        cur.execute(
            "UPDATE gate_pass_customers SET is_active = false "
            "WHERE is_active = true AND customer_code NOT IN %s",
            (tuple(seen_codes),),
        )
        return cur.rowcount


def run_customer_sync():
    fabric_conn = None
    target_conn = None
    try:
        fabric_conn = get_fabric_connection()
        target_conn = get_target_connection()

        rows = _fetch_customers(fabric_conn)
        inserted, updated = upsert_rows(
            target_conn, "gate_pass_customers", TARGET_COLUMNS, "customer_code", rows
        )
        deactivated = _deactivate_missing(target_conn, [r[0] for r in rows])

        target_conn.commit()
        logger.info(
            "[FabricCustomerSync] +%d inserted, ~%d updated, %d deactivated",
            inserted, updated, deactivated,
        )
    except Exception:
        if target_conn:
            target_conn.rollback()
        logger.exception("[FabricCustomerSync] customer sync failed")
    finally:
        if fabric_conn:
            fabric_conn.close()
        if target_conn:
            target_conn.close()
