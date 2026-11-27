from sqlalchemy import Boolean, Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship, deferred
from sqlalchemy.sql import func
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
    # Deactivate-don't-delete (12 Jul 2026). NULL (pre-migration rows) is
    # treated as active everywhere — only an explicit False blocks access.
    is_active = Column(Boolean, nullable=True, default=True)
    # Dormant-account tracking (26 Nov 2026, migration b9e4d2a7c1f5).
    # created_at: existing rows were back-filled with the date the migration
    # ran (= go-live). last_seen_at: last time the user used the app (any
    # signed-in request, written at most every 5 minutes).
    # Both are deferred (not in normal SELECTs) so the app keeps working on a
    # database where that migration has not been run yet — see
    # app/services/security.py: security_ready().
    created_at = deferred(Column(DateTime, nullable=True, server_default=func.now()))
    last_seen_at = deferred(Column(DateTime, nullable=True))
    # Password policy status (27 Nov 2026, migration a7c3e5d1f9b2): NULL = not
    # checked yet, True = meets the rule, False = needs update. Deferred for
    # the same reason as above (app.services.security.password_ready()).
    password_policy_ok = deferred(Column(Boolean, nullable=True))
    password_changed_at = deferred(Column(DateTime, nullable=True))

    location = relationship("LocationMaster")
