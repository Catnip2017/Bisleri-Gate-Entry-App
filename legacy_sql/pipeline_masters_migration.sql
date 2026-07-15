-- ============================================================================
-- PIPELINE MASTERS MIGRATION (14 Jul 2026)
-- Aligns the gate pass masters with the Fabric pipeline feeds agreed with
-- Sunil: party master (No./Name/City/Post Code/Phone/Contact) and fixed
-- asset master (Asset No./Description/FA Class Code). Adds the FA-class
-- snapshot column on pass lines. Run ONCE on Bisleri_dev with psql.
-- ============================================================================
BEGIN;

-- Party master: 4 new feed columns (phone is VARCHAR by decision — leading
-- zeros, +91, slashes; int32 overflows on real 10-digit numbers)
ALTER TABLE gate_pass_parties
    ADD COLUMN IF NOT EXISTS city      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS post_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS phone_no  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS contact   VARCHAR(255);

-- Asset master: only Fixed Assets are mastered. uom (Unit dropdown owns it)
-- and item_type (always 'Fixed Asset' here) are dropped; FA Class Code added.
ALTER TABLE gate_pass_items
    ADD COLUMN IF NOT EXISTS fa_class_code VARCHAR(50);
ALTER TABLE gate_pass_items DROP COLUMN IF EXISTS uom;
ALTER TABLE gate_pass_items DROP COLUMN IF EXISTS item_type;

-- Pass lines: FA class snapshot at creation (historical fact — never updated)
ALTER TABLE gate_pass_lines
    ADD COLUMN IF NOT EXISTS fa_class_code VARCHAR(50);

COMMIT;

-- Verification:
--   \d gate_pass_parties   -> city, post_code, phone_no, contact present
--   \d gate_pass_items     -> fa_class_code present; uom, item_type gone
--   \d gate_pass_lines     -> fa_class_code present
