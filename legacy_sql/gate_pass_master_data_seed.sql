-- gate_pass_master_data_seed.sql
-- Creates gate_pass_departments and gate_pass_locations (if not already
-- present) and seeds them, sourced from deaprtment_master.xlsx and
-- gate_pass_location_master.xlsx.
-- Idempotent (CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING) — safe to
-- run more than once, and safe to run whether or not the matching Alembic
-- migrations (213928c9dad2, 7b84e57cc45b) have already been applied on this
-- database — the table shapes here match those migrations / app/models/gate_pass.py
-- exactly, so this never fights with a later `alembic upgrade head`.
--   "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres -d Bisleri_dev -f gate_pass_master_data_seed.sql

BEGIN;

-- ── Table definitions (skipped if the Alembic migration already created them) ──

CREATE TABLE IF NOT EXISTS gate_pass_departments (
    id              SERIAL PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gate_pass_locations (
    id              SERIAL PRIMARY KEY,
    location_code   VARCHAR(10) NOT NULL UNIQUE,
    location_name   VARCHAR(255) NOT NULL,
    warehouse_code  VARCHAR(50),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Departments (20 rows, from deaprtment_master.xlsx) ──────────────────────
INSERT INTO gate_pass_departments (department_name, sort_order) VALUES
    ('Accounts',             1),
    ('Admin',                2),
    ('Chairman Office',      3),
    ('CSR',                  4),
    ('Customer Care',        5),
    ('HR',                   6),
    ('IT',                   7),
    ('Legal',                8),
    ('Maintenance',          9),
    ('Management',          10),
    ('Marketing',           11),
    ('Procurement',         12),
    ('Production',          13),
    ('Project Development', 14),
    ('Public Relation',     15),
    ('Quality',             16),
    ('Sales',               17),
    ('Shipping',            18),
    ('Store',               19),
    ('Technical',           20)
ON CONFLICT (department_name) DO NOTHING;

-- ── Gate pass locations (28 rows, from gate_pass_location_master.xlsx) ──────
-- NOTE: GWP and ASM are still open questions (0 warehouses found under
-- either in Warehouse Master.xlsx; GWP also shares its name "GUWAHATI"
-- with GUW, which does have warehouses). Loaded here as-is per the master
-- you provided — delete/comment out these two lines if you decide to drop
-- them once confirmed with whoever owns the location list.
INSERT INTO gate_pass_locations (location_code, location_name, warehouse_code) VALUES
    ('AP',  'ANDHRA PRADESH',        NULL),
    ('ASM', 'ASSAM',                 NULL),  -- unresolved, see note above
    ('CGH', 'CHHATTISGARH',          NULL),
    ('DEL', 'DELHI',                 NULL),
    ('GOA', 'GOA',                   NULL),
    ('GUJ', 'GUJARAT',               NULL),
    ('GUW', 'GUWAHATI',              NULL),
    ('GWP', 'GUWAHATI',              NULL),  -- unresolved, see note above
    ('HO',  'HEAD OFFICE',           NULL),
    ('HP',  'HIMACHAL PRADESH',      NULL),
    ('HRN', 'HARYANA',               NULL),
    ('HYD', 'TELANGANA',             NULL),
    ('JAI', 'JAIPUR',                NULL),
    ('KAM', 'Kamshet',               NULL),
    ('KAR', 'KARNATAKA',             NULL),
    ('KEL', 'KERALA',                NULL),
    ('LDH', 'LUDHIANA',              NULL),
    ('MP',  'MADHYA PRADESH',        NULL),
    ('MUM', 'MUMBAI',                NULL),
    ('NAG', 'NAGPUR',                NULL),
    ('NB',  'WEST BENGAL',           NULL),
    ('OD',  'ODISHA',                NULL),
    ('PB',  'CHANDIGARH',            NULL),
    ('PRJ', 'PRAYAGRAJ',             NULL),
    ('RDP', 'RUDRAPUR',              NULL),
    ('ROM', 'REST OF MAHARASHTRA',   NULL),
    ('SBD', 'SAHIBABAD',             NULL),
    ('TN',  'TAMILNADU',             NULL)
ON CONFLICT (location_code) DO NOTHING;

COMMIT;

-- Verify:
--   SELECT department_name, sort_order FROM gate_pass_departments ORDER BY sort_order;
--   SELECT location_code, location_name FROM gate_pass_locations ORDER BY location_code;
