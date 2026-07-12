-- user_gate_pass_locations_migration.sql
-- Gate Pass build queue: one user -> N gate pass locations, exactly one
-- starred default per user. users_master.gate_pass_location stays as the
-- legacy fallback (holds the default) during transition.
-- Idempotent: safe to run repeatedly.
--
-- Run on dev:
--   "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres -d Bisleri_dev -f user_gate_pass_locations_migration.sql

CREATE TABLE IF NOT EXISTS user_gate_pass_locations (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL REFERENCES users_master(username) ON DELETE CASCADE,
    location_code VARCHAR(10)  NOT NULL REFERENCES gate_pass_locations(location_code),
    is_default    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (username, location_code)
);

CREATE INDEX IF NOT EXISTS ix_ugpl_username
    ON user_gate_pass_locations (username);

-- The star rule: at most ONE default row per user, enforced by the DB.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ugpl_one_default_per_user
    ON user_gate_pass_locations (username) WHERE is_default;

-- Backfill: every existing single-location assignment becomes that user's
-- starred default. Skips users whose location_code has no master row.
INSERT INTO user_gate_pass_locations (username, location_code, is_default)
SELECT u.username, u.gate_pass_location, TRUE
FROM users_master u
JOIN gate_pass_locations g ON g.location_code = u.gate_pass_location
WHERE u.gate_pass_location IS NOT NULL
ON CONFLICT (username, location_code) DO NOTHING;

-- Verify:
--   SELECT username, location_code, is_default FROM user_gate_pass_locations ORDER BY username;
