import pandas as pd
import os
import logging
from datetime import datetime, timezone
from sqlalchemy import text, Table, MetaData
from sqlalchemy.dialects.postgresql import insert
from app.database import engine, SessionLocal
from app.config import settings
from app.models import DocumentData

logger = logging.getLogger(__name__)

class DBService:
    def __init__(self):
        self.metadata = MetaData(bind=engine)

    def get_document_data_count(self):
        """Get current count of documents"""
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM document_data"))
            return result.scalar()
    
    def get_mfabric_counts(self):
        """Get counts from mfabric tables"""
        with engine.connect() as conn:
            challan_count = conn.execute(text("SELECT COUNT(*) FROM mfabric_deliverychallan_data")).scalar()
            invoice_count = conn.execute(text("SELECT COUNT(*) FROM mfabric_invoice_data")).scalar()
            transfer_count = conn.execute(text("SELECT COUNT(*) FROM mfabric_transferorder_rgp_data")).scalar()
            
            return {
                "mfabric_challan": challan_count,
                "mfabric_invoice": invoice_count,
                "mfabric_transfer": transfer_count,
                "total_mfabric": challan_count + invoice_count + transfer_count
            }

def get_db_service():
    return DBService()