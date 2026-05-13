# app/models/copacker.py
from sqlalchemy import (
    Column, Integer, String, Date, Time, Text,
    DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class CopackerLocation(Base):
    __tablename__ = "copacker_locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_name = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    assets = relationship("CopackerAsset", back_populates="location")


class CopackerAsset(Base):
    __tablename__ = "copacker_assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, ForeignKey("copacker_locations.id"), nullable=False)
    line_no = Column(Integer, nullable=False)
    asset_model_id = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("location_id", "line_no", name="uq_copacker_asset_location_line"),
    )

    location = relationship("CopackerLocation", back_populates="assets")


class CopackerEntry(Base):
    __tablename__ = "copacker_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    copacker_location = Column(String(255), nullable=False)
    line_no = Column(Integer, nullable=False)
    asset_model_id = Column(String(255), nullable=False)
    entry_date = Column(Date, nullable=False)
    entry_time = Column(Time, nullable=False)
    image_path = Column(Text, nullable=True)
    sku_name = Column(String(255), nullable=True)
    sku_itemid = Column(String(255), nullable=True)
    username = Column(String(255), nullable=False)
    extracted_quantity = Column(Integer, nullable=True)
    extracted_quantity_raw = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    edit_logs = relationship("CopackerQuantityEditLog", back_populates="entry")


class CopackerQuantityEditLog(Base):
    __tablename__ = "copacker_quantity_edit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entry_id = Column(Integer, ForeignKey("copacker_entries.id"), nullable=False)
    original_value = Column(Integer, nullable=True)
    edited_value = Column(Integer, nullable=False)
    edited_by = Column(String(255), nullable=False)
    edited_at = Column(DateTime, server_default=func.now())
    auto_remarks = Column(Text, nullable=True)

    entry = relationship("CopackerEntry", back_populates="edit_logs")


class ItemMaster(Base):
    """Read-only reference to existing item_master table in Bisleri_01"""
    __tablename__ = "item_master"

    # Use explicit lowercase DB column names — PostgreSQL lowercases unquoted identifiers
    Item_number   = Column("item_number",    String(255), primary_key=True)
    Product_name  = Column("product_name",   String(255))
    Product_type  = Column("product_type",   String(255))
    Product_Subtype = Column("product_subtype", String(255))
    net_weight    = Column("net_weight",     String(255))
