# app/dashboard/etl/data_sync.py
#
# Ported 1:1 from Load_management/Data_Sync.py.
# Source DB (Bisleri_01) -> Historical DB (Bisleri_dashboard), READ-ONLY
# against the source, for mfabric_deliverychallan_data, mfabric_invoice_data,
# mfabric_transferorder_rgp_data, insights_data.
import logging

import psycopg2
from psycopg2.extras import execute_values

from .connections import SOURCE_DB, HISTORICAL_DB
from .constants import TABLE_CONFIGS

logger = logging.getLogger(__name__)


class DataSync:
    """Handles data synchronization between source and historical databases"""

    def __init__(self):
        self.source_conn = None
        self.target_conn = None
        self.source_cursor = None
        self.target_cursor = None
        self.stats = {
            'total_processed': 0,
            'total_inserted': 0,
            'total_updated': 0
        }

    def connect(self):
        """Establish connections to both databases"""
        try:
            # SOURCE DATABASE: READ-ONLY CONNECTION (PRODUCTION SAFETY)
            self.source_conn = psycopg2.connect(**SOURCE_DB)
            self.source_conn.set_session(readonly=True, autocommit=True)
            self.source_cursor = self.source_conn.cursor()

            logger.info("Source DB connected (READ-ONLY mode)")

            # TARGET DATABASE: READ-WRITE CONNECTION
            self.target_conn = psycopg2.connect(**HISTORICAL_DB)
            self.target_cursor = self.target_conn.cursor()

            logger.info("Target DB connected (READ-WRITE mode)")

        except Exception as e:
            logger.error(f"Connection failed: {e}")
            raise

    def disconnect(self):
        """Close database connections"""
        if self.source_cursor:
            self.source_cursor.close()
        if self.source_conn:
            self.source_conn.close()
        if self.target_cursor:
            self.target_cursor.close()
        if self.target_conn:
            self.target_conn.close()

        logger.info("Database connections closed")

    def get_last_sync_time(self, table_name: str, timestamp_column: str):
        """Get last successful sync time for incremental sync"""
        try:
            time_column = 'updated_at' if 'insights' in table_name else 'synced_at'

            self.target_cursor.execute(f"""
                SELECT MAX({time_column}) as last_sync
                FROM {table_name}
            """)

            result = self.target_cursor.fetchone()
            return result[0] if result and result[0] else None
        except Exception as e:
            logger.warning(f"Could not get last sync time for {table_name}: {e}")
            return None

    def fetch_source_data(self, config: dict, last_sync_time=None):
        """Fetch data from source table (READ-ONLY) - Complete copy for insights_data"""
        try:
            columns = ', '.join(config['columns'])
            table_name = config['source_table']

            # SPECIAL: insights_data gets FULL COPY always (it's the master log)
            if 'insights_data' in table_name:
                query = f"SELECT {columns} FROM {table_name} ORDER BY id"
                self.source_cursor.execute(query)
                logger.info("FULL sync of insights_data (master log)")

            # For other tables: Incremental sync is fine
            else:
                unique_keys = ', '.join(config['unique_keys'])
                query = f"SELECT DISTINCT ON ({unique_keys}) {columns} FROM {table_name}"

                if last_sync_time and config.get('timestamp_column'):
                    timestamp_col = config['timestamp_column']
                    query += f" WHERE {timestamp_col} >= %s ORDER BY {unique_keys}"
                    self.source_cursor.execute(query, (last_sync_time,))
                    logger.info(f"Incremental sync from {last_sync_time}")
                else:
                    query += f" ORDER BY {unique_keys}"
                    self.source_cursor.execute(query)
                    logger.info("Full sync (no previous timestamp)")

            records = self.source_cursor.fetchall()
            logger.info(f"Fetched {len(records)} records")
            return records

        except Exception as e:
            logger.error(f"Error fetching source data: {e}")
            raise

    def upsert_to_historical(self, config: dict, records: list):
        """Perform UPSERT to historical database ONLY"""
        if not records:
            logger.info("No records to sync")
            return 0, 0

        try:
            columns = config['columns']
            target_table = config['target_table']
            unique_keys = config['unique_keys']
            has_source_id = config.get('has_source_id', False)

            if has_source_id:
                col_mapping = []
                for col in columns:
                    if col == 'id':
                        col_mapping.append('source_id')
                    else:
                        col_mapping.append(col)

                col_list = ', '.join(col_mapping)
                conflict_cols = 'source_id'
                update_cols = ', '.join([f"{col} = EXCLUDED.{col}"
                                        for col in col_mapping if col != 'source_id'])
            else:
                col_list = ', '.join(columns)
                conflict_cols = ', '.join(unique_keys)
                update_cols = ', '.join([f"{col} = EXCLUDED.{col}"
                                        for col in columns if col not in unique_keys])

            # WRITE ONLY TO TARGET (HISTORICAL) DATABASE
            upsert_query = f"""
                INSERT INTO {target_table} ({col_list})
                VALUES %s
                ON CONFLICT ({conflict_cols})
                DO UPDATE SET
                    {update_cols},
                    updated_at = NOW()
                RETURNING (xmax = 0) AS inserted
            """

            results = execute_values(
                self.target_cursor,
                upsert_query,
                records,
                page_size=1000,
                fetch=True
            )

            inserted = sum(1 for r in results if r[0])
            updated = len(results) - inserted

            self.target_conn.commit()

            logger.info(f"Inserted: {inserted}, Updated: {updated} (in TARGET DB only)")
            return inserted, updated

        except Exception as e:
            self.target_conn.rollback()
            logger.error(f"Error upserting to {config['target_table']}: {e}")
            raise

    def sync_table(self, config: dict):
        """Sync a single table"""
        table_name = config['source_table']

        try:
            logger.info(f"Syncing: {table_name} (READ-ONLY from source)")

            last_sync = self.get_last_sync_time(
                config['target_table'],
                config.get('timestamp_column')
            )

            # ONLY SELECT FROM SOURCE (with deduplication)
            records = self.fetch_source_data(config, last_sync)

            # ONLY WRITE TO TARGET
            inserted, updated = self.upsert_to_historical(config, records)

            processed = len(records)
            self.stats['total_processed'] += processed
            self.stats['total_inserted'] += inserted
            self.stats['total_updated'] += updated

            logger.info(f"{table_name}: {processed} records ({inserted} new, {updated} updated)")

        except Exception as e:
            logger.error(f"Sync failed for {table_name}: {e}")
            raise

    def run(self):
        """Main sync execution"""
        try:
            logger.info("DATA SYNC STARTED — source DB read-only, target historical DB read-write")

            self.connect()

            for config in TABLE_CONFIGS:
                self.sync_table(config)

            logger.info(
                f"Sync summary — processed: {self.stats['total_processed']}, "
                f"inserted: {self.stats['total_inserted']}, updated: {self.stats['total_updated']}. "
                "Source DB UNMODIFIED (read-only)."
            )

        except Exception as e:
            logger.error(f"Sync process failed: {e}")
            raise
        finally:
            self.disconnect()
