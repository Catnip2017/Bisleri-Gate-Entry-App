-- user_scope_fields_migration.sql
-- Adds department and gate_pass_location scope fields to users_master.
-- Required for Gate Pass User role scope: which department + which gate pass location.
-- Run once against Bisleri_01 / Bisleri_dev.
-- These columns were confirmed ADDED to the live DB on 11 July 2026.

BEGIN;

ALTER TABLE users_master ADD COLUMN IF NOT EXISTS department         VARCHAR(50);
ALTER TABLE users_master ADD COLUMN IF NOT EXISTS gate_pass_location VARCHAR(50);

COMMENT ON COLUMN users_master.department         IS 'Dept scope for Gate Pass User role (IT/Finance/Sales/Marketing/Admin/HR)';
COMMENT ON COLUMN users_master.gate_pass_location IS 'Gate pass location scope for Gate Pass User role (maps to gate_pass_locations.location_code)';

COMMIT;
