# app/dashboard/etl/lms.py
#
# Ported 1:1 from Load_management/ETL_LMS.py.
# dashboard_data + vehicle_master + item_master -> vehicle_load_summary,
# on the historical (Bisleri_dashboard) DB only.
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor

from .connections import HISTORICAL_DB
from .constants import TABLES, EXCLUDED_DOCUMENT_TYPES

logger = logging.getLogger(__name__)


class VehicleLoadPipeline:
    """Pipeline to calculate vehicle loads and create summary table"""

    def __init__(self):
        self.conn = None
        self.cursor = None
        self.stats = {
            'processed': 0,
            'updated': 0,
            'inserted': 0,
            'skipped': 0,
            'errors': 0,
            'empty_vehicles_excluded': 0,
            'missing_documents': []
        }

    def connect(self):
        """Establish database connection"""
        try:
            self.conn = psycopg2.connect(**HISTORICAL_DB)
            self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            logger.info("Connected to Historical Database")
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

    def create_tables(self):
        """Create vehicle_load_summary table if it doesn't exist"""
        try:
            logger.info("Verifying vehicle_master table...")
            try:
                self.cursor.execute(f"""
                    SELECT COUNT(*) as count
                    FROM {TABLES['vehicle_master']}
                """)
                vm_count = self.cursor.fetchone()['count']
                logger.info(f"vehicle_master accessible: {vm_count} vehicles")
            except Exception as e:
                logger.error(f"Cannot access vehicle_master table: {e}")
                raise Exception(f"vehicle_master table not accessible: {e}")

            # Create vehicle_load_summary table
            self.cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {TABLES['consolidated']} (
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

                CREATE INDEX IF NOT EXISTS idx_vls_vehicle ON {TABLES['consolidated']}(vehicle_no);
                CREATE INDEX IF NOT EXISTS idx_vls_gate ON {TABLES['consolidated']}(gate_entry_no);
                CREATE INDEX IF NOT EXISTS idx_vls_date ON {TABLES['consolidated']}(date DESC);
                CREATE INDEX IF NOT EXISTS idx_vls_warehouse ON {TABLES['consolidated']}(warehouse_name);
            """)

            # Create pipeline log table
            self.cursor.execute("""
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
            """)

            self.conn.commit()
            logger.info("Tables verified/created")

        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error creating tables: {e}")
            raise

    def get_last_refresh_date(self, full_load: bool = False) -> Optional[datetime]:
        """Get last successful refresh date"""
        if full_load:
            logger.info("Full load mode: processing all records")
            return None

        try:
            self.cursor.execute("""
                SELECT refresh_date
                FROM pipeline_refresh_log
                WHERE status = 'completed'
                ORDER BY refresh_date DESC
                LIMIT 1
            """)
            result = self.cursor.fetchone()

            if result:
                last_refresh = result['refresh_date']
                logger.info(f"Last successful refresh: {last_refresh}")
                return last_refresh
            else:
                logger.info("No previous refresh found - initial load")
                return None

        except Exception as e:
            logger.error(f"Error getting last refresh date: {e}")
            return None

    def log_refresh_start(self) -> int:
        """Log the start of a refresh cycle"""
        try:
            self.cursor.execute("""
                INSERT INTO pipeline_refresh_log (refresh_date, status)
                VALUES (NOW(), 'running')
                RETURNING id
            """)
            log_id = self.cursor.fetchone()['id']
            self.conn.commit()
            return log_id
        except Exception as e:
            logger.error(f"Error logging refresh start: {e}")
            self.conn.rollback()
            raise

    def log_refresh_complete(self, log_id: int, status: str = 'completed', error_msg: str = None):
        """Log the completion of a refresh cycle"""
        try:
            self.cursor.execute("""
                SELECT EXTRACT(EPOCH FROM (NOW() - refresh_date))::INTEGER as duration
                FROM pipeline_refresh_log
                WHERE id = %s
            """, (log_id,))
            result = self.cursor.fetchone()
            duration = result['duration'] if result else None

            self.cursor.execute("""
                UPDATE pipeline_refresh_log
                SET status = %s,
                    records_processed = %s,
                    records_inserted = %s,
                    records_updated = %s,
                    records_skipped = %s,
                    empty_vehicles_excluded = %s,
                    error_message = %s,
                    completed_at = NOW(),
                    duration_seconds = %s
                WHERE id = %s
            """, (
                status,
                self.stats['processed'],
                self.stats['inserted'],
                self.stats['updated'],
                self.stats['skipped'],
                self.stats['empty_vehicles_excluded'],
                error_msg,
                duration,
                log_id
            ))
            self.conn.commit()
        except Exception as e:
            logger.error(f"Error logging completion: {e}")
            self.conn.rollback()

    def get_insights_data(self, last_refresh_date: Optional[datetime] = None) -> List[Dict]:
        """Fetch gate entries from insights_data_historical"""
        try:
            excluded_types_lower = tuple([dt.lower() for dt in EXCLUDED_DOCUMENT_TYPES])

            if last_refresh_date:
                query = f"""
                    SELECT DISTINCT
                        gate_entry_no, vehicle_no, date, time,
                        warehouse_code, warehouse_name, site_code,
                        movement_type, security_name, driver_name,
                        km_reading, last_edited_at
                    FROM {TABLES['insights']}
                    WHERE (date > %s OR last_edited_at > %s)
                    AND LOWER(TRIM(document_type)) NOT IN %s
                    ORDER BY date DESC
                """
                self.cursor.execute(query, (last_refresh_date, last_refresh_date, excluded_types_lower))
            else:
                query = f"""
                    SELECT DISTINCT
                        gate_entry_no, vehicle_no, date, time,
                        warehouse_code, warehouse_name, site_code,
                        movement_type, security_name, driver_name,
                        km_reading, last_edited_at
                    FROM {TABLES['insights']}
                    WHERE LOWER(TRIM(document_type)) NOT IN %s
                    ORDER BY date DESC
                """
                self.cursor.execute(query, (excluded_types_lower,))

            results = self.cursor.fetchall()

            # Count excluded
            if last_refresh_date:
                self.cursor.execute(f"""
                    SELECT COUNT(DISTINCT gate_entry_no) as excluded_count
                    FROM {TABLES['insights']}
                    WHERE (date > %s OR last_edited_at > %s)
                    AND (
                    LOWER(TRIM(COALESCE(document_type, ''))) IN %s

                )
                """, (last_refresh_date, last_refresh_date, excluded_types_lower))
            else:
                self.cursor.execute(f"""
                    SELECT COUNT(DISTINCT gate_entry_no) as excluded_count
                    FROM {TABLES['insights']}
                    WHERE (
                    LOWER(TRIM(COALESCE(document_type, ''))) IN %s
                )
                """, (excluded_types_lower,))

            excluded_result = self.cursor.fetchone()
            self.stats['empty_vehicles_excluded'] = excluded_result['excluded_count'] if excluded_result else 0

            logger.info(f"Excluded {self.stats['empty_vehicles_excluded']} empty vehicle entries")

            return results

        except Exception as e:
            logger.error(f"Error fetching insights data: {e}")
            raise

    def validate_vehicle(self, vehicle_no: str) -> Optional[Dict]:
        """Get vehicle maximum load with transaction safety - NO DEFAULTS"""
        for attempt in range(3):
            try:
                self.cursor.execute(f"""
                    SELECT registration_no, maximum_load
                    FROM {TABLES['vehicle_master']}
                    WHERE registration_no = %s
                """, (vehicle_no,))
                result = self.cursor.fetchone()

                return result  # Return None if not found

            except Exception as e:
                logger.error(f"Error validating vehicle {vehicle_no} (attempt {attempt+1}): {e}")

                try:
                    self.conn.rollback()
                    self.cursor.close()
                    self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
                except Exception:
                    pass

                if attempt == 2:
                    try:
                        self.disconnect()
                        self.connect()
                        logger.info("Reconnected to database after error")
                    except Exception:
                        pass

                    return None

        return None

    def get_documents_for_gate_entry(self, gate_entry_no: str) -> List[Dict]:
        """Get all documents for a gate entry"""
        try:
            excluded_types_lower = tuple([dt.lower() for dt in EXCLUDED_DOCUMENT_TYPES])

            self.cursor.execute(f"""
                SELECT document_type, document_no
                FROM {TABLES['insights']}
                WHERE gate_entry_no = %s
                AND LOWER(TRIM(document_type)) NOT IN %s
                AND document_no IS NOT NULL
            """, (gate_entry_no, excluded_types_lower))
            return self.cursor.fetchall()
        except Exception as e:
            logger.error(f"Error getting documents for {gate_entry_no}: {e}")
            return []

    def get_document_items_from_dashboard(self, document_no: str) -> List[Dict]:
        """Get items from dashboard_data (universal table)"""
        try:
            self.cursor.execute(f"""
                SELECT itemid, total_quantity, linenum
                FROM {TABLES['dashboard']}
                WHERE document_no = %s
                ORDER BY linenum
            """, (document_no,))

            items = self.cursor.fetchall()

            if not items:
                self.stats['missing_documents'].append({'document_no': document_no})
                logger.warning(f"Document not found in dashboard_data: {document_no}")

            return items

        except Exception as e:
            logger.error(f"Error getting items for {document_no}: {e}")
            return []

    def get_item_weight(self, item_id: str) -> Optional[float]:
        """Get item weight from item_master"""
        try:
            # NOTE: Column name is "Item_number" with capital I (not item_number)
            self.cursor.execute(f"""
                SELECT net_weight
                FROM {TABLES['item_master']}
                WHERE "Item_number" = %s
            """, (item_id,))
            result = self.cursor.fetchone()
            return float(result['net_weight']) if result and result['net_weight'] else None

        except Exception as e:
            logger.error(f"Error getting weight for {item_id}: {e}")
            self.conn.rollback()
            self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            return None

    def calculate_gate_entry_weight(self, gate_entry_no: str) -> Tuple[float, Dict]:
        """Calculate total weight and document counts"""
        total_weight = 0.0
        doc_counts = {'total': 0, 'invoice': 0, 'challan': 0, 'transfer': 0}

        documents = self.get_documents_for_gate_entry(gate_entry_no)

        for doc in documents:
            document_no = doc['document_no']
            document_type = doc['document_type']

            items = self.get_document_items_from_dashboard(document_no)

            if not items:
                continue

            for item in items:
                item_id = item['itemid']
                quantity = item['total_quantity']

                if not quantity:
                    continue

                net_weight = self.get_item_weight(item_id)

                if net_weight is None or net_weight == 0:
                    continue

                line_weight = quantity * net_weight
                total_weight += line_weight

            doc_counts['total'] += 1
            if document_type == 'Invoice':
                doc_counts['invoice'] += 1
            elif document_type == 'Delivery Challan':
                doc_counts['challan'] += 1
            elif document_type == 'Transfer Order':
                doc_counts['transfer'] += 1

        return total_weight, doc_counts

    def process_gate_entry(self, gate_entry: Dict) -> bool:
        """Process a single gate entry - ONLY if vehicle exists in master"""
        try:
            vehicle_no = gate_entry['vehicle_no']
            gate_entry_no = gate_entry['gate_entry_no']

            vehicle_info = self.validate_vehicle(vehicle_no)

            if not vehicle_info:
                self.stats['skipped'] += 1
                return False

            maximum_load = float(vehicle_info['maximum_load'])

            total_weight, doc_counts = self.calculate_gate_entry_weight(gate_entry_no)

            load_percentage = (total_weight / maximum_load * 100) if maximum_load > 0 else 0

            self.cursor.execute(f"""
                INSERT INTO {TABLES['consolidated']} (
                    vehicle_no, gate_entry_no, date, time, warehouse_code, warehouse_name,
                    site_code, total_weight_kg, maximum_load_kg, load_percentage,
                    document_count, invoice_count, challan_count, transfer_count,
                    movement_type, security_name, driver_name, km_reading,
                    source_last_edited, last_updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                )
                ON CONFLICT (vehicle_no, gate_entry_no)
                DO UPDATE SET
                    date = EXCLUDED.date,
                    time = EXCLUDED.time,
                    warehouse_code = EXCLUDED.warehouse_code,
                    warehouse_name = EXCLUDED.warehouse_name,
                    site_code = EXCLUDED.site_code,
                    total_weight_kg = EXCLUDED.total_weight_kg,
                    maximum_load_kg = EXCLUDED.maximum_load_kg,
                    load_percentage = EXCLUDED.load_percentage,
                    document_count = EXCLUDED.document_count,
                    invoice_count = EXCLUDED.invoice_count,
                    challan_count = EXCLUDED.challan_count,
                    transfer_count = EXCLUDED.transfer_count,
                    movement_type = EXCLUDED.movement_type,
                    security_name = EXCLUDED.security_name,
                    driver_name = EXCLUDED.driver_name,
                    km_reading = EXCLUDED.km_reading,
                    source_last_edited = EXCLUDED.source_last_edited,
                    last_updated_at = NOW()
                RETURNING (xmax = 0) AS inserted
            """, (
                vehicle_no, gate_entry_no, gate_entry['date'], gate_entry['time'],
                gate_entry.get('warehouse_code'), gate_entry.get('warehouse_name'),
                gate_entry.get('site_code'), round(total_weight, 3), round(maximum_load, 3),
                round(load_percentage, 2), doc_counts['total'], doc_counts['invoice'],
                doc_counts['challan'], doc_counts['transfer'], gate_entry.get('movement_type'),
                gate_entry.get('security_name'), gate_entry.get('driver_name'),
                gate_entry.get('km_reading'), gate_entry.get('last_edited_at')
            ))

            result = self.cursor.fetchone()
            if result['inserted']:
                self.stats['inserted'] += 1
            else:
                self.stats['updated'] += 1

            self.stats['processed'] += 1

            if self.stats['processed'] % 100 == 0:
                self.conn.commit()
                logger.info(f"Progress: {self.stats['processed']} records")

            return True

        except Exception as e:
            logger.error(f"Error processing {gate_entry.get('gate_entry_no')}: {e}")
            self.stats['errors'] += 1
            return False

    def run(self, full_load: bool = False):
        """Main pipeline execution"""
        log_id = None

        try:
            logger.info("VEHICLE LOAD PIPELINE STARTED")

            self.connect()
            self.create_tables()

            log_id = self.log_refresh_start()
            last_refresh_date = self.get_last_refresh_date(full_load)

            insights_data = self.get_insights_data(last_refresh_date)
            logger.info(f"Found {len(insights_data)} gate entries to process")

            if not insights_data:
                logger.info("No new data to process")
                self.log_refresh_complete(log_id, 'completed')
                return

            for gate_entry in insights_data:
                self.process_gate_entry(gate_entry)

            self.conn.commit()

            logger.info(
                f"Summary — processed: {self.stats['processed']}, inserted: {self.stats['inserted']}, "
                f"updated: {self.stats['updated']}, skipped: {self.stats['skipped']}, "
                f"errors: {self.stats['errors']}, empty vehicles excluded: "
                f"{self.stats['empty_vehicles_excluded']}"
            )

            if self.stats['missing_documents']:
                logger.warning(f"Missing documents: {len(self.stats['missing_documents'])}")

            self.log_refresh_complete(log_id, 'completed')

        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            if log_id:
                self.log_refresh_complete(log_id, 'failed', str(e))
            raise
        finally:
            self.disconnect()
