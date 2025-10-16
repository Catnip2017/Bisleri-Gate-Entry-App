import logging
import os
from datetime import datetime
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables if needed
load_dotenv()
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
# Setup logging
log_file = "upload_log.txt"
if os.path.exists(log_file):
    os.remove(log_file)

logging.basicConfig(
    filename=log_file,
    filemode='w',
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    encoding='utf-8'
)

# Also log to console
console = logging.StreamHandler()
console.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
console.setFormatter(formatter)
logging.getLogger('').addHandler(console)

# Connect to PostgreSQL
engine = create_engine(
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    connect_args={'options': '-c timezone=UTC'}
)

# Explicitly set UTC timezone
with engine.begin() as conn:
    conn.execute(text("SET TIME ZONE 'UTC';"))

def check_source_tables():
    """Check if source tables exist and have data"""
    tables_to_check = [
        'mfabric_deliverychallan_data',
        'mfabric_invoice_data', 
        'mfabric_transferorder_rgp_data'
    ]
    
    logging.info("=" * 60)
    logging.info("CHECKING SOURCE TABLES")
    logging.info("=" * 60)
    
    table_counts = {}
    
    try:
        with engine.begin() as conn:
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
                    logging.info(f"✓ {table}: {row_count} rows")
                    
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
                            logging.info(f"  → {dups} duplicate document_no records found (will be aggregated)")
                        else:
                            logging.info(f"  → No duplicates found")
                else:
                    table_counts[table] = 0
                    logging.error(f"✗ {table}: TABLE DOES NOT EXIST!")
        
        return table_counts
        
    except Exception as e:
        logging.error(f"Error checking source tables: {str(e)}")
        return {}

def check_target_table_before():
    """Check document_data table before insertion"""
    logging.info("=" * 60)
    logging.info("CHECKING TARGET TABLE BEFORE INSERTION")
    logging.info("=" * 60)
    
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
                logging.info(f"✓ document_data table exists with {current_count} rows")
                
                # Check distinct document types
                type_result = conn.execute(text("""
                    SELECT document_type, COUNT(*) 
                    FROM document_data 
                    GROUP BY document_type
                    ORDER BY document_type
                """))
                
                logging.info("Current document types in target table:")
                for doc_type, count in type_result.fetchall():
                    logging.info(f"  {doc_type}: {count} records")
                
                return current_count
            else:
                logging.error("✗ document_data table does not exist!")
                return 0
                
    except Exception as e:
        logging.error(f"Error checking target table: {str(e)}")
        return 0

