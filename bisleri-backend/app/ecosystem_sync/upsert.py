# app/ecosystem_sync/upsert.py
#
# Shared upsert helper for the ecosystem sync scripts (incremental_sync.py
# and one_time_master_sync.py) — INSERT ... ON CONFLICT DO UPDATE, always
# safe to re-run against rows already synced.
from psycopg2.extras import execute_values


def upsert_rows(target_conn, table, columns, conflict_col, rows):
    """Returns (inserted_count, updated_count). xmax = 0 is the standard
    Postgres tell for "this row was just inserted, nothing has touched it
    before" — non-zero means the ON CONFLICT branch updated an existing row."""
    if not rows:
        return 0, 0
    update_cols = [c for c in columns if c != conflict_col]
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    query = f"""
        INSERT INTO {table} ({", ".join(columns)})
        VALUES %s
        ON CONFLICT ({conflict_col}) DO UPDATE SET {set_clause}
        RETURNING (xmax = 0) AS inserted
    """
    with target_conn.cursor() as cur:
        results = execute_values(cur, query, rows, fetch=True)
    inserted = sum(1 for r in results if r[0])
    return inserted, len(results) - inserted
