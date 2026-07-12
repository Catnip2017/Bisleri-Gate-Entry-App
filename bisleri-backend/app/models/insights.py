# app/models/insights.py - pure data model (business logic in app/services/edit_service.py)
from sqlalchemy import Column, Integer, String, DateTime, Text, Time, Index
from app.database import Base

class InsightsData(Base):
    __tablename__ = "insights_data"
    # Q9: matches insights_rm_indexes_migration.sql (run on the real DB).
    # Composite serves the hot query: WHERE warehouse_code ORDER BY date DESC.
    __table_args__ = (
        Index("ix_insights_warehouse_date", "warehouse_code", "date"),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    gate_entry_no = Column(String(50))
    document_type = Column(String(50))
    sub_document_type = Column(String(50))
    document_no = Column(String(100))
    vehicle_no = Column(String(50))
    warehouse_name = Column(String(100))
    date = Column(DateTime, index=True)
    time = Column(Time)
    movement_type = Column(String(20), index=True)
    remarks = Column(Text)
    warehouse_code = Column(String(50), index=True)
    site_code = Column(String(50))
    security_name = Column(String(255))
    security_username = Column(String(255))
    document_date = Column(DateTime)
    
    # ✅ NEW: Operational fields for the 3-color edit system
    driver_name = Column(String(100))           # Required for completion
    km_reading = Column(String(10))             # Required for completion (KM IN/OUT)
    loader_count = Column(Integer)        # NEW COLUMN
    loader_names = Column(String(200))          # Required for completion (comma-separated)
    last_edited_at = Column(DateTime)           # Track edit timestamps
    edit_count = Column(Integer, default=0)     # Track number of edits
    
    def __repr__(self):
        return f"<InsightsData(gate_entry_no='{self.gate_entry_no}', vehicle_no='{self.vehicle_no}')>"

    # NOTE (Q14): edit-window / 3-colour business logic moved to
    # app/services/edit_service.py — this model is a pure data class now.
