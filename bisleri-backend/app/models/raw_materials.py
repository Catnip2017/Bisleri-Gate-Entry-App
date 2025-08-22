# app/models/raw_materials.py
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base

class RawMaterialsData(Base):
    __tablename__ = "raw_materials_data"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    gate_entry_no = Column(String(50), nullable=False)
    gate_type = Column(String(20), nullable=False)  # Gate-In or Gate-Out
    vehicle_no = Column(String(50), nullable=False)
    document_no = Column(String(50), nullable=False)
    name_of_party = Column(String(255), nullable=False)
    description_of_material = Column(String(255), nullable=False)
    quantity = Column(String(255), nullable=False)
    date_time = Column(DateTime, nullable=False)
    security_name = Column(String(100), nullable=False)
    security_username = Column(String(50), nullable=False)
    warehouse_code = Column(String(50), nullable=False)
    site_code = Column(String(50), nullable=False)
    
    # Edit tracking fields (24-hour edit window)
    last_edited_at = Column(DateTime)
    edit_count = Column(Integer, default=0)
    
    def __repr__(self):
        return f"<RawMaterialsData(gate_entry_no='{self.gate_entry_no}', vehicle_no='{self.vehicle_no}')>"