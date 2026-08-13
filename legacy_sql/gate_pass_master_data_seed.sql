-- gate_pass_master_data_seed.sql
-- Seed data for gate_pass_departments and gate_pass_locations, sourced from
-- deaprtment_master.xlsx and gate_pass_location_master.xlsx.
-- Idempotent (ON CONFLICT DO NOTHING) — safe to run more than once.
--
-- Run AFTER your Alembic migration has created gate_pass_departments.
--   "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres -d Bisleri_dev -f gate_pass_master_data_seed.sql

BEGIN;

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
