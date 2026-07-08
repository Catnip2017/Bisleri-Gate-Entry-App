# app/dashboard/etl/tat_generation.py
#
# Ported 1:1 from Load_management/TAT_generation.py.
# Builds/updates document_tat_summary and vehicle_loading_time_summary on the
# historical (Bisleri_dashboard) DB.
import logging
from datetime import datetime, timedelta

import psycopg2

from .connections import HISTORICAL_DB
from .constants import TABLES

logger = logging.getLogger(__name__)


class TATSummaryBuilder:
    """Builds and maintains TAT summary tables"""

    def __init__(self):
        self.conn = None
        self.cursor = None

    def connect(self):
        """Establish database connection"""
        try:
            self.conn = psycopg2.connect(**HISTORICAL_DB)
            self.cursor = self.conn.cursor()
            logger.info("Database connection established")
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise

    def disconnect(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        logger.info("Database connection closed")

    def create_document_tat_table(self):
        """Create document_tat_summary table with indexes"""
        create_table_sql = """
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

        CREATE INDEX IF NOT EXISTS idx_doc_tat_entry_date
            ON document_tat_summary(entry_date DESC);

        CREATE INDEX IF NOT EXISTS idx_doc_tat_vehicle
            ON document_tat_summary(vehicle_no);

        CREATE INDEX IF NOT EXISTS idx_doc_tat_warehouse
            ON document_tat_summary(warehouse_name);

        CREATE INDEX IF NOT EXISTS idx_doc_tat_site
            ON document_tat_summary(site_code);

        CREATE INDEX IF NOT EXISTS idx_doc_tat_doc_no
            ON document_tat_summary(document_no);

        CREATE INDEX IF NOT EXISTS idx_doc_tat_date_warehouse
            ON document_tat_summary(entry_date DESC, warehouse_name);

        CREATE INDEX IF NOT EXISTS idx_doc_tat_datetime
            ON document_tat_summary(gate_entry_datetime DESC);
        """

        try:
            self.cursor.execute(create_table_sql)
            self.conn.commit()
            logger.info("document_tat_summary table created/verified")
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error creating document_tat_summary table: {e}")
            raise

    def create_vehicle_loading_time_table(self):
        """Create vehicle_loading_time_summary table with indexes"""
        create_table_sql = """
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

        CREATE INDEX IF NOT EXISTS idx_veh_loading_entry_date
            ON vehicle_loading_time_summary(entry_date DESC);

        CREATE INDEX IF NOT EXISTS idx_veh_loading_vehicle
            ON vehicle_loading_time_summary(vehicle_no);

        CREATE INDEX IF NOT EXISTS idx_veh_loading_warehouse
            ON vehicle_loading_time_summary(warehouse_name);

        CREATE INDEX IF NOT EXISTS idx_veh_loading_still_inside
            ON vehicle_loading_time_summary(is_still_inside)
            WHERE is_still_inside = TRUE;

        CREATE INDEX IF NOT EXISTS idx_veh_loading_date_warehouse
            ON vehicle_loading_time_summary(entry_date DESC, warehouse_name);

        CREATE INDEX IF NOT EXISTS idx_veh_loading_datetime
            ON vehicle_loading_time_summary(entry_datetime DESC);
        """

        try:
            self.cursor.execute(create_table_sql)
            self.conn.commit()
            logger.info("vehicle_loading_time_summary table created/verified")
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error creating vehicle_loading_time_summary table: {e}")
            raise

    def build_document_tat_summary(self, days_back=7, full_rebuild=False):
        """Build/update document TAT summary table"""
        if full_rebuild:
            date_filter = "date >= '2025-09-11'"
            logger.info("Running FULL REBUILD of document_tat_summary")
        else:
            cutoff_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
            date_filter = f"date >= '{cutoff_date}'"
            logger.info(f"Running INCREMENTAL update from {cutoff_date}")

        upsert_sql = f"""
        INSERT INTO document_tat_summary (
            gate_entry_no,
            gate_entry_datetime,
            document_no,
            document_type,
            document_entry_datetime,
            vehicle_no,
            driver_name,
            warehouse_name,
            site_code,
            tat_minutes,
            tat_formatted,
            entry_date,
            updated_at
        )
        SELECT
            gate_entry_no,
            (date + time) as gate_entry_datetime,
            document_no,
            document_type,
            document_date as document_entry_datetime,
            vehicle_no,
            driver_name,
            warehouse_name,
            site_code,
            EXTRACT(EPOCH FROM ((date + time) - document_date))/60 as tat_minutes,
            CASE
                WHEN EXTRACT(EPOCH FROM ((date + time) - document_date))/3600 >= 1 THEN
                    CONCAT(
                        FLOOR(EXTRACT(EPOCH FROM ((date + time) - document_date))/3600), 'h ',
                        FLOOR((EXTRACT(EPOCH FROM ((date + time) - document_date)) % 3600)/60), 'm'
                    )
                ELSE
                    CONCAT(
                        FLOOR(EXTRACT(EPOCH FROM ((date + time) - document_date))/60), 'm'
                    )
            END as tat_formatted,
            DATE(date) as entry_date,
            NOW() as updated_at
        FROM {TABLES['insights']}
        WHERE {date_filter}
            AND document_date IS NOT NULL
            AND date IS NOT NULL
            AND time IS NOT NULL
            AND gate_entry_no IS NOT NULL
        ON CONFLICT (gate_entry_no, document_no)
        DO UPDATE SET
            gate_entry_datetime = EXCLUDED.gate_entry_datetime,
            document_type = EXCLUDED.document_type,
            document_entry_datetime = EXCLUDED.document_entry_datetime,
            vehicle_no = EXCLUDED.vehicle_no,
            driver_name = EXCLUDED.driver_name,
            warehouse_name = EXCLUDED.warehouse_name,
            site_code = EXCLUDED.site_code,
            tat_minutes = EXCLUDED.tat_minutes,
            tat_formatted = EXCLUDED.tat_formatted,
            entry_date = EXCLUDED.entry_date,
            updated_at = NOW();
        """

        try:
            self.cursor.execute(upsert_sql)
            rows_affected = self.cursor.rowcount
            self.conn.commit()
            logger.info(f"Document TAT summary updated: {rows_affected:,} rows")
            return rows_affected
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error building document TAT summary: {e}")
            raise

    def build_vehicle_loading_summary(self, days_back=7, full_rebuild=False):
        """Build/update vehicle loading time summary table"""
        if full_rebuild:
            date_filter = "vm1.movement_timestamp >= '2025-09-11'"
            logger.info("Running FULL REBUILD of vehicle_loading_time_summary")
        else:
            cutoff_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
            date_filter = f"vm1.movement_timestamp >= '{cutoff_date}'"
            logger.info(f"Running INCREMENTAL update from {cutoff_date}")

        upsert_sql = f"""
        INSERT INTO vehicle_loading_time_summary (
            warehouse_code,
            warehouse_name,
            vehicle_no,
            entry_gate_no,
            entry_datetime,
            exit_gate_no,
            exit_datetime,
            loading_time_minutes,
            loading_time_formatted,
            documents_in_entry,
            documents_in_exit,
            is_still_inside,
            entry_date,
            updated_at
        )
        WITH physical_movements AS (
           SELECT DISTINCT ON (gate_entry_no)
               gate_entry_no,
               vehicle_no,
               movement_type,
               warehouse_name,
               warehouse_code,
               (date + time) AS movement_timestamp
           FROM {TABLES['insights']}
           WHERE vehicle_no IS NOT NULL
             AND movement_type IN ('Gate-In', 'Gate-Out')
             AND date IS NOT NULL
             AND time IS NOT NULL
             AND warehouse_code IS NOT NULL
             AND gate_entry_no IS NOT NULL
           ORDER BY gate_entry_no, date, time
        ),
        sequenced_movements AS (
           SELECT
               gate_entry_no,
               vehicle_no,
               movement_type,
               warehouse_name,
               warehouse_code,
               movement_timestamp,
               ROW_NUMBER() OVER (
                   PARTITION BY vehicle_no, warehouse_code
                   ORDER BY movement_timestamp
               ) AS seq
           FROM physical_movements
        )
        SELECT
           vm1.warehouse_code,
           vm1.warehouse_name,
           vm1.vehicle_no,
           vm1.gate_entry_no AS entry_gate_no,
           vm1.movement_timestamp AS entry_datetime,
           vm2.gate_entry_no AS exit_gate_no,
           vm2.movement_timestamp AS exit_datetime,
           CASE
               WHEN vm2.movement_timestamp IS NOT NULL THEN
                   EXTRACT(EPOCH FROM (vm2.movement_timestamp - vm1.movement_timestamp))/60
               ELSE
                   EXTRACT(EPOCH FROM (NOW() - vm1.movement_timestamp))/60
           END AS loading_time_minutes,
           CASE
               WHEN vm2.movement_timestamp IS NOT NULL THEN
                   CONCAT(
                       FLOOR(EXTRACT(EPOCH FROM (vm2.movement_timestamp - vm1.movement_timestamp))/3600), 'h ',
                       FLOOR((EXTRACT(EPOCH FROM (vm2.movement_timestamp - vm1.movement_timestamp)) % 3600)/60), 'm ',
                       FLOOR(EXTRACT(EPOCH FROM (vm2.movement_timestamp - vm1.movement_timestamp)) % 60), 's'
                   )
               ELSE
                   CONCAT(
                       FLOOR(EXTRACT(EPOCH FROM (NOW() - vm1.movement_timestamp))/3600), 'h ',
                       FLOOR((EXTRACT(EPOCH FROM (NOW() - vm1.movement_timestamp)) % 3600)/60), 'm ',
                       FLOOR(EXTRACT(EPOCH FROM (NOW() - vm1.movement_timestamp)) % 60), 's'
                   )
           END AS loading_time_formatted,
           (SELECT COUNT(*)
            FROM {TABLES['insights']}
            WHERE gate_entry_no = vm1.gate_entry_no) AS documents_in_entry,
           CASE
               WHEN vm2.gate_entry_no IS NOT NULL THEN
                   (SELECT COUNT(*)
                    FROM {TABLES['insights']}
                    WHERE gate_entry_no = vm2.gate_entry_no)
               ELSE 0
           END AS documents_in_exit,
           CASE WHEN vm2.movement_timestamp IS NULL THEN TRUE ELSE FALSE END AS is_still_inside,
           DATE(vm1.movement_timestamp) AS entry_date,
           NOW() AS updated_at
        FROM sequenced_movements vm1
        LEFT JOIN sequenced_movements vm2
           ON vm1.vehicle_no = vm2.vehicle_no
           AND vm1.warehouse_code = vm2.warehouse_code
           AND vm2.seq = vm1.seq + 1
           AND vm1.movement_type = 'Gate-In'
           AND vm2.movement_type = 'Gate-Out'
        WHERE vm1.movement_type = 'Gate-In'
            AND {date_filter}
        ON CONFLICT (entry_gate_no)
        DO UPDATE SET
            warehouse_code = EXCLUDED.warehouse_code,
            warehouse_name = EXCLUDED.warehouse_name,
            vehicle_no = EXCLUDED.vehicle_no,
            entry_datetime = EXCLUDED.entry_datetime,
            exit_gate_no = EXCLUDED.exit_gate_no,
            exit_datetime = EXCLUDED.exit_datetime,
            loading_time_minutes = EXCLUDED.loading_time_minutes,
            loading_time_formatted = EXCLUDED.loading_time_formatted,
            documents_in_entry = EXCLUDED.documents_in_entry,
            documents_in_exit = EXCLUDED.documents_in_exit,
            is_still_inside = EXCLUDED.is_still_inside,
            entry_date = EXCLUDED.entry_date,
            updated_at = NOW();
        """

        try:
            self.cursor.execute(upsert_sql)
            rows_affected = self.cursor.rowcount
            self.conn.commit()
            logger.info(f"Vehicle loading summary updated: {rows_affected:,} rows")
            return rows_affected
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error building vehicle loading summary: {e}")
            raise

    def get_table_stats(self):
        """Get statistics about summary tables"""
        stats_sql = """
        SELECT
            'document_tat_summary' as table_name,
            COUNT(*) as total_records,
            MIN(entry_date) as earliest_date,
            MAX(entry_date) as latest_date,
            MAX(updated_at) as last_updated
        FROM document_tat_summary
        UNION ALL
        SELECT
            'vehicle_loading_time_summary' as table_name,
            COUNT(*) as total_records,
            MIN(entry_date) as earliest_date,
            MAX(entry_date) as latest_date,
            MAX(updated_at) as last_updated
        FROM vehicle_loading_time_summary;
        """

        try:
            self.cursor.execute(stats_sql)
            results = self.cursor.fetchall()
            for row in results:
                logger.info(f"{row[0]}: {row[1]:,} records, {row[2]} to {row[3]}, last updated {row[4]}")
            return results
        except Exception as e:
            logger.error(f"Error fetching table stats: {e}")
            return None

    def vacuum_analyze(self):
        """Run VACUUM ANALYZE on summary tables to optimize performance"""
        try:
            self.conn.commit()
            old_isolation_level = self.conn.isolation_level
            self.conn.set_isolation_level(0)  # autocommit mode for VACUUM

            self.cursor.execute("VACUUM ANALYZE document_tat_summary;")
            self.cursor.execute("VACUUM ANALYZE vehicle_loading_time_summary;")
            logger.info("VACUUM ANALYZE completed for TAT summary tables")

            self.conn.set_isolation_level(old_isolation_level)
        except Exception as e:
            logger.error(f"Error running VACUUM ANALYZE: {e}")
            self.conn.rollback()

    def run_full_rebuild(self):
        """Run complete rebuild of all summary tables"""
        logger.info("STARTING FULL REBUILD OF TAT SUMMARY TABLES")

        try:
            self.create_document_tat_table()
            self.create_vehicle_loading_time_table()

            doc_rows = self.build_document_tat_summary(full_rebuild=True)
            veh_rows = self.build_vehicle_loading_summary(full_rebuild=True)

            self.vacuum_analyze()
            self.get_table_stats()

            logger.info(f"FULL REBUILD COMPLETED — document TAT: {doc_rows:,} rows, vehicle loading: {veh_rows:,} rows")

            return True
        except Exception as e:
            logger.error(f"FULL REBUILD FAILED: {e}")
            return False

    def run_incremental_update(self, days_back=1):
        """Run incremental update of summary tables (default: last 1 day)"""
        logger.info(f"STARTING INCREMENTAL UPDATE (Last {days_back} days)")

        try:
            self.create_document_tat_table()
            self.create_vehicle_loading_time_table()

            doc_rows = self.build_document_tat_summary(days_back=days_back, full_rebuild=False)
            veh_rows = self.build_vehicle_loading_summary(days_back=days_back, full_rebuild=False)

            self.get_table_stats()

            logger.info(f"INCREMENTAL UPDATE COMPLETED — document TAT: {doc_rows:,} rows, vehicle loading: {veh_rows:,} rows")

            return True
        except Exception as e:
            logger.error(f"INCREMENTAL UPDATE FAILED: {e}")
            return False
