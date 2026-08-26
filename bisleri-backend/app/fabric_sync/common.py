# app/fabric_sync/common.py
#
# Shared helper for every Fabric sync job: after a full-pull + upsert, any
# row in our table that ISN'T in this pull is soft-deactivated
# (is_active = false) — never hard-deleted, so a gate pass created against
# a vendor/customer/asset that's later retired at the source can still
# resolve its details. An empty pull is treated as a source-side problem,
# not "the master is now empty" — deactivation is skipped entirely rather
# than wiping the table.
import logging

logger = logging.getLogger(__name__)


def deactivate_missing(target_conn, table: str, pk_column: str, seen_ids, job_name: str) -> int:
    if not seen_ids:
        logger.warning(
            "[%s] source returned zero rows for %s — skipping deactivation "
            "pass (treating as a source-side problem, not an empty master)",
            job_name, table,
        )
        return 0
    with target_conn.cursor() as cur:
        cur.execute(
            f"UPDATE {table} SET is_active = false "
            f"WHERE is_active = true AND {pk_column} NOT IN %s",
            (tuple(seen_ids),),
        )
        return cur.rowcount
