# app/dashboard/etl/mfabric.py
#
# Ported 1:1 from Load_management/ETL_mfabric.py.
# Historical mfabric_*_data_historical tables -> dashboard_data (unified
# document table), on the historical (Bisleri_dashboard) DB only.
import logging

import psycopg2

from .connections import HISTORICAL_DB

logger = logging.getLogger(__name__)


class DashboardETL:
    """ETL from historical tables to dashboard_data"""

    def __init__(self):
        self.conn = None
        self.cursor = None
        self.stats = {
            'challan': {'processed': 0, 'inserted': 0, 'updated': 0},
            'invoice': {'processed': 0, 'inserted': 0, 'updated': 0},
            'transfer': {'processed': 0, 'inserted': 0, 'updated': 0}
        }

    def connect(self):
        """Connect to historical database"""
        try:
            self.conn = psycopg2.connect(**HISTORICAL_DB)
            self.cursor = self.conn.cursor()
            logger.info("Connected to historical database")
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            raise

    def disconnect(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        logger.info("Connection closed")

    def process_challan(self):
        """Process delivery challan data with deduplication"""
        try:
            logger.info("Processing delivery challan...")

            self.cursor.execute("""
                WITH deduplicated_source AS (
                    SELECT DISTINCT ON (document_no, linenum)
                        document_type,
                        document_no,
                        transporter_name,
                        vehicle_no,
                        total_quantity,
                        site,
                        itemid,
                        linenum,
                        customer_code
                    FROM mfabric_deliverychallan_data_historical
                    ORDER BY document_no, linenum, synced_at DESC
                )
                INSERT INTO dashboard_data (
                    document_type, document_no, transporter_name, vehicle_no,
                    total_quantity, site, itemid, linenum, customer_code,
                    from_warehouse_code, to_warehouse_code
                )
                SELECT
                    document_type, document_no, transporter_name, vehicle_no,
                    total_quantity, site, itemid, linenum, customer_code,
                    NULL, NULL
                FROM deduplicated_source
                ON CONFLICT (document_no, linenum)
                DO UPDATE SET
                    document_type = EXCLUDED.document_type,
                    transporter_name = EXCLUDED.transporter_name,
                    vehicle_no = EXCLUDED.vehicle_no,
                    total_quantity = EXCLUDED.total_quantity,
                    site = EXCLUDED.site,
                    itemid = EXCLUDED.itemid,
                    customer_code = EXCLUDED.customer_code,
                    updated_at = NOW()
                RETURNING document_no,
                    CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END as action
            """)

            results = self.cursor.fetchall()
            self.stats['challan']['processed'] = len(results)
            self.stats['challan']['inserted'] = sum(1 for r in results if r[1] == 'INSERT')
            self.stats['challan']['updated'] = sum(1 for r in results if r[1] == 'UPDATE')

            self.conn.commit()
            logger.info(f"Challan: {self.stats['challan']['inserted']} inserted, "
                       f"{self.stats['challan']['updated']} updated")

        except Exception as e:
            self.conn.rollback()
            logger.error(f"Challan processing failed: {e}")
            raise

    def process_invoice(self):
        """Process invoice data with deduplication"""
        try:
            logger.info("Processing invoice...")

            self.cursor.execute("""
                WITH deduplicated_source AS (
                    SELECT DISTINCT ON (document_no, linenum)
                        document_type,
                        document_no,
                        transporter_name,
                        vehicle_no,
                        total_quantity,
                        site,
                        itemid,
                        linenum,
                        customer_code
                    FROM mfabric_invoice_data_historical
                    ORDER BY document_no, linenum, synced_at DESC
                )
                INSERT INTO dashboard_data (
                    document_type, document_no, transporter_name, vehicle_no,
                    total_quantity, site, itemid, linenum, customer_code,
                    from_warehouse_code, to_warehouse_code
                )
                SELECT
                    document_type, document_no, transporter_name, vehicle_no,
                    total_quantity, site, itemid, linenum, customer_code,
                    NULL, NULL
                FROM deduplicated_source
                ON CONFLICT (document_no, linenum)
                DO UPDATE SET
                    document_type = EXCLUDED.document_type,
                    transporter_name = EXCLUDED.transporter_name,
                    vehicle_no = EXCLUDED.vehicle_no,
                    total_quantity = EXCLUDED.total_quantity,
                    site = EXCLUDED.site,
                    itemid = EXCLUDED.itemid,
                    customer_code = EXCLUDED.customer_code,
                    updated_at = NOW()
                RETURNING document_no,
                    CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END as action
            """)

            results = self.cursor.fetchall()
            self.stats['invoice']['processed'] = len(results)
            self.stats['invoice']['inserted'] = sum(1 for r in results if r[1] == 'INSERT')
            self.stats['invoice']['updated'] = sum(1 for r in results if r[1] == 'UPDATE')

            self.conn.commit()
            logger.info(f"Invoice: {self.stats['invoice']['inserted']} inserted, "
                       f"{self.stats['invoice']['updated']} updated")

        except Exception as e:
            self.conn.rollback()
            logger.error(f"Invoice processing failed: {e}")
            raise

    def process_transfer(self):
        """Process transfer order data with deduplication"""
        try:
            logger.info("Processing transfer...")

            self.cursor.execute("""
                WITH deduplicated_source AS (
                    SELECT DISTINCT ON (document_no, linenum)
                        document_type,
                        document_no,
                        transporter_name,
                        vehicle_no,
                        total_quantity,
                        site,
                        itemid,
                        linenum,
                        from_warehouse_code,
                        to_warehouse_code
                    FROM mfabric_transferorder_rgp_data_historical
                    ORDER BY document_no, linenum, synced_at DESC
                )
                INSERT INTO dashboard_data (
                    document_type, document_no, transporter_name, vehicle_no,
                    total_quantity, site, itemid, linenum, customer_code,
                    from_warehouse_code, to_warehouse_code
                )
                SELECT
                    document_type, document_no, transporter_name, vehicle_no,
                    total_quantity, site, itemid, linenum, NULL,
                    from_warehouse_code, to_warehouse_code
                FROM deduplicated_source
                ON CONFLICT (document_no, linenum)
                DO UPDATE SET
                    document_type = EXCLUDED.document_type,
                    transporter_name = EXCLUDED.transporter_name,
                    vehicle_no = EXCLUDED.vehicle_no,
                    total_quantity = EXCLUDED.total_quantity,
                    site = EXCLUDED.site,
                    itemid = EXCLUDED.itemid,
                    from_warehouse_code = EXCLUDED.from_warehouse_code,
                    to_warehouse_code = EXCLUDED.to_warehouse_code,
                    updated_at = NOW()
                RETURNING document_no,
                    CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END as action
            """)

            results = self.cursor.fetchall()
            self.stats['transfer']['processed'] = len(results)
            self.stats['transfer']['inserted'] = sum(1 for r in results if r[1] == 'INSERT')
            self.stats['transfer']['updated'] = sum(1 for r in results if r[1] == 'UPDATE')

            self.conn.commit()
            logger.info(f"Transfer: {self.stats['transfer']['inserted']} inserted, "
                       f"{self.stats['transfer']['updated']} updated")

        except Exception as e:
            self.conn.rollback()
            logger.error(f"Transfer processing failed: {e}")
            raise

    def run(self):
        """Main ETL execution"""
        try:
            logger.info("DASHBOARD ETL (mfabric -> dashboard_data) STARTED")

            self.connect()

            self.process_challan()
            self.process_invoice()
            self.process_transfer()

            total_processed = sum(s['processed'] for s in self.stats.values())
            total_inserted = sum(s['inserted'] for s in self.stats.values())
            total_updated = sum(s['updated'] for s in self.stats.values())

            logger.info(
                f"ETL summary — processed: {total_processed}, inserted: {total_inserted}, "
                f"updated: {total_updated}"
            )

        except Exception as e:
            logger.error(f"ETL process failed: {e}")
            raise
        finally:
            self.disconnect()
