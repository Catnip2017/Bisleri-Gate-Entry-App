# app/models/raw_materials.py
from sqlalchemy import Column, Integer, String, DateTime, Index
from app.database import Base

class RawMaterialsData(Base):
    __tablename__ = "raw_materials_data"
    # Q9: matches insights_rm_indexes_migration.sql (run on the real DB).
    __table_args__ = (
        Index("ix_rm_warehouse_datetime", "warehouse_code", "date_time"),
    )
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    gate_entry_no = Column(String(50), nullable=False)
    gate_type = Column(String(20), nullable=False, index=True)  # Gate-In or Gate-Out
    vehicle_no = Column(String(50), nullable=False)
    document_no = Column(String(50), nullable=False)
    name_of_party = Column(String(255), nullable=False)
    description_of_material = Column(String(255), nullable=False)
    quantity = Column(String(255), nullable=False)
    date_time = Column(DateTime, nullable=False, index=True)
    security_name = Column(String(100), nullable=False)
    security_username = Column(String(50), nullable=False)
    warehouse_code = Column(String(50), nullable=False, index=True)
    site_code = Column(String(50), nullable=False)
    
    # Edit tracking fields (48-hour edit window)
    last_edited_at = Column(DateTime)
    edit_count = Column(Integer, default=0)
    
    def __repr__(self):
        return f"<RawMaterialsData(gate_entry_no='{self.gate_entry_no}', vehicle_no='{self.vehicle_no}')>"