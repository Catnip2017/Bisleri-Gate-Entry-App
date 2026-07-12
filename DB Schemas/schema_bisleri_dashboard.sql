-- ============================================================
--  BISLERI GATE ENTRY APP — Database 2 of 3: Bisleri_dashboard
--  PostgreSQL >= 14
--
--  Vehicle/Load analytics DB (HISTORICAL_DB_* in .env).
--  Extracted from the ETL code in app/dashboard/etl/*.
--  Generated: 2026-07-13
--
--  Provision:
--    psql -U postgres -c "CREATE DATABASE \"Bisleri_dashboard\";"
--    psql -U postgres -d Bisleri_dashboard -f schema_bisleri_dashboard.sql
--
--  NOTE ON OWNERSHIP:
--  Section A tables are CREATEd by the ETL itself (authoritative DDL below,
--  copied verbatim from the ETL's CREATE TABLE statements).
--  Section B tables are HISTORICAL MIRRORS populated by data_sync.py via
--  INSERT..ON CONFLICT — they must already exist and mirror the matching
--  Bisleri_01 table plus source_id + updated_at. Their exact DDL is not in
--  the app code; compare against production and add here once confirmed.
-- ============================================================


-- ============================================================
--  SECTION A — Summary tables created by the ETL
-- ============================================================

-- ---- vehicle_load_summary  (app/dashboard/etl/lms.py) ----
CREATE TABLE IF NOT EXISTS vehicle_load_summary (
    id SERIAL PRIMARY KEY,
    vehicle_no VARCHAR(50) NOT NULL,
    gate_entry_no VARCHAR(50) NOT NULL,
    date TIMESTAMP NOT NULL,
    time TIME,
    warehouse_code VARCHAR(100),
    warehouse_name VARCHAR(100),
    site_code VARCHAR(100),
    total_weight_kg NUMERIC(12, 3),
    maximum_load_kg NUMERIC(12, 3),
    load_percentage NUMERIC(6, 2),
    document_count INTEGER DEFAULT 0,
    invoice_count INTEGER DEFAULT 0,
    challan_count INTEGER DEFAULT 0,
    transfer_count INTEGER DEFAULT 0,
    movement_type VARCHAR(20),
    security_name VARCHAR(255),
    driver_name VARCHAR(100),
    km_reading VARCHAR(10),
    processed_at TIMESTAMP DEFAULT NOW(),
    source_last_edited TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uniq_vehicle_load_gate UNIQUE (vehicle_no, gate_entry_no)
);
CREATE INDEX IF NOT EXISTS idx_vls_vehicle   ON vehicle_load_summary(vehicle_no);
CREATE INDEX IF NOT EXISTS idx_vls_gate      ON vehicle_load_summary(gate_entry_no);
CREATE INDEX IF NOT EXISTS idx_vls_date      ON vehicle_load_summary(date DESC);
CREATE INDEX IF NOT EXISTS idx_vls_warehouse ON vehicle_load_summary(warehouse_name);


-- ---- pipeline_refresh_log  (app/dashboard/etl/lms.py) ----
CREATE TABLE IF NOT EXISTS pipeline_refresh_log (
    id SERIAL PRIMARY KEY,
    refresh_date TIMESTAMP NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    empty_vehicles_excluded INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'running',
    error_message TEXT,
    completed_at TIMESTAMP,
    duration_seconds INTEGER
);


-- ---- document_tat_summary  (app/dashboard/etl/tat_generation.py) ----
CREATE TABLE IF NOT EXISTS document_tat_summary (
    id SERIAL PRIMARY KEY,
    gate_entry_no VARCHAR(50) NOT NULL,
    gate_entry_datetime TIMESTAMP NOT NULL,
    document_no VARCHAR(100),
    document_type VARCHAR(50),
    document_entry_datetime TIMESTAMP,
    vehicle_no VARCHAR(50),
    driver_name VARCHAR(100),
    warehouse_name VARCHAR(100),
    site_code VARCHAR(50),
    tat_minutes NUMERIC(10, 2),
    tat_formatted VARCHAR(20),
    entry_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uniq_doc_tat_gate_entry UNIQUE (gate_entry_no, document_no)
);
CREATE INDEX IF NOT EXISTS idx_doc_tat_entry_date     ON document_tat_summary(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_doc_tat_vehicle        ON document_tat_summary(vehicle_no);
CREATE INDEX IF NOT EXISTS idx_doc_tat_warehouse      ON document_tat_summary(warehouse_name);
CREATE INDEX IF NOT EXISTS idx_doc_tat_site           ON document_tat_summary(site_code);
CREATE INDEX IF NOT EXISTS idx_doc_tat_doc_no         ON document_tat_summary(document_no);
CREATE INDEX IF NOT EXISTS idx_doc_tat_date_warehouse ON document_tat_summary(entry_date DESC, warehouse_name);
CREATE INDEX IF NOT EXISTS idx_doc_tat_datetime       ON document_tat_summary(gate_entry_datetime DESC);


-- ---- vehicle_loading_time_summary  (app/dashboard/etl/tat_generation.py) ----
CREATE TABLE IF NOT EXISTS vehicle_loading_time_summary (
    id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(50),
    warehouse_name VARCHAR(100),
    vehicle_no VARCHAR(50),
    entry_gate_no VARCHAR(50) NOT NULL,
    entry_datetime TIMESTAMP NOT NULL,
    exit_gate_no VARCHAR(50),
    exit_datetime TIMESTAMP,
    loading_time_minutes NUMERIC(10, 2),
    loading_time_formatted VARCHAR(50),
    documents_in_entry INTEGER DEFAULT 0,
    documents_in_exit INTEGER DEFAULT 0,
    is_still_inside BOOLEAN DEFAULT FALSE,
    entry_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uniq_veh_loading_entry UNIQUE (entry_gate_no)
);
CREATE INDEX IF NOT EXISTS idx_veh_loading_entry_date     ON vehicle_loading_time_summary(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_veh_loading_vehicle        ON vehicle_loading_time_summary(vehicle_no);
CREATE INDEX IF NOT EXISTS idx_veh_loading_warehouse      ON vehicle_loading_time_summary(warehouse_name);
CREATE INDEX IF NOT EXISTS idx_veh_loading_still_inside   ON vehicle_loading_time_summary(is_still_inside) WHERE is_still_inside = TRUE;
CREATE INDEX IF NOT EXISTS idx_veh_loading_date_warehouse ON vehicle_loading_time_summary(entry_date DESC, warehouse_name);
CREATE INDEX IF NOT EXISTS idx_veh_loading_datetime       ON vehicle_loading_time_summary(entry_datetime DESC);


-- ---- loader_details_summary  (app/dashboard/etl/loader_details.py) ----
-- NOTE: the ETL only INSERTs into this table (ON CONFLICT (gate_entry_no));
-- it is NOT created in code. DDL below is INFERRED from the INSERT column
-- list — verify types against production before relying on it.
CREATE TABLE IF NOT EXISTS loader_details_summary (
    gate_entry_no VARCHAR(50) PRIMARY KEY,
    gate_entry_datetime TIMESTAMP,
    entry_date DATE,
    vehicle_no VARCHAR(50),
    vehicle_type VARCHAR(50),
    warehouse_code VARCHAR(50),
    warehouse_name VARCHAR(100),
    site_code VARCHAR(50),
    movement_type VARCHAR(20),
    document_types TEXT,
    security_name VARCHAR(255),
    driver_name VARCHAR(100),
    loader_names TEXT,
    loader_count INTEGER,
    updated_at TIMESTAMP DEFAULT NOW()
);


-- ============================================================
--  SECTION B — Historical mirror tables (populated by data_sync.py)
--  NOT created by the app. Structure mirrors the matching Bisleri_01
--  table + source_id + updated_at. Add verified DDL after comparing
--  with production.
-- ============================================================
--   insights_data_historical                 (mirror of insights_data)
--   mfabric_deliverychallan_data_historical  (mirror of mfabric_deliverychallan_data)
--   mfabric_invoice_data_historical          (mirror of mfabric_invoice_data)
--   mfabric_transferorder_rgp_data_historical(mirror of mfabric_transferorder_rgp_data)
--   vehicle_master                            (source master — externally provided)
--   item_master                               (mirror of item_master)
--   dashboard_data                            (unified doc index built by mfabric.py)
-- ============================================================
