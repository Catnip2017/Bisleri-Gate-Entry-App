# app/models/inventory.py - Blinkit Inventory Portal (26 Nov 2026).
#
#   inventory_batches          one row per "Submit All" (manual list or Excel upload)
#   inventory_entries          one row per stock line — never edited or deleted
#   inventory_user_warehouses  warehouses an operator / viewer is mapped to (many)
#   inventory_operator_viewers Blinkit viewers an operator enters stock for (many)
#   inventory_viewer_customer  the ONE customer code of a Blinkit viewer
#
# SKUs come from item_master and warehouses from location_master (both
# already in bisleri_ecosystem). A customer master is to be added later;
# until then the viewer's customer code is held on its mapping row.
from sqlalchemy import (
    Column, BigInteger, Integer, String, Date, DateTime, ForeignKey, Index, CheckConstraint,
)
from sqlalchemy.sql import func
from app.database import Base

# BIGINT identity on Postgres; plain INTEGER on SQLite so the test suite's
# in-memory DB can autoincrement.
_BigId = BigInteger().with_variant(Integer, "sqlite")


class InventoryBatch(Base):
    __tablename__ = "inventory_batches"

    id = Column(_BigId, primary_key=True, autoincrement=True)
    source = Column(String(10), nullable=False)            # 'manual' | 'upload'
    file_name = Column(String(255), nullable=True)
    line_count = Column(Integer, nullable=False, default=0)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class InventoryEntry(Base):
    __tablename__ = "inventory_entries"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_inventory_entries_quantity_positive"),
        Index("ix_inventory_entries_date_wh", "inv_date", "warehouse_code"),
        Index("ix_inventory_entries_cust_date", "customer_code", "inv_date"),
    )

    id = Column(_BigId, primary_key=True, autoincrement=True)
    batch_id = Column(_BigId, ForeignKey("inventory_batches.id"), nullable=False, index=True)
    inv_date = Column(Date, nullable=False)
    customer_code = Column(String(50), nullable=False)
    warehouse_code = Column(String(50), ForeignKey("location_master.warehouse_code"), nullable=False)
    sku_code = Column(String(255), nullable=False)          # item_master.item_number
    sku_name = Column(String(255), nullable=True)           # snapshot of item_master.product_name
    quantity = Column(Integer, nullable=False)              # cases, whole number
    batch_no = Column(String(100), nullable=True)
    mfg_date = Column(Date, nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class InventoryUserWarehouse(Base):
    __tablename__ = "inventory_user_warehouses"

    username = Column(String(50), ForeignKey("users_master.username", ondelete="CASCADE"), primary_key=True)
    warehouse_code = Column(String(50), ForeignKey("location_master.warehouse_code"), primary_key=True)


class InventoryOperatorViewer(Base):
    __tablename__ = "inventory_operator_viewers"

    operator_username = Column(String(50), ForeignKey("users_master.username", ondelete="CASCADE"), primary_key=True)
    viewer_username = Column(String(50), ForeignKey("users_master.username", ondelete="CASCADE"), primary_key=True)


class InventoryViewerCustomer(Base):
    __tablename__ = "inventory_viewer_customer"

    username = Column(String(50), ForeignKey("users_master.username", ondelete="CASCADE"), primary_key=True)
    customer_code = Column(String(50), nullable=False, index=True)
