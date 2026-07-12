-- gate_pass_migration.sql
-- Returnable / Non-Returnable Gate Pass module — run once against Bisleri_01.
-- PLACEHOLDER masters (locations, parties, items, cancel reasons) are seeded
-- below; replace seeds when the real location master and the Microsoft Fabric
-- party/item pipelines are confirmed.

BEGIN;

-- ── Placeholder location master (real master TBC — NOT location_master) ─────
CREATE TABLE IF NOT EXISTS gate_pass_locations (
    id              SERIAL PRIMARY KEY,
    location_code   VARCHAR(10)  NOT NULL UNIQUE,
    location_name   VARCHAR(255) NOT NULL,
    warehouse_code  VARCHAR(50),              -- maps to location_master.warehouse_code (guard visibility)
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Placeholder party master (to be fed by Fabric pipeline) ─────────────────
CREATE TABLE IF NOT EXISTS gate_pass_parties (
    party_code  VARCHAR(50)  PRIMARY KEY,
    party_name  VARCHAR(255) NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ── Placeholder item master (to be fed by Fabric pipeline) ──────────────────
CREATE TABLE IF NOT EXISTS gate_pass_items (
    item_code  VARCHAR(50)  PRIMARY KEY,
    item_name  VARCHAR(255) NOT NULL,
    item_type  VARCHAR(20)  NOT NULL DEFAULT 'Item',   -- 'Fixed Asset' | 'Item'
    uom        VARCHAR(20),
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ── Cancel reason master (PLACEHOLDER values — admin-maintained) ─────────────
CREATE TABLE IF NOT EXISTS gate_pass_cancel_reasons (
    id          SERIAL PRIMARY KEY,
    reason_text VARCHAR(255) NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ── Incremental number series (per location, per type — never reused) ────────
CREATE TABLE IF NOT EXISTS gate_pass_sequences (
    id            SERIAL PRIMARY KEY,
    location_code VARCHAR(10) NOT NULL,
    pass_type     VARCHAR(3)  NOT NULL,       -- 'R' | 'NR'
    last_number   INTEGER     NOT NULL DEFAULT 0,
    CONSTRAINT uq_gate_pass_seq_loc_type UNIQUE (location_code, pass_type)
);

-- ── Header ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gate_pass_headers (
    id                   SERIAL PRIMARY KEY,
    gate_pass_no         VARCHAR(30) NOT NULL UNIQUE,
    pass_type            VARCHAR(3)  NOT NULL,
    status               VARCHAR(30) NOT NULL DEFAULT 'Open',
    location_code        VARCHAR(10) NOT NULL,
    warehouse_code       VARCHAR(50),
    document_date        DATE        NOT NULL,
    document_time        VARCHAR(12) NOT NULL,
    party_code           VARCHAR(50)  NOT NULL,
    party_name           VARCHAR(255) NOT NULL,
    department           VARCHAR(50)  NOT NULL,
    mode_of_transport    VARCHAR(30)  NOT NULL,
    vehicle_no           VARCHAR(20),
    sender_name          VARCHAR(100),
    approver_name        VARCHAR(100),
    expected_inward_date DATE,
    remarks              TEXT,
    created_by           VARCHAR(50) NOT NULL,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    released_by          VARCHAR(50),
    released_at          TIMESTAMPTZ,
    dispatched_by        VARCHAR(50),
    dispatched_at        TIMESTAMPTZ,
    dispatch_remarks     TEXT,
    completed_at         TIMESTAMPTZ,
    cancelled_by         VARCHAR(50),
    cancelled_at         TIMESTAMPTZ,
    cancel_reason_id     INTEGER REFERENCES gate_pass_cancel_reasons(id),
    cancel_remarks       TEXT,
    replacement_pass_no  VARCHAR(30),
    closed_by            VARCHAR(50),
    closed_at            TIMESTAMPTZ,
    close_reason         TEXT
);

-- Most-filtered columns get indexes up front (Pass 3 lesson).
CREATE INDEX IF NOT EXISTS idx_gph_status         ON gate_pass_headers (status);
CREATE INDEX IF NOT EXISTS idx_gph_pass_type      ON gate_pass_headers (pass_type);
CREATE INDEX IF NOT EXISTS idx_gph_location       ON gate_pass_headers (location_code);
CREATE INDEX IF NOT EXISTS idx_gph_warehouse      ON gate_pass_headers (warehouse_code);
CREATE INDEX IF NOT EXISTS idx_gph_department     ON gate_pass_headers (department);
CREATE INDEX IF NOT EXISTS idx_gph_expected_date  ON gate_pass_headers (expected_inward_date);
CREATE INDEX IF NOT EXISTS idx_gph_created_at     ON gate_pass_headers (created_at);

-- ── Lines ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gate_pass_lines (
    id            SERIAL PRIMARY KEY,
    gate_pass_id  INTEGER NOT NULL REFERENCES gate_pass_headers(id) ON DELETE CASCADE,
    line_no       INTEGER NOT NULL,
    item_code     VARCHAR(50),
    item_type     VARCHAR(20),
    description   VARCHAR(250) NOT NULL,
    serial_no     VARCHAR(100),
    uom           VARCHAR(20) NOT NULL DEFAULT 'NOS',
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    amount        NUMERIC(14,2),
    chargeable    VARCHAR(20),
    received_qty  INTEGER NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
    CONSTRAINT uq_gate_pass_line_no UNIQUE (gate_pass_id, line_no)
);
CREATE INDEX IF NOT EXISTS idx_gpl_pass ON gate_pass_lines (gate_pass_id);

-- ── Append-only event log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gate_pass_events (
    id            SERIAL PRIMARY KEY,
    gate_pass_id  INTEGER NOT NULL REFERENCES gate_pass_headers(id) ON DELETE CASCADE,
    event_type    VARCHAR(20) NOT NULL,
    event_by      VARCHAR(50) NOT NULL,
    event_at      TIMESTAMPTZ DEFAULT NOW(),
    remarks       TEXT,
    details_json  TEXT
);
CREATE INDEX IF NOT EXISTS idx_gpe_pass ON gate_pass_events (gate_pass_id);

-- ── PLACEHOLDER SEEDS ────────────────────────────────────────────────────────
-- Locations: replace when the real gate pass location master is confirmed.
-- warehouse_code values must exist in location_master for guard visibility.
INSERT INTO gate_pass_locations (location_code, location_name, warehouse_code) VALUES
    ('HO',  'Head Office - Mumbai',   NULL),
    ('CHN', 'Chennai Depot',          NULL),
    ('DEL', 'Delhi Plant',            NULL)
ON CONFLICT (location_code) DO NOTHING;
-- Run this once to fix encoding-garbled data from earlier migration runs:
-- UPDATE gate_pass_locations SET location_name = 'Head Office - Mumbai' WHERE location_code = 'HO';
-- NOTE: set warehouse_code per row once mapping is known, e.g.:
-- UPDATE gate_pass_locations SET warehouse_code = 'WH001' WHERE location_code = 'HO';

-- Parties: placeholder rows until the Fabric pipeline lands.
INSERT INTO gate_pass_parties (party_code, party_name) VALUES
    ('V01238', 'Reliance Digital Service Centre Pvt Ltd'),
    ('V02417', 'Canon Care Centre'),
    ('V03555', 'Shree Metal Traders'),
    ('V04102', 'HP Service Hub')
ON CONFLICT (party_code) DO NOTHING;

-- Items: placeholder rows until the Fabric pipeline lands.
INSERT INTO gate_pass_items (item_code, item_name, item_type, uom) VALUES
    ('FA-COM-0412', 'Dell Latitude 5440 Laptop', 'Fixed Asset', 'NOS'),
    ('FA-COM-0500', 'HP LaserJet Printer',       'Fixed Asset', 'NOS'),
    ('IT-ACC-0021', 'Keyboard',                  'Item',        'NOS'),
    ('IT-ACC-0022', 'Mouse',                     'Item',        'NOS')
ON CONFLICT (item_code) DO NOTHING;

-- Cancel reasons: PLACEHOLDERS — replace with the business-approved list.
INSERT INTO gate_pass_cancel_reasons (reason_text, sort_order) VALUES
    ('Wrong party selected',            1),
    ('Wrong item / quantity entered',   2),
    ('Duplicate pass',                  3),
    ('Movement no longer required',     4),
    ('Vendor pickup cancelled',         5),
    ('Other (see remarks)',             6)
ON CONFLICT (reason_text) DO NOTHING;

COMMIT;
