# app/models/copacker.py
from sqlalchemy import (
    Column, Integer, BigInteger, String, Date, Time, Text,
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

    # ── Multi-field OCR extraction columns ───────────────────────────────────
    preform_total    = Column(BigInteger, nullable=True)
    preform_shift    = Column(BigInteger, nullable=True)
    bottles_total    = Column(BigInteger, nullable=True)
    bottles_shift    = Column(BigInteger, nullable=True)
    operating_hours  = Column(Integer,    nullable=True)
    recipe           = Column(String(500), nullable=True)
    asset_model_no   = Column(String(100), nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    edit_logs = relationship("CopackerQuantityEditLog", back_populates="entry")


class CopackerQuantityEditLog(Base):
    __tablename__ = "copacker_quantity_edit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entry_id = Column(Integer, ForeignKey("copacker_entries.id"), nullable=False)
    # Legacy integer columns — used only for extracted_quantity edits
    original_value = Column(Integer, nullable=True)
    edited_value   = Column(Integer, nullable=True)   # nullable for new-style text edits
    edited_by = Column(String(255), nullable=False)
    edited_at = Column(DateTime, server_default=func.now())
    auto_remarks = Column(Text, nullable=True)
    # New multi-field columns
    field_name          = Column(String(50),  default="extracted_quantity")
    original_text_value = Column(Text, nullable=True)
    edited_text_value   = Column(Text, nullable=True)

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


# ── Phase 2: Session-based 4-machine capture system ──────────────────────────

class CopackerSession(Base):
    """One row per production run. Contains 1–4 captures."""
    __tablename__ = "copacker_sessions"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    copacker_location = Column(String(200), nullable=False)
    line_no           = Column(Integer, nullable=False)
    sku_name          = Column(String(500), nullable=True)
    sku_item_id       = Column(String(100), nullable=True)
    status            = Column(String(20), nullable=False, default="in_progress")
    # 'in_progress' | 'completed'
    submitted_by      = Column(String(100), nullable=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    completed_at      = Column(DateTime(timezone=True), nullable=True)

    captures = relationship(
        "CopackerCapture",
        back_populates="session",
        order_by="CopackerCapture.step_order",
    )


class CopackerCapture(Base):
    """One row per machine image capture (up to 4 per session)."""
    __tablename__ = "copacker_captures"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    session_id     = Column(Integer, ForeignKey("copacker_sessions.id", ondelete="CASCADE"), nullable=False)
    step_order     = Column(Integer, nullable=False)
    capture_type   = Column(String(50), nullable=False)
    # 'blow_molder' | 'bottling' | 'labelling' | 'case_counter'

    asset_model_id = Column(String(100), nullable=True)
    image_path     = Column(String(500), nullable=True)
    ocr_raw        = Column(Text, nullable=True)  # full AI JSON — audit trail

    # ── Blow Molder fields (step 1) ─────────────────────────────────
    bottle_recipe  = Column(String(500), nullable=True)
    preform_total  = Column(BigInteger, nullable=True)
    preform_shift  = Column(BigInteger, nullable=True)
    bottles_total  = Column(BigInteger, nullable=True)  # also reused for Bottling
    bottles_shift  = Column(BigInteger, nullable=True)
    operating_hours = Column(Integer, nullable=True)

    # ── Bottling-only (step 2) ──────────────────────────────────────
    production_speed_bph = Column(Integer, nullable=True)

    # ── Labelling (step 3) ──────────────────────────────────────────
    labels_count   = Column(BigInteger, nullable=True)
    label_format   = Column(String(200), nullable=True)

    # ── Case Counter (step 4) ───────────────────────────────────────
    packs_counter  = Column(Integer, nullable=True)
    pack_format    = Column(String(200), nullable=True)

    captured_at    = Column(DateTime(timezone=True), server_default=func.now())
    captured_by    = Column(String(100), nullable=True)

    session   = relationship("CopackerSession", back_populates="captures")
    edit_logs = relationship("CopackerCaptureEditLog", back_populates="capture")


class CopackerCaptureEditLog(Base):
    """Audit log for edits made to capture fields (asset_model_id only in Phase 2)."""
    __tablename__ = "copacker_capture_edit_log"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    capture_id     = Column(Integer, ForeignKey("copacker_captures.id", ondelete="CASCADE"), nullable=False)
    field_name     = Column(String(100), nullable=False)
    original_value = Column(Text, nullable=True)
    edited_value   = Column(Text, nullable=True)
    edited_by      = Column(String(100), nullable=False)
    edited_at      = Column(DateTime(timezone=True), server_default=func.now())

    capture = relationship("CopackerCapture", back_populates="edit_logs")
