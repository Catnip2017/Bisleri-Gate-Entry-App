from sqlalchemy import Column, Integer, String, DateTime, Numeric
from app.database import Base

# Mfabric tables - NO PRIMARY KEYS (staging tables for client data)
class MfabricDeliveryChallanData(Base):
    __tablename__ = "mfabric_deliverychallan_data"
    
    document_type = Column(String(255))
    document_no = Column(String(255), primary_key=True)  # Fake primary key for SQLAlchemy only
    document_date = Column(DateTime(timezone=True))
    e_way_bill_no = Column(String(255))
    transporter_name = Column(String(255))
    vehicle_no = Column(String(255))
    irn_no = Column(String(255))
    route_no = Column(String(255))
    total_quantity = Column(Integer)
    site = Column(String(255))
    customer_code = Column(String(255))
    customer_name = Column(String(255))
    itemid = Column(String(255), nullable=True)
    linenum = Column(Numeric(), nullable=True)

class MfabricInvoiceData(Base):
    __tablename__ = "mfabric_invoice_data"
    
    document_type = Column(String(255))
    document_no = Column(String(255), primary_key=True)  # Fake primary key for SQLAlchemy only
    document_date = Column(DateTime(timezone=True))
    e_way_bill_no = Column(String(255))
    transporter_name = Column(String(255))
    vehicle_no = Column(String(255))
    irn_no = Column(String(255))
    customer_code = Column(String(255))
    customer_name = Column(String(255))
    total_quantity = Column(Integer)
    site = Column(String(255))
    itemid = Column(String(255), nullable=True)
    linenum = Column(Numeric(), nullable=True)

class MfabricTransferOrderRGPData(Base):
    __tablename__ = "mfabric_transferorder_rgp_data"
    
    document_type = Column(String(255))
    sub_document_type = Column(String(255))
    document_no = Column(String(255), primary_key=True)  # Fake primary key for SQLAlchemy only
    document_date = Column(DateTime(timezone=True))
    e_way_bill_no = Column(String(255))
    transporter_name = Column(String(255))
    vehicle_no = Column(String(255))
    irn_no = Column(String(255))
    from_warehouse_code = Column(String(255))
    to_warehouse_code = Column(String(255))
    route_code = Column(String(255))
    total_quantity = Column(Integer)
    site = Column(String(255))
    direct_dispatch = Column(String(255))
    salesman = Column(String(255))
    itemid = Column(String(255), nullable=True)
    linenum = Column(Numeric(), nullable=True)

# Keep DocumentData as is - this is your consolidated table with proper PK
class DocumentData(Base):
    __tablename__ = "document_data"
    document_no = Column(String(100), primary_key=True)
    site = Column(String(100))
    document_type = Column(String(100))
    document_date = Column(DateTime)
    e_way_bill_no = Column(String(100))
    transporter_name = Column(String(100))
    vehicle_no = Column(String(100))
    irn_no = Column(String(100))
    warehouse_code = Column(String(100))
    warehouse_name = Column(String(100))
    route_code = Column(String(100))
    route_no = Column(String(100))
    customer_code = Column(String(100))
    customer_name = Column(String(100))
    direct_dispatch = Column(String(100))
    total_quantity = Column(String(100))
    gate_entry_no = Column(String(20))
    from_warehouse_code = Column(String(100))
    to_warehouse_code = Column(String(100))
    sub_document_type = Column(String(100))
    salesman = Column(String(100))