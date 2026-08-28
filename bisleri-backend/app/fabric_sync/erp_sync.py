# app/fabric_sync/erp_sync.py
#
# Daily full pull of Vendor and Fixed Asset masters from the ERP Lakehouse
# (a different Fabric Lakehouse/SQL endpoint than the Customer one — see
# app/fabric_sync/connections.py:get_fabric_erp_connection) into
# gate_pass_vendors and gate_pass_assets.
#
# Vendor has no single source table — VendTable only carries a party
# reference, so the name/address require joining out to DirPartyTable (for
# the vendor's name) and LogisticsPostalAddress (for city/post_code, via
# DirPartyTable's PrimaryAddressLocation). LEFT JOINs throughout: a vendor
# missing a party/address link still syncs (with a null name/city/post_code)
# rather than being silently dropped from the picker.
#
# Same pattern as customer_sync.py otherwise: no reliable "last modified"
# column exists on any of these source tables, so every run is a full pull
# + upsert (INSERT ... ON CONFLICT DO UPDATE), and anything missing from a
# pull is soft-deactivated (is_active = false), never hard-deleted.
import logging

from app.fabric_sync.connections import get_fabric_erp_connection, get_target_connection
from app.fabric_sync.common import deactivate_missing
from app.ecosystem_sync.upsert import upsert_rows
from app.config import settings

logger = logging.getLogger(__name__)
_JOB_NAME = "FabricErpSync"

VENDOR_COLUMNS = ["vendor_code", "vendor_name", "city", "post_code"]
ASSET_COLUMNS = ["asset_code", "asset_name"]


def _fetch_vendors(fabric_conn):
    query = f"""
        SELECT
            v.accountnum AS vendor_code,
            p.name       AS vendor_name,
            a.city       AS city,
            a.zipcode    AS post_code
        FROM {settings.FABRIC_VENDOR_TABLE} v
        LEFT JOIN {settings.FABRIC_PARTY_TABLE} p
            ON v.party = p.recid
        LEFT JOIN {settings.FABRIC_ADDRESS_TABLE} a
            ON p.primaryaddresslocation = a.location
    """
    with fabric_conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
    # contact and phone_no aren't sourced (kept null per spec); every row
    # present in this pull is active — rows that stop appearing here are
    # handled separately by deactivate_missing, not by this default.
    return [tuple(row) + (None, None, True) for row in rows]


def _fetch_assets(fabric_conn):
    query = f"SELECT assetid AS asset_code, name AS asset_name FROM {settings.FABRIC_ASSET_TABLE}"
    with fabric_conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
    # fa_class_code has no source match yet (per spec, to be revisited).
    return [tuple(row) + (None, True) for row in rows]


def run_erp_sync():
    fabric_conn = None
    target_conn = None
    try:
        fabric_conn = get_fabric_erp_connection()
        target_conn = get_target_connection()
    except Exception:
        logger.exception("[%s] ERP sync failed to connect", _JOB_NAME)
        if fabric_conn:
            fabric_conn.close()
        if target_conn:
            target_conn.close()
        return

    # Vendors and assets are independent source tables/targets - a failure
    # in one (e.g. a duplicate-key/CardinalityViolation on vendors) must not
    # block or mask the status of the other, so each gets its own
    # try/except and its own commit/rollback.
    try:
        vendor_rows = _fetch_vendors(fabric_conn)
        v_inserted, v_updated = upsert_rows(
            target_conn, "gate_pass_vendors",
            VENDOR_COLUMNS + ["contact", "phone_no", "is_active"],
            "vendor_code", vendor_rows,
        )
        v_deactivated = deactivate_missing(
            target_conn, "gate_pass_vendors", "vendor_code",
            [r[0] for r in vendor_rows], _JOB_NAME,
        )
        target_conn.commit()
        logger.info(
            "[%s] vendors: +%d/~%d/-%d",
            _JOB_NAME, v_inserted, v_updated, v_deactivated,
        )
    except Exception:
        target_conn.rollback()
        logger.exception("[%s] vendor sync failed", _JOB_NAME)

    try:
        asset_rows = _fetch_assets(fabric_conn)
        a_inserted, a_updated = upsert_rows(
            target_conn, "gate_pass_assets",
            ASSET_COLUMNS + ["fa_class_code", "is_active"],
            "asset_code", asset_rows,
        )
        a_deactivated = deactivate_missing(
            target_conn, "gate_pass_assets", "asset_code",
            [r[0] for r in asset_rows], _JOB_NAME,
        )
        target_conn.commit()
        logger.info(
            "[%s] assets: +%d/~%d/-%d",
            _JOB_NAME, a_inserted, a_updated, a_deactivated,
        )
    except Exception:
        target_conn.rollback()
        logger.exception("[%s] asset sync failed", _JOB_NAME)

    if fabric_conn:
        fabric_conn.close()
    if target_conn:
        target_conn.close()
