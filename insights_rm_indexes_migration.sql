-- insights_rm_indexes_migration.sql
-- Pass 3 — Q9: indexes for the hot filter/sort columns on the two
-- fast-growing tables (insights_data, raw_materials_data).
-- Idempotent: safe to run repeatedly (IF NOT EXISTS).
--
-- Run on dev:
--   "C:\Program Files\PostgreSQL\16\bin\psql" -U <user> -d Bisleri_dev -f insights_rm_indexes_migration.sql
--
-- NOTE for a busy PRODUCTION db: CREATE INDEX briefly blocks writes while
-- building. If that matters, run each statement separately as
-- CREATE INDEX CONCURRENTLY (cannot run inside a transaction block).

-- ── insights_data ────────────────────────────────────────────────────────────
-- Composite: every non-admin query filters warehouse_code AND sorts by date
-- desc. One index serves the WHERE, the ORDER BY, and Q8's COUNT(*).
CREATE INDEX IF NOT EXISTS ix_insights_warehouse_date
    ON insights_data (warehouse_code, date DESC);

-- Date alone: admin (all-warehouse) queries + records-needing-completion /
-- edit-statistics time-window scans. Composite above can't serve these
-- (leading-column rule: it's grouped by warehouse first).
CREATE INDEX IF NOT EXISTS ix_insights_data_date
    ON insights_data (date DESC);

CREATE INDEX IF NOT EXISTS ix_insights_data_movement_type
    ON insights_data (movement_type);

CREATE INDEX IF NOT EXISTS ix_insights_data_warehouse_code
    ON insights_data (warehouse_code);

-- ── raw_materials_data ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_rm_warehouse_datetime
    ON raw_materials_data (warehouse_code, date_time DESC);

CREATE INDEX IF NOT EXISTS ix_raw_materials_data_date_time
    ON raw_materials_data (date_time DESC);

CREATE INDEX IF NOT EXISTS ix_raw_materials_data_gate_type
    ON raw_materials_data (gate_type);

CREATE INDEX IF NOT EXISTS ix_raw_materials_data_warehouse_code
    ON raw_materials_data (warehouse_code);

-- vehicle_no deliberately NOT indexed: searches use ILIKE '%..%' (contains),
-- which a B-tree cannot serve. If vehicle search ever feels slow, add a
-- pg_trgm GIN index instead.

-- Refresh planner statistics so the new indexes are used immediately.
ANALYZE insights_data;
ANALYZE raw_materials_data;

-- Verify (plan should show Index Scan / Index Only Scan, not Seq Scan):
--   EXPLAIN ANALYZE SELECT COUNT(*) FROM insights_data WHERE warehouse_code = 'WH-HO';
