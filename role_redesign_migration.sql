-- ============================================================================
-- ROLE MODEL REDESIGN MIGRATION  (LOCKED 14 Jul 2026 — CONTEXT_SUMMARY §11)
-- Run ONCE on Bisleri_dev with psql. Data-only: no schema changes.
--
-- Mapping (decided 14 Jul 2026):
--   Security Guard + Gate Pass User  ->  Security Guard + Gate Pass Dispatcher
--   Gate Pass User (alone)           ->  Gate Pass Creator
--   IT Admin + Gate Pass User        ->  IT Admin + Gate Pass Creator
--   Security Admin                   ->  token REMOVED everywhere
--                                        (SA-only users become no-role ->
--                                         blocked at login popup, deliberate)
-- Junction locations, ★ defaults and departments are untouched.
--
-- DRY RUN first — see what will change:
--   SELECT username, role FROM users_master
--   WHERE role ILIKE '%gate pass user%' OR role ILIKE '%security admin%';
-- ============================================================================

BEGIN;

UPDATE users_master u
SET role = (
    SELECT NULLIF(string_agg(mapped, ', '), '')
    FROM (
        SELECT CASE
            WHEN lower(btrim(tok)) = 'gate pass user' THEN
                CASE WHEN u.role ILIKE '%security guard%'
                     THEN 'Gate Pass Dispatcher'
                     ELSE 'Gate Pass Creator'
                END
            ELSE btrim(tok)
        END AS mapped
        FROM unnest(string_to_array(u.role, ',')) AS tok
        WHERE btrim(tok) <> ''
          AND lower(btrim(tok)) <> 'security admin'
    ) AS m
)
WHERE u.role ILIKE '%gate pass user%'
   OR u.role ILIKE '%security admin%';

COMMIT;

-- ── Verification ────────────────────────────────────────────────────────────
-- 1. No legacy tokens must remain (both counts = 0):
--    SELECT count(*) FROM users_master WHERE role ILIKE '%gate pass user%';
--    SELECT count(*) FROM users_master WHERE role ILIKE '%security admin%';
-- 2. No illegal combos must exist (all counts = 0):
--    SELECT count(*) FROM users_master
--    WHERE role ILIKE '%gate pass dispatcher%' AND role NOT ILIKE '%security guard%';
--    SELECT count(*) FROM users_master
--    WHERE role ILIKE '%gate pass creator%'
--      AND (role ILIKE '%security guard%' OR role ILIKE '%gate pass dispatcher%');
--    SELECT count(*) FROM users_master
--    WHERE role ILIKE '%it admin%' AND role ILIKE '%security guard%';
-- 3. Users who lost all roles (ex Security-Admin-only — they will see the
--    "no access assigned" popup at login; reassign roles when decided):
--    SELECT username, first_name, last_name FROM users_master
--    WHERE role IS NULL OR btrim(role) = '';
