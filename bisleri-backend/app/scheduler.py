import logging
import os
from datetime import datetime
from sqlalchemy import text
from app.database import engine
from app.config import settings

logger = logging.getLogger(__name__)

class DataSyncService:
    def __init__(self):
        self.log_file = "sync_log.txt"
    
    def log_message(self, message: str):
        """Log messages to both file and console"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        
        # Write to file
        with open(self.log_file, "a") as f:
            f.write(log_entry + "\n")
        
        # Also log using logger
        logger.info(message)
        print(log_entry)
    
    def check_source_tables(self):
        """Check if source tables exist and have data"""
        tables_to_check = [
            'mfabric_deliverychallan_data',
            'mfabric_invoice_data', 
            'mfabric_transferorder_rgp_data'
        ]
        
        self.log_message("=" * 60)
        self.log_message("CHECKING SOURCE TABLES")
        self.log_message("=" * 60)
        
        table_counts = {}
        
        try:
            with engine.begin() as conn:
                # Set UTC timezone
                conn.execute(text("SET TIME ZONE 'UTC';"))
                
                for table in tables_to_check:
                    # Check if table exists
                    result = conn.execute(text(f"""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_name = '{table}'
                        );
                    """))
                    table_exists = result.fetchone()[0]
                    
                    if table_exists:
                        # Get row count
                        count_result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                        row_count = count_result.fetchone()[0]
                        table_counts[table] = row_count
                        self.log_message(f"✓ {table}: {row_count} rows")
                        
                        # Check for duplicates
                        if row_count > 0:
                            dup_result = conn.execute(text(f"""
                                SELECT COUNT(*) as total_records,
                                       COUNT(DISTINCT document_no) as unique_documents,
                                       COUNT(*) - COUNT(DISTINCT document_no) as duplicates
                                FROM {table}
                            """))
                            total, unique, dups = dup_result.fetchone()
                            if dups > 0:
                                self.log_message(f"  → {dups} duplicate document_no records found (will be aggregated)")
                            else:
                                self.log_message(f"  → No duplicates found")
                    else:
                        table_counts[table] = 0
                        self.log_message(f"✗ {table}: TABLE DOES NOT EXIST!")
            
            return table_counts
            
        except Exception as e:
            self.log_message(f"Error checking source tables: {str(e)}")
            return {}

    def check_target_table_before(self):
        """Check document_data table before insertion"""
        self.log_message("=" * 60)
        self.log_message("CHECKING TARGET TABLE BEFORE INSERTION")
        self.log_message("=" * 60)
        
        try:
            with engine.begin() as conn:
                # Check if target table exists
                result = conn.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'document_data'
                    );
                """))
                table_exists = result.fetchone()[0]
                
                if table_exists:
                    # Get current row count
                    count_result = conn.execute(text("SELECT COUNT(*) FROM document_data"))
                    current_count = count_result.fetchone()[0]
                    self.log_message(f"✓ document_data table exists with {current_count} rows")
                    
                    # Check distinct document types
                    type_result = conn.execute(text("""
                        SELECT document_type, COUNT(*) 
                        FROM document_data 
                        GROUP BY document_type
                        ORDER BY document_type
                    """))
                    
                    self.log_message("Current document types in target table:")
                    for doc_type, count in type_result.fetchall():
                        self.log_message(f"  {doc_type}: {count} records")
                    
                    return current_count
                else:
                    self.log_message("✗ document_data table does not exist!")
                    return 0
                    
        except Exception as e:
            self.log_message(f"Error checking target table: {str(e)}")
            return 0

    def clear_log_file(self):
        """Clear the log file to start fresh for each sync cycle"""
        try:
            if os.path.exists(self.log_file):
                os.remove(self.log_file)
        except Exception as e:
            print(f"Warning: Could not clear log file: {str(e)}")
    
    def push_to_document_data(self) -> bool:
        """Enhanced push data from mfabric tables to document_data with aggregation and updates"""
        try:
            # Clear log file at the start of each sync cycle
            self.clear_log_file()
            
            # Log sync start
            self.log_message("🚀 STARTING NEW DATA SYNC CYCLE")
            self.log_message(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
            self.log_message("=" * 60)
            # Check source tables first
            source_counts = self.check_source_tables()
            
            # Check target table before
            initial_count = self.check_target_table_before()
            
            self.log_message("=" * 60)
            self.log_message("STARTING AGGREGATED DATA INSERTION WITH UPDATES")
            self.log_message("=" * 60)
            self.log_message("Processing Rules:")
            self.log_message("  - Aggregate: SUM total_quantity for duplicate document_no")
            self.log_message("  - Transporter: Use first non-NULL transporter_name")
            self.log_message("  - Clean: Convert spaces to NULL")
            self.log_message("  - Data Type: Cast total_quantity to INTEGER")
            self.log_message("  - Conflicts: UPDATE existing records (ON CONFLICT DO UPDATE)")
            self.log_message("=" * 60)
            
            insertion_results = {}
            
            with engine.begin() as conn:
                # Set UTC timezone
                conn.execute(text("SET TIME ZONE 'UTC';"))
                
                # Process DeliveryChallan
                self.log_message("Processing DeliveryChallan data...")
                if source_counts.get('mfabric_deliverychallan_data', 0) > 0:
                    try:
                        result = conn.execute(text("""
                            WITH aggregated_dc AS (
                                SELECT 
                                    document_no,
                                    site, 
                                    document_type, 
                                    MAX(document_date) as document_date,
                                    NULLIF(TRIM(MAX(e_way_bill_no)), '') as e_way_bill_no,
                                    COALESCE(
                                        NULLIF(TRIM(MAX(CASE WHEN transporter_name IS NOT NULL THEN transporter_name END)), ''),
                                        NULL
                                    ) as transporter_name,
                                    NULLIF(TRIM(MAX(vehicle_no)), '') as vehicle_no,
                                    NULLIF(TRIM(MAX(irn_no)), '') as irn_no,
                                    NULLIF(TRIM(MAX(route_no)), '') as route_no,
                                    MAX(customer_code) as customer_code,
                                    SUM(COALESCE(total_quantity, 0)) as total_quantity
                                FROM mfabric_deliverychallan_data
                                GROUP BY document_no, site, document_type
                            )
                            INSERT INTO document_data (
                                site, document_type, document_no, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                route_no, customer_code, total_quantity
                            )
                            SELECT 
                                site, document_type, document_no, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                route_no, customer_code, total_quantity::text
                            FROM aggregated_dc
                            ON CONFLICT (document_no) DO UPDATE SET
                                site = EXCLUDED.site,
                                document_type = EXCLUDED.document_type,
                                document_date = EXCLUDED.document_date,
                                e_way_bill_no = EXCLUDED.e_way_bill_no,
                                transporter_name = EXCLUDED.transporter_name,
                                vehicle_no = EXCLUDED.vehicle_no,
                                irn_no = EXCLUDED.irn_no,
                                route_no = EXCLUDED.route_no,
                                customer_code = EXCLUDED.customer_code,
                                total_quantity = EXCLUDED.total_quantity
                            RETURNING document_no, 
                                CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END as action;
                        """))
                        
                        results = result.fetchall()
                        inserts = sum(1 for r in results if r[1] == 'INSERT')
                        updates = sum(1 for r in results if r[1] == 'UPDATE')
                        insertion_results['DeliveryChallan'] = {'inserts': inserts, 'updates': updates}
                        
                        self.log_message(f"✓ DeliveryChallan: {inserts} inserted, {updates} updated")
                        
                        if len(results) > 0:
                            self.log_message(f"  Sample documents: {[r[0] for r in results[:3]]}")
                    
                    except Exception as e:
                        self.log_message(f"✗ DeliveryChallan processing failed: {str(e)}")
                        insertion_results['DeliveryChallan'] = {'inserts': 0, 'updates': 0}
                else:
                    self.log_message("⚠ Skipping DeliveryChallan - no source data")
                    insertion_results['DeliveryChallan'] = {'inserts': 0, 'updates': 0}

                # Process Invoice
                self.log_message("Processing Invoice data...")
                if source_counts.get('mfabric_invoice_data', 0) > 0:
                    try:
                        result = conn.execute(text("""
                            WITH aggregated_inv AS (
                                SELECT 
                                    document_no,
                                    site, 
                                    document_type, 
                                    MAX(document_date) as document_date,
                                    MAX(e_way_bill_no) as e_way_bill_no,
                                    COALESCE(
                                        NULLIF(TRIM(MAX(CASE WHEN transporter_name IS NOT NULL THEN transporter_name END)), ''),
                                        NULL
                                    ) as transporter_name,
                                    NULLIF(TRIM(MAX(vehicle_no)), '') as vehicle_no,
                                    NULLIF(TRIM(MAX(irn_no)), '') as irn_no,
                                    MAX(customer_code) as customer_code,
                                    MAX(customer_name) as customer_name,
                                    SUM(COALESCE(total_quantity, 0)) as total_quantity
                                FROM mfabric_invoice_data
                                GROUP BY document_no, site, document_type
                            )
                            INSERT INTO document_data (
                                site, document_type, document_no, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                customer_code, customer_name, total_quantity
                            )
                            SELECT 
                                site, document_type, document_no, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                customer_code, customer_name, total_quantity::text
                            FROM aggregated_inv
                            ON CONFLICT (document_no) DO UPDATE SET
                                site = EXCLUDED.site,
                                document_type = EXCLUDED.document_type,
                                document_date = EXCLUDED.document_date,
                                e_way_bill_no = EXCLUDED.e_way_bill_no,
                                transporter_name = EXCLUDED.transporter_name,
                                vehicle_no = EXCLUDED.vehicle_no,
                                irn_no = EXCLUDED.irn_no,
                                customer_code = EXCLUDED.customer_code,
                                customer_name = EXCLUDED.customer_name,
                                total_quantity = EXCLUDED.total_quantity
                            RETURNING document_no, 
                                CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END as action;
                        """))
                        
                        results = result.fetchall()
                        inserts = sum(1 for r in results if r[1] == 'INSERT')
                        updates = sum(1 for r in results if r[1] == 'UPDATE')
                        insertion_results['Invoice'] = {'inserts': inserts, 'updates': updates}
                        
                        self.log_message(f"✓ Invoice: {inserts} inserted, {updates} updated")
                        
                        if len(results) > 0:
                            self.log_message(f"  Sample documents: {[r[0] for r in results[:3]]}")
                    
                    except Exception as e:
                        self.log_message(f"✗ Invoice processing failed: {str(e)}")
                        insertion_results['Invoice'] = {'inserts': 0, 'updates': 0}
                else:
                    self.log_message("⚠ Skipping Invoice - no source data")
                    insertion_results['Invoice'] = {'inserts': 0, 'updates': 0}

                # Process Transfer
                self.log_message("Processing Transfer data...")
                if source_counts.get('mfabric_transferorder_rgp_data', 0) > 0:
                    try:
                        result = conn.execute(text("""
                            WITH aggregated_to AS (
                                SELECT 
                                    document_no,
                                    site, 
                                    document_type, 
                                    MAX(document_date) as document_date,
                                    NULLIF(TRIM(MAX(e_way_bill_no)), '') as e_way_bill_no,
                                    COALESCE(
                                        NULLIF(TRIM(MAX(CASE WHEN transporter_name IS NOT NULL THEN transporter_name END)), ''),
                                        NULL
                                    ) as transporter_name,
                                    NULLIF(TRIM(MAX(vehicle_no)), '') as vehicle_no,
                                    NULLIF(TRIM(MAX(irn_no)), '') as irn_no,
                                    MAX(from_warehouse_code) as from_warehouse_code,
                                    MAX(to_warehouse_code) as to_warehouse_code,
                                    MAX(route_code) as route_code,
                                    MAX(direct_dispatch) as direct_dispatch,
                                    MAX(sub_document_type) as sub_document_type,
                                    MAX(salesman) as salesman,
                                    SUM(COALESCE(total_quantity, 0)) as total_quantity
                                FROM mfabric_transferorder_rgp_data
                                GROUP BY document_no, site, document_type
                            )
                            INSERT INTO document_data (
                                site, document_type, document_no, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                from_warehouse_code, to_warehouse_code, route_code,
                                direct_dispatch, sub_document_type, salesman, total_quantity
                            )
                            SELECT 
                                site, document_type, document_no, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                from_warehouse_code, to_warehouse_code, route_code,
                                direct_dispatch, sub_document_type, salesman, total_quantity::text
                            FROM aggregated_to
                            ON CONFLICT (document_no) DO UPDATE SET
                                site = EXCLUDED.site,
                                document_type = EXCLUDED.document_type,
                                document_date = EXCLUDED.document_date,
                                e_way_bill_no = EXCLUDED.e_way_bill_no,
                                transporter_name = EXCLUDED.transporter_name,
                                vehicle_no = EXCLUDED.vehicle_no,
                                irn_no = EXCLUDED.irn_no,
                                from_warehouse_code = EXCLUDED.from_warehouse_code,
                                to_warehouse_code = EXCLUDED.to_warehouse_code,
                                route_code = EXCLUDED.route_code,
                                direct_dispatch = EXCLUDED.direct_dispatch,
                                sub_document_type = EXCLUDED.sub_document_type,
                                salesman = EXCLUDED.salesman,
                                total_quantity = EXCLUDED.total_quantity
                            RETURNING document_no, 
                                CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END as action;
                        """))
                        
                        results = result.fetchall()
                        inserts = sum(1 for r in results if r[1] == 'INSERT')
                        updates = sum(1 for r in results if r[1] == 'UPDATE')
                        insertion_results['Transfer'] = {'inserts': inserts, 'updates': updates}
                        
                        self.log_message(f"✓ Transfer: {inserts} inserted, {updates} updated")
                        
                        if len(results) > 0:
                            self.log_message(f"  Sample documents: {[r[0] for r in results[:3]]}")
                    
                    except Exception as e:
                        self.log_message(f"✗ Transfer processing failed: {str(e)}")
                        insertion_results['Transfer'] = {'inserts': 0, 'updates': 0}
                else:
                    self.log_message("⚠ Skipping Transfer - no source data")
                    insertion_results['Transfer'] = {'inserts': 0, 'updates': 0}

            # Final results check
            self.log_message("=" * 60)
            self.log_message("FINAL RESULTS")
            self.log_message("=" * 60)
            
            try:
                with engine.begin() as conn:
                    # Get final count
                    final_count_result = conn.execute(text("SELECT COUNT(*) FROM document_data"))
                    final_count = final_count_result.fetchone()[0]
                    
                    total_inserts = sum(r['inserts'] for r in insertion_results.values())
                    total_updates = sum(r['updates'] for r in insertion_results.values())
                    
                    self.log_message(f"Initial record count: {initial_count}")
                    self.log_message(f"Records inserted this cycle: {total_inserts}")
                    self.log_message(f"Records updated this cycle: {total_updates}")
                    self.log_message(f"Final record count: {final_count}")
                    
                    # Show breakdown by document type
                    type_result = conn.execute(text("""
                        SELECT document_type, COUNT(*) 
                        FROM document_data 
                        GROUP BY document_type
                        ORDER BY document_type
                    """))
                    
                    self.log_message("Final document types breakdown:")
                    for doc_type, count in type_result.fetchall():
                        self.log_message(f"  {doc_type}: {count} records")
                    
                    # Show sample aggregated quantities to verify aggregation worked
                    self.log_message("Sample total_quantity values (to verify aggregation):")
                    sample_result = conn.execute(text("""
                        SELECT document_no, total_quantity, document_type 
                        FROM document_data 
                        WHERE total_quantity IS NOT NULL
                        ORDER BY document_no DESC 
                        LIMIT 5
                    """))
                    
                    for doc_no, qty, doc_type in sample_result.fetchall():
                        self.log_message(f"  {doc_no} ({doc_type}): {qty}")
                    
                    # Show processing summary
                    self.log_message("Processing Summary:")
                    for doc_type, stats in insertion_results.items():
                        self.log_message(f"  {doc_type}: {stats['inserts']} inserts, {stats['updates']} updates")
                    
            except Exception as e:
                self.log_message(f"Error in final results check: {str(e)}")

            self.log_message("Successfully completed aggregated data push with updates to document_data.")
            self.log_message(f"🏁 SYNC CYCLE COMPLETED at {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
            self.log_message("=" * 60)
            return True
            
        except Exception as e:
            self.log_message(f"❌ CRITICAL ERROR: {str(e)}")
            self.log_message(f"🔥 SYNC CYCLE FAILED at {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
            self.log_message("=" * 60)
            return False
    
    def get_sync_status(self):
        """Get current sync status and counts"""
        try:
            with engine.connect() as conn:
                # Get counts from mfabric tables
                mfabric_challan_count = conn.execute(text("SELECT COUNT(*) FROM mfabric_deliverychallan_data")).scalar()
                mfabric_invoice_count = conn.execute(text("SELECT COUNT(*) FROM mfabric_invoice_data")).scalar()
                mfabric_transfer_count = conn.execute(text("SELECT COUNT(*) FROM mfabric_transferorder_rgp_data")).scalar()
                document_data_count = conn.execute(text("SELECT COUNT(*) FROM document_data")).scalar()
                
                return {
                    "mfabric_challan_count": mfabric_challan_count,
                    "mfabric_invoice_count": mfabric_invoice_count,
                    "mfabric_transfer_count": mfabric_transfer_count,
                    "document_data_count": document_data_count,
                    "total_mfabric_records": mfabric_challan_count + mfabric_invoice_count + mfabric_transfer_count
                }
        except Exception as e:
            self.log_message(f"Error getting sync status: {str(e)}")
            return None

# Singleton instance
scheduler = DataSyncService()
