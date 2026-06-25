-- ============================================================
-- copacker_session_migration.sql
-- Phase 2: Session-based 4-machine capture system.
--
-- Run this AFTER copacker_migration.sql (Phase 1).
-- The existing tables (copacker_entries, copacker_quantity_edit_log)
-- are NOT touched — kept intact for historical data.
--
-- Drop existing Phase 2 tables if present, then recreate cleanly.
-- ============================================================

DROP TABLE IF EXISTS copacker_capture_edit_log CASCADE;
DROP TABLE IF EXISTS copacker_captures         CASCADE;
DROP TABLE IF EXISTS copacker_sessions         CASCADE;

-- 1. One row per production run (session)
CREATE TABLE copacker_sessions (
    id                SERIAL PRIMARY KEY,
    copacker_location VARCHAR(200)  NOT NULL,
    line_no           INTEGER       NOT NULL,
    sku_name          VARCHAR(500),
    sku_item_id       VARCHAR(100),
    status            VARCHAR(20)   NOT NULL DEFAULT 'in_progress',
    --   'in_progress' = not all 4 captures done yet
    --   'completed'   = all 4 captures submitted
    submitted_by      VARCHAR(100)  NOT NULL,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ
);

-- 2. One row per machine image capture (max 4 per session)
CREATE TABLE copacker_captures (
    id                    SERIAL PRIMARY KEY,
    session_id            INTEGER      NOT NULL
                              REFERENCES copacker_sessions(id) ON DELETE CASCADE,
    step_order            INTEGER      NOT NULL CHECK (step_order BETWEEN 1 AND 4),
    --   1 = blow_molder
    --   2 = bottling
    --   3 = labelling
    --   4 = case_counter
    capture_type          VARCHAR(50)  NOT NULL,

    asset_model_id        VARCHAR(100),
    image_path            VARCHAR(500),
    ocr_raw               TEXT,              -- full AI JSON blob, audit trail

    -- ── Blow Molder canonical fields (step 1) ──────────────────────────────
    bottle_recipe                  VARCHAR(500),
    last_hour_production_count     BIGINT,    -- Last Hour Production, Last Hour Count, Hourly Production, Bottles/Last Hour
    production_count_current_batch BIGINT,    -- Batch Production, Batch Count, Current Batch Output
    total_production_count         BIGINT,    -- Production Count, Total Bottles Blown, Cumulative Production, Lifetime Count
    good_bottles_count             BIGINT,    -- Number of Capped Bottles, Accepted Bottles, Good Bottles
    preforms_processed_count       BIGINT,    -- Preform Blowed Quantity, Preforms Blown, Preform Count
    target_batch_quantity          BIGINT,    -- Standard Bottle Quantity, Planned Quantity, Target Quantity

    -- ── Bottling fields (step 2) ────────────────────────────────────────────
    bottles_total         BIGINT,
    production_speed_bph  INTEGER,

    -- ── Labelling fields (step 3) ───────────────────────────────────────────
    labels_count          BIGINT,
    label_format          VARCHAR(200),

    -- ── Case Counter fields (step 4) ────────────────────────────────────────
    packs_counter         INTEGER,
    pack_format           VARCHAR(200),

    captured_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    captured_by           VARCHAR(100),

    UNIQUE (session_id, step_order)
);

-- 3. Edit audit log
CREATE TABLE copacker_capture_edit_log (
    id              SERIAL PRIMARY KEY,
    capture_id      INTEGER      NOT NULL
                        REFERENCES copacker_captures(id) ON DELETE CASCADE,
    field_name      VARCHAR(100) NOT NULL,
    original_value  TEXT,
    edited_value    TEXT,
    edited_by       VARCHAR(100) NOT NULL,
    edited_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cp_captures_session
    ON copacker_captures(session_id);

CREATE INDEX idx_cp_sessions_location
    ON copacker_sessions(copacker_location);

CREATE INDEX idx_cp_sessions_user
    ON copacker_sessions(submitted_by);

CREATE INDEX idx_cp_sessions_created
    ON copacker_sessions(created_at DESC);
