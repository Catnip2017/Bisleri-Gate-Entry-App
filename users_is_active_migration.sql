-- users_is_active_migration.sql
-- Deactivate-don't-delete (12 Jul 2026): users keep their row and history
-- forever; access is switched off with a flag. Checked on EVERY request
-- (get_current_user), so deactivation bites mid-session despite 8h tokens.
-- NULL is treated as active, so pre-migration rows are unaffected even
-- before this runs. Idempotent.
--
-- Run on dev:
--   "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres -d Bisleri_dev -f users_is_active_migration.sql
--
-- Revert:  ALTER TABLE users_master DROP COLUMN IF EXISTS is_active;

ALTER TABLE users_master
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

UPDATE users_master SET is_active = TRUE WHERE is_active IS NULL;
