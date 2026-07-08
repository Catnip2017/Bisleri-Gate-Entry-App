# app/dashboard/etl/loader_details.py
#
# Ported 1:1 from Load_management/ETL_loader_details.py.
# insights_data_historical -> loader_details_summary, on the historical
# (Bisleri_dashboard) DB only.
import logging
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor

from .connections import HISTORICAL_DB
from .constants import TABLES

logger = logging.getLogger(__name__)


class LoaderSummaryETL:
    """ETL to populate loader_details_summary table"""

    def __init__(self):
        self.conn = None
        self.cursor = None
        self.stats = {
            'processed': 0,
            'inserted': 0,
            'updated': 0
        }

    def connect(self):
        """Connect to database"""
        try:
            self.conn = psycopg2.connect(**HISTORICAL_DB)
            self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            logger.info("Connected to database")
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

    def get_last_refresh_timestamp(self):
        """Get last refresh timestamp from loader_details_summary table itself"""
        try:
            self.cursor.execute(f"""
                SELECT MAX(updated_at) as last_refresh
                FROM {TABLES['loader_details_summary']}
            """)
            result = self.cursor.fetchone()

            if result and result['last_refresh']:
                logger.info(f"Last refresh: {result['last_refresh']}")
                return result['last_refresh']
            else:
                logger.info("No previous refresh found - will process all records")
                return None

        except Exception as e:
            logger.warning(f"Could not get last refresh timestamp: {e}")
            return None

    def populate_summary(self, last_refresh=None):
        """Populate loader_details_summary table - incremental or full"""
        try:
            insights_where = ""
            params = []

            if last_refresh:
                logger.info("Running INCREMENTAL refresh...")
                insights_where = "WHERE i.last_edited_at > %s OR i.synced_at > %s"
                params = [last_refresh, last_refresh]
            else:
                logger.info("Running FULL refresh...")

            query = f"""
                WITH latest_per_gate AS (
                    SELECT DISTINCT ON (gate_entry_no)
                        gate_entry_no,
                        date,
                        time,
                        vehicle_no,
                        warehouse_code,
                        warehouse_name,
                        site_code,
                        movement_type,
                        security_name,
                        driver_name,
                        loader_names,
                        last_edited_at
                    FROM {TABLES['insights']} i
                    {insights_where}
                    ORDER BY gate_entry_no, last_edited_at DESC NULLS LAST, source_id DESC
                ),
                document_types_agg AS (
                    SELECT
                        gate_entry_no,
                        STRING_AGG(DISTINCT document_type, ', ' ORDER BY document_type) as document_types
                    FROM {TABLES['insights']} i
                    WHERE document_type IS NOT NULL
                    {("AND (i.last_edited_at > %s OR i.synced_at > %s)" if last_refresh else "")}
                    GROUP BY gate_entry_no
                ),
                vehicle_dedup AS (
                    SELECT DISTINCT ON (registration_no)
                        registration_no,
                        vehicle_classification
                    FROM {TABLES['vehicle_master']}
                    ORDER BY registration_no
                ),
                combined_data AS (
                    SELECT DISTINCT ON (lpg.gate_entry_no)
                        lpg.gate_entry_no,
                        DATE_TRUNC('minute', lpg.date + lpg.time) as gate_entry_datetime,
                        DATE(lpg.date) as entry_date,
                        lpg.vehicle_no,
                        CASE
                            WHEN vm.vehicle_classification = 'Company Owned' THEN 'Company Owned'
                            ELSE 'Hired'
                        END as vehicle_type,
                        lpg.warehouse_code,
                        lpg.warehouse_name,
                        lpg.site_code,
                        lpg.movement_type,
                        dta.document_types,
                        lpg.security_name,
                        lpg.driver_name,
                        lpg.loader_names,
                        CASE
                            WHEN lpg.loader_names IS NULL OR TRIM(lpg.loader_names) = '' THEN 0
                            WHEN UPPER(TRIM(lpg.loader_names)) = 'NA' THEN 0
                            ELSE 1 + LENGTH(lpg.loader_names) - LENGTH(
                                REGEXP_REPLACE(lpg.loader_names, '[,;.]', '', 'g')
                            )
                        END as loader_count
                    FROM latest_per_gate lpg
                    LEFT JOIN document_types_agg dta
                        ON lpg.gate_entry_no = dta.gate_entry_no
                    LEFT JOIN vehicle_dedup vm
                        ON UPPER(TRIM(lpg.vehicle_no)) = UPPER(TRIM(vm.registration_no))
                    ORDER BY lpg.gate_entry_no
                )
                INSERT INTO {TABLES['loader_details_summary']} (
                    gate_entry_no,
                    gate_entry_datetime,
                    entry_date,
                    vehicle_no,
                    vehicle_type,
                    warehouse_code,
                    warehouse_name,
                    site_code,
                    movement_type,
                    document_types,
                    security_name,
                    driver_name,
                    loader_names,
                    loader_count,
                    updated_at
                )
                SELECT
                    gate_entry_no,
                    gate_entry_datetime,
                    entry_date,
                    vehicle_no,
                    vehicle_type,
                    warehouse_code,
                    warehouse_name,
                    site_code,
                    movement_type,
                    document_types,
                    security_name,
                    driver_name,
                    loader_names,
                    loader_count,
                    NOW() as updated_at
                FROM combined_data
                ON CONFLICT (gate_entry_no)
                DO UPDATE SET
                    gate_entry_datetime = EXCLUDED.gate_entry_datetime,
                    entry_date = EXCLUDED.entry_date,
                    vehicle_no = EXCLUDED.vehicle_no,
                    vehicle_type = EXCLUDED.vehicle_type,
                    warehouse_code = EXCLUDED.warehouse_code,
                    warehouse_name = EXCLUDED.warehouse_name,
                    site_code = EXCLUDED.site_code,
                    movement_type = EXCLUDED.movement_type,
                    document_types = EXCLUDED.document_types,
                    security_name = EXCLUDED.security_name,
                    driver_name = EXCLUDED.driver_name,
                    loader_names = EXCLUDED.loader_names,
                    loader_count = EXCLUDED.loader_count,
                    updated_at = NOW()
                RETURNING (xmax = 0) AS inserted
            """

            if last_refresh:
                # Params needed twice — once for latest_per_gate, once for document_types_agg
                self.cursor.execute(query, params + params)
            else:
                self.cursor.execute(query)

            results = self.cursor.fetchall()
            for row in results:
                if row['inserted']:
                    self.stats['inserted'] += 1
                else:
                    self.stats['updated'] += 1

            self.stats['processed'] = self.stats['inserted'] + self.stats['updated']

            self.conn.commit()

            logger.info(f"Processed: {self.stats['processed']} (Inserted: {self.stats['inserted']}, Updated: {self.stats['updated']})")

        except Exception as e:
            logger.error(f"Error populating summary: {e}")
            self.conn.rollback()
            raise

    def run(self, full_load=False):
        """Main ETL execution"""
        try:
            logger.info("LOADER DETAILS SUMMARY ETL STARTED")

            self.connect()

            last_refresh = None if full_load else self.get_last_refresh_timestamp()

            self.populate_summary(last_refresh)

            logger.info(
                f"ETL summary — processed: {self.stats['processed']}, "
                f"inserted: {self.stats['inserted']}, updated: {self.stats['updated']}"
            )

        except Exception as e:
            logger.error(f"ETL failed: {e}")
            raise
        finally:
            self.disconnect()
