-- ============================================================
--  BISLERI GATE ENTRY APP — Database 3 of 3: RPA_Automation
--  PostgreSQL >= 14
--
--  RPA / Vendor-Payment dashboard DB (RPA_DB_* in .env).
--  Generated: 2026-07-13
--
--  OWNERSHIP: This database is populated and owned by EXTERNAL RPA jobs,
--  not by this application. The app (app/routers/rpa.py) only READS from
--  it. The DDL below is INFERRED from the columns the app SELECTs — it is
--  a reference for comparison, NOT an authoritative create script. Treat
--  the production database as the source of truth and reconcile against it.
--
--  App access: read-only, IT Admin only (_require_itadmin).
-- ============================================================


-- ---- payment_details ----
-- The only table read by the app. Columns below are every field referenced
-- in app/routers/rpa.py (VPA summary + records endpoints). Types are best-
-- effort guesses — confirm precision/nullability against production.
CREATE TABLE IF NOT EXISTS payment_details (
    recid            VARCHAR(100),   -- grouped/counted DISTINCT; likely PK or business key
    vendor_name      VARCHAR(255),
    vendor_code      VARCHAR(100),
    vendor_email     VARCHAR(255),
    site             VARCHAR(100),
    status           VARCHAR(50),    -- expected values: failed | undeliverable | completed | pending
    payment_date     TIMESTAMP,
    payment_amount   NUMERIC(14, 2),
    payment_type     VARCHAR(50),
    invoice_number   VARCHAR(100),   -- COUNT(DISTINCT NULLIF(invoice_number,''))
    email_sent_date  TIMESTAMP
    -- Additional columns may exist in production that the app does not read.
);

-- Recommended (verify against production before applying):
-- CREATE INDEX IF NOT EXISTS idx_payment_details_status ON payment_details(status);
-- CREATE INDEX IF NOT EXISTS idx_payment_details_recid  ON payment_details(recid);
-- CREATE INDEX IF NOT EXISTS idx_payment_details_pdate  ON payment_details(payment_date);
