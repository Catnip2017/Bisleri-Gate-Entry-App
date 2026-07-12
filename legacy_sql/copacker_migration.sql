-- ============================================================
-- Co Packer Migration — Multi-field OCR extraction
-- Run this once against Bisleri_01 database
-- ============================================================

-- 1. Add 7 new OCR extraction columns to copacker_entries
ALTER TABLE copacker_entries
    ADD COLUMN IF NOT EXISTS preform_total    BIGINT,
    ADD COLUMN IF NOT EXISTS preform_shift    BIGINT,
    ADD COLUMN IF NOT EXISTS bottles_total   BIGINT,
    ADD COLUMN IF NOT EXISTS bottles_shift   BIGINT,
    ADD COLUMN IF NOT EXISTS operating_hours INTEGER,
    ADD COLUMN IF NOT EXISTS recipe          VARCHAR(500),
    ADD COLUMN IF NOT EXISTS asset_model_no  VARCHAR(100);

-- 2. Update edit log table to support multi-field edits
--    a) make edited_value nullable (was NOT NULL, only valid for qty edits)
ALTER TABLE copacker_quantity_edit_log
    ALTER COLUMN edited_value DROP NOT NULL;

--    b) add field_name so logs know which field was edited
ALTER TABLE copacker_quantity_edit_log
    ADD COLUMN IF NOT EXISTS field_name           VARCHAR(50) DEFAULT 'extracted_quantity',
    ADD COLUMN IF NOT EXISTS original_text_value  TEXT,
    ADD COLUMN IF NOT EXISTS edited_text_value    TEXT;

-- 3. Back-fill field_name for existing rows
UPDATE copacker_quantity_edit_log
SET field_name = 'extracted_quantity'
WHERE field_name IS NULL;

-- Done — verify:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'copacker_entries' ORDER BY ordinal_position;
