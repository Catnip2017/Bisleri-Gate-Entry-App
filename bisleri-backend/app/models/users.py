from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class LocationMaster(Base):
    __tablename__ = "location_master"
    
    warehouse_code = Column(String(50), primary_key=True)
    warehouse_name = Column(String(255))
    site_code = Column(String(50))
    warehouse_id = Column(String(50))

class UsersMaster(Base):
    __tablename__ = "users_master"
    
    username = Column(String(50), primary_key=True)
    first_name = Column(String(255))
    last_name = Column(String(255))
    role = Column(String(50))
    warehouse_code = Column(String(50), ForeignKey("location_master.warehouse_code"))
    warehouse_name = Column(String(255))
    site_code = Column(String(50))
    password = Column(String(255))
    email = Column(String(255), nullable=True, default=None)
    phone_number = Column(String(20), nullable=True, default=None)
    last_login = Column(DateTime)
    copacker_location = Column(String(255), nullable=True, default=None)
    # Gate Pass User scope fields (added for AD integration + gate pass module)
    department = Column(String(50), nullable=True, default=None)
    gate_pass_location = Column(String(50), nullable=True, default=None)

    location = relationship("LocationMaster")
