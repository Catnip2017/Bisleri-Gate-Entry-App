import logging
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
    
    def push_to_document_data(self) -> bool:
        """Push data directly from mfabric tables to document_data table"""
        try:
            with engine.begin() as conn:
                # Set UTC timezone
                conn.execute(text("SET TIME ZONE 'UTC';"))
                
                # Insert from mfabric_deliverychallan_data
                result1 = conn.execute(text("""
                    INSERT INTO document_data (
                        site, document_type, document_no, document_date,
                        e_way_bill_no, transporter_name, vehicle_no, irn_no,
                        from_warehouse_code, warehouse_name, route_code, route_no,
                        customer_code, customer_name, direct_dispatch, total_quantity,
                        to_warehouse_code, sub_document_type, salesman
                    )
                    SELECT 
                        site, document_type, document_no, document_date,
                        e_way_bill_no, transporter_name, vehicle_no, irn_no,
                        NULL AS from_warehouse_code, NULL AS warehouse_name,
                        NULL AS route_code, route_no,
                        customer_code, NULL AS customer_name,
                        NULL AS direct_dispatch, total_quantity::varchar,
                        NULL AS to_warehouse_code, NULL AS sub_document_type,
                        NULL AS salesman
                    FROM mfabric_deliverychallan_data
                    ON CONFLICT (document_no) DO NOTHING;
                """))
                
                # Insert from mfabric_invoice_data
                result2 = conn.execute(text("""
                    INSERT INTO document_data (
                        site, document_type, document_no, document_date,
                        e_way_bill_no, transporter_name, vehicle_no, irn_no,
                        from_warehouse_code, warehouse_name, route_code, route_no,
                        customer_code, customer_name, direct_dispatch, total_quantity,
                        to_warehouse_code, sub_document_type, salesman
                    )
                    SELECT 
                        site, document_type, document_no, document_date,
                        e_way_bill_no, transporter_name, vehicle_no, irn_no,
                        NULL AS from_warehouse_code, NULL AS warehouse_name,
                        NULL AS route_code, NULL AS route_no,
                        customer_code, customer_name,
                        NULL AS direct_dispatch, total_quantity::varchar,
                        NULL AS to_warehouse_code, NULL AS sub_document_type,
                        NULL AS salesman
                    FROM mfabric_invoice_data
                    ON CONFLICT (document_no) DO NOTHING;
                """))
                
                # Insert from mfabric_transferorder_rgp_data
                result3 = conn.execute(text("""
                    INSERT INTO document_data (
                        site, document_type, document_no, document_date,
                        e_way_bill_no, transporter_name, vehicle_no, irn_no,
                        from_warehouse_code, warehouse_name, route_code, route_no,
                        customer_code, customer_name, direct_dispatch, total_quantity,
                        to_warehouse_code, sub_document_type, salesman
                    )
                    SELECT 
                        site, document_type, document_no, document_date,
                        e_way_bill_no, transporter_name, vehicle_no, irn_no,
                        from_warehouse_code, NULL AS warehouse_name,
                        route_code, NULL AS route_no,
                        NULL AS customer_code, NULL AS customer_name,
                        direct_dispatch, total_quantity::varchar,
                        to_warehouse_code, sub_document_type, salesman
                    FROM mfabric_transferorder_rgp_data
                    ON CONFLICT (document_no) DO NOTHING;
                """))
                
                # Get row counts
                total_rows = result1.rowcount + result2.rowcount + result3.rowcount
                
            self.log_message(f"Successfully pushed {total_rows} new records from mfabric tables to document_data")
            return True
            
        except Exception as e:
            self.log_message(f"Error while pushing to document_data: {str(e)}")
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
data_sync_service = DataSyncService()