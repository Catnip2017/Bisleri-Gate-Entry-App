# app/fabric_sync/erp_sync.py
#
# Daily full pull of Vendor, Fixed Asset and Item masters from the ERP Lakehouse
# (a different Fabric Lakehouse/SQL endpoint than the Customer one — see
# app/fabric_sync/connections.py:get_fabric_erp_connection) into
# gate_pass_vendors and gate_pass_assets.
#
# Items (added 29 Sep 2026): gate_pass_items is shared with hand-added
# rows from the app itself (source='MANUAL') — see _deactivate_missing_
# fabric_items below for why that table can't use the plain
# common.deactivate_missing helper the other two use.
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
ITEM_COLUMNS = ["item_code", "item_name"]


def _fetch_vendors(fabric_conn):
    # FABRIC_ADDRESS_TABLE.location is NOT unique (multiple address/version
    # rows can share the same location value) - joining the raw table fans
    # a single vendor out into 2+ result rows sharing one accountnum, which
    # trips a CardinalityViolation on the upsert. Dedupe to one row per
    # location (most recently modified wins) before joining.
    query = f"""
        WITH dedup_address AS (
            SELECT
                location, city, zipcode,
                ROW_NUMBER() OVER (
                    PARTITION BY location ORDER BY SinkModifiedOn DESC
                ) AS rn
            FROM {settings.FABRIC_ADDRESS_TABLE}
        )
        SELECT
            v.accountnum AS vendor_code,
            p.name       AS vendor_name,
            a.city       AS city,
            a.zipcode    AS post_code
        FROM {settings.FABRIC_VENDOR_TABLE} v
        LEFT JOIN {settings.FABRIC_PARTY_TABLE} p
            ON v.party = p.recid
        LEFT JOIN dedup_address a
            ON p.primaryaddresslocation = a.location AND a.rn = 1
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


def _fetch_items(fabric_conn):
    # NULL-filtered up front (unlike the original _fetch_assets, which
    # learned the hard way: one NULL assetid poisoned the whole upsert
    # batch and silently dropped an entire sync run — see incident 23 Sep
    # 2026). A row missing either half is useless as a master row anyway.
    query = (
        f"SELECT itemid AS item_code, namealias AS item_name "
        f"FROM {settings.FABRIC_ITEMS_TABLE} "
        f"WHERE itemid IS NOT NULL AND namealias IS NOT NULL"
    )
    with fabric_conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
    # source='FABRIC', is_active=True for every pulled row.
    return [tuple(row) + ("FABRIC", True) for row in rows]


def _deactivate_missing_fabric_items(target_conn, seen_codes, job_name: str) -> int:
    """Same idea as common.deactivate_missing, but scoped to source='FABRIC'
    only. gate_pass_items also holds hand-added rows (source='MANUAL',
    item_code always NULL) that never appear in a Fabric pull — the shared
    helper's blunt "NOT IN seen_ids" would deactivate every one of those on
    the very next sync run, which is wrong. This only ever touches rows
    this pipeline itself owns."""
    if not seen_codes:
        logger.warning(
            "[%s] source returned zero rows for gate_pass_items — skipping "
            "deactivation pass (treating as a source-side problem, not an "
            "empty master)", job_name,
        )
        return 0
    with target_conn.cursor() as cur:
        cur.execute(
            "UPDATE gate_pass_items SET is_active = false "
            "WHERE is_active = true AND source = 'FABRIC' AND item_code NOT IN %s",
            (tuple(seen_codes),),
        )
        return cur.rowcount


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

    try:
        item_rows = _fetch_items(fabric_conn)
        i_inserted, i_updated = upsert_rows(
            target_conn, "gate_pass_items",
            ITEM_COLUMNS + ["source", "is_active"],
            "item_code", item_rows,
        )
        i_deactivated = _deactivate_missing_fabric_items(
            target_conn, [r[0] for r in item_rows], _JOB_NAME,
        )
        target_conn.commit()
        logger.info(
            "[%s] items: +%d/~%d/-%d",
            _JOB_NAME, i_inserted, i_updated, i_deactivated,
        )
    except Exception:
        target_conn.rollback()
        logger.exception("[%s] item sync failed", _JOB_NAME)

    if fabric_conn:
        fabric_conn.close()
    if target_conn:
        target_conn.close()