def push_to_document_data():
    try:
        # Check source tables first
        source_counts = check_source_tables()
        
        # Check target table before
        initial_count = check_target_table_before()
        
        logging.info("=" * 60)
        logging.info("STARTING AGGREGATED DATA INSERTION WITH UPDATES")
        logging.info("=" * 60)
        logging.info("Processing Rules:")
        logging.info("  - Filter: Exclude rows with itemid = 'PPJRTWMRT'")
        logging.info("  - Deduplicate: Keep only one row per document_no and linenum")
        logging.info("  - Aggregate: SUM total_quantity for remaining records")
        logging.info("  - Transporter: Use first non-NULL transporter_name")
        logging.info("  - Clean: Convert spaces to NULL")
        logging.info("  - Data Type: Cast total_quantity to INTEGER")
        logging.info("  - Conflicts: UPDATE existing records (ON CONFLICT DO UPDATE)")
        logging.info("=" * 60)
        
        insertion_results = {}
        
        # Process DeliveryChallan
        logging.info("Processing DeliveryChallan data...")
        if source_counts.get('mfabric_deliverychallan_data', 0) > 0:
            try:
                with engine.begin() as conn:
                    result = conn.execute(text("""
                        WITH filtered_dc AS (
                            SELECT DISTINCT ON (document_no, linenum)
                                document_no, linenum, site, document_type, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                route_no, customer_code, customer_name, total_quantity
                            FROM mfabric_deliverychallan_data
                            WHERE itemid != 'PPJRTWMRT' OR itemid IS NULL
                            ORDER BY document_no, linenum
                        ),
                        aggregated_dc AS (
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
                                MAX(customer_name) as customer_name,
                                SUM(COALESCE(total_quantity, 0)) as total_quantity
                            FROM filtered_dc
                            GROUP BY document_no, site, document_type
                        )
                        INSERT INTO document_data (
                            site, document_type, document_no, document_date,
                            e_way_bill_no, transporter_name, vehicle_no, irn_no,
                            route_no, customer_code, customer_name, total_quantity
                        )
                        SELECT 
                            site, document_type, document_no, document_date,
                            e_way_bill_no, transporter_name, vehicle_no, irn_no,
                            route_no, customer_code, customer_name, total_quantity::text
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
                            customer_name = EXCLUDED.customer_name,
                            total_quantity = EXCLUDED.total_quantity
                        RETURNING document_no, 
                            CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END as action;
                    """))
                    
                    results = result.fetchall()
                    inserts = sum(1 for r in results if r[1] == 'INSERT')
                    updates = sum(1 for r in results if r[1] == 'UPDATE')
                    insertion_results['DeliveryChallan'] = {'inserts': inserts, 'updates': updates}
                    
                    logging.info(f"✓ DeliveryChallan: {inserts} inserted, {updates} updated")
                    
                    if len(results) > 0:
                        logging.info(f"  Sample documents: {[r[0] for r in results[:3]]}")
                
            except Exception as e:
                logging.error(f"✗ DeliveryChallan processing failed: {str(e)}")
                insertion_results['DeliveryChallan'] = {'inserts': 0, 'updates': 0}
        else:
            logging.warning("⚠ Skipping DeliveryChallan - no source data")
            insertion_results['DeliveryChallan'] = {'inserts': 0, 'updates': 0}

        # Process Invoice
        logging.info("Processing Invoice data...")
        if source_counts.get('mfabric_invoice_data', 0) > 0:
            try:
                with engine.begin() as conn:
                    result = conn.execute(text("""
                        WITH filtered_inv AS (
                            SELECT DISTINCT ON (document_no, linenum)
                                document_no, linenum, site, document_type, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                customer_code, customer_name, total_quantity
                            FROM mfabric_invoice_data
                            WHERE itemid != 'PPJRTWMRT' OR itemid IS NULL
                            ORDER BY document_no, linenum
                        ),
                        aggregated_inv AS (
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
                            FROM filtered_inv
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
                    
                    logging.info(f"✓ Invoice: {inserts} inserted, {updates} updated")
                    
                    if len(results) > 0:
                        logging.info(f"  Sample documents: {[r[0] for r in results[:3]]}")
                
            except Exception as e:
                logging.error(f"✗ Invoice processing failed: {str(e)}")
                insertion_results['Invoice'] = {'inserts': 0, 'updates': 0}
        else:
            logging.warning("⚠ Skipping Invoice - no source data")
            insertion_results['Invoice'] = {'inserts': 0, 'updates': 0}

        # Process Transfer
        logging.info("Processing Transfer data...")
        if source_counts.get('mfabric_transferorder_rgp_data', 0) > 0:
            try:
                with engine.begin() as conn:
                    result = conn.execute(text("""
                        WITH filtered_to AS (
                            SELECT DISTINCT ON (document_no, linenum)
                                document_no, linenum, site, document_type, document_date,
                                e_way_bill_no, transporter_name, vehicle_no, irn_no,
                                from_warehouse_code, to_warehouse_code, route_code,
                                direct_dispatch, sub_document_type, salesman, total_quantity
                            FROM mfabric_transferorder_rgp_data
                            WHERE itemid != 'PPJRTWMRT' OR itemid IS NULL
                            ORDER BY document_no, linenum
                        ),
                        aggregated_to AS (
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
                            FROM filtered_to
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
                    
                    logging.info(f"✓ Transfer: {inserts} inserted, {updates} updated")
                    
                    if len(results) > 0:
                        logging.info(f"  Sample documents: {[r[0] for r in results[:3]]}")
                
            except Exception as e:
                logging.error(f"✗ Transfer processing failed: {str(e)}")
                insertion_results['Transfer'] = {'inserts': 0, 'updates': 0}
        else:
            logging.warning("⚠ Skipping Transfer - no source data")
            insertion_results['Transfer'] = {'inserts': 0, 'updates': 0}

        # Final results check
        logging.info("=" * 60)
        logging.info("FINAL RESULTS")
        logging.info("=" * 60)
        
        try:
            with engine.begin() as conn:
                # Get final count
                final_count_result = conn.execute(text("SELECT COUNT(*) FROM document_data"))
                final_count = final_count_result.fetchone()[0]
                
                total_inserts = sum(r['inserts'] for r in insertion_results.values())
                total_updates = sum(r['updates'] for r in insertion_results.values())
                
                logging.info(f"Initial record count: {initial_count}")
                logging.info(f"Records inserted this cycle: {total_inserts}")
                logging.info(f"Records updated this cycle: {total_updates}")
                logging.info(f"Final record count: {final_count}")
                
                # Show breakdown by document type
                type_result = conn.execute(text("""
                    SELECT document_type, COUNT(*) 
                    FROM document_data 
                    GROUP BY document_type
                    ORDER BY document_type
                """))
                
                logging.info("Final document types breakdown:")
                for doc_type, count in type_result.fetchall():
                    logging.info(f"  {doc_type}: {count} records")
                
                # Show sample aggregated quantities to verify aggregation worked
                logging.info("Sample total_quantity values (to verify aggregation):")
                sample_result = conn.execute(text("""
                    SELECT document_no, total_quantity, document_type 
                    FROM document_data 
                    WHERE total_quantity IS NOT NULL
                    ORDER BY document_no DESC 
                    LIMIT 5
                """))
                
                for doc_no, qty, doc_type in sample_result.fetchall():
                    logging.info(f"  {doc_no} ({doc_type}): {qty}")
                
                # Show processing summary
                logging.info("Processing Summary:")
                for doc_type, stats in insertion_results.items():
                    logging.info(f"  {doc_type}: {stats['inserts']} inserts, {stats['updates']} updates")
                
        except Exception as e:
            logging.error(f"Error in final results check: {str(e)}")

        logging.info("Successfully completed aggregated data push with updates to document_data.")
        print(f"Data processing complete: {total_inserts} inserts, {total_updates} updates")
        
    except Exception as e:
        logging.error(f"Error during data processing: {str(e)}")
        print(f"Data processing failed: {str(e)}")

# Run the migration
if __name__ == "__main__":
    push_to_document_data()