# app/models/gate_pass.py — Returnable / Non-Returnable Gate Pass module.
#
# Design rules (agreed July 2026):
#  - NO EDIT anywhere: a wrong pass is Cancelled (mandatory reason) and recreated.
#  - Numbers are assigned at creation from an incremental per-location, per-type
#    series and are NEVER reused — cancelled passes keep their number forever.
#  - Partial returns: inward receipts are append-only transactions against the
#    lines (received_qty accumulates); the pass header quantities never change.
#  - Security remarks live on the EVENT (dispatch/inward), initiator remarks on
#    the header. Two different fields; neither overwrites the other.
#  - gate_pass_locations is a PLACEHOLDER master: the real location master
#    (separate from location_master/warehouses) is not yet confirmed. The
#    warehouse_code column maps a gate pass location to the guard's warehouse
#    so Released passes surface on the right guard's screen.
from sqlalchemy import (
    Column, Integer, String, Date, Text, DateTime, ForeignKey,
    Numeric, UniqueConstraint, Boolean,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# ── Status constants ─────────────────────────────────────────────────────────
GP_OPEN = "Open"
GP_RELEASED = "Released"
GP_DISPATCHED = "Dispatched"
GP_PARTIAL = "Partially Received"
GP_RECEIVED = "Inward Received"          # terminal (RGP fully returned)
GP_CANCELLED = "Cancelled"               # terminal
GP_CLOSED = "Closed Without Return"      # terminal (force close, admin)

# NRGP lifecycle: Open → Released → Dispatched (terminal). No inward leg.
# RGP  lifecycle: Open → Released → Dispatched → [Partially Received →] Inward Received
#                 Cancel allowed from Open and Released only.

PASS_TYPE_RETURNABLE = "R"
PASS_TYPE_NON_RETURNABLE = "NR"

class GatePassDepartment(Base):
    """Department master — replaces the old hardcoded DEPARTMENTS list
    (superseded 3 Aug 2026). Same admin-maintained pattern as
    GatePassCancelReason: real values loaded from the business's department
    master Excel, no gate pass accounts existed yet so no data migration
    was needed — just a clean initial load."""
    __tablename__ = "gate_pass_departments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    department_name = Column(String(100), unique=True, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class GatePassLocation(Base):
    """PLACEHOLDER location master for gate passes (real master TBC).
    warehouse_code maps this location to the security guards' warehouse so
    guard visibility queries work; nullable until the real mapping arrives."""
    __tablename__ = "gate_pass_locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_code = Column(String(10), unique=True, nullable=False)   # e.g. "HO"
    location_name = Column(String(255), nullable=False)
    warehouse_code = Column(String(50), nullable=True)   # maps to location_master.warehouse_code
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class GatePassVendor(Base):
    """Vendor master — fed by the daily incremental Fabric pipeline.
    Feed columns (Navision): No. -> vendor_code, Name -> vendor_name,
    City, Post Code, Phone No., Contact. Phone is VARCHAR by decision
    (leading zeros, +91, slashes; int32 overflows on real numbers).
    Deletes arrive as is_active=false — rows are never removed, so old
    passes can always live-lookup current contact details (no snapshot).
    Mutually exclusive with GatePassCustomer on the create form — a pass
    is filed against exactly one of the two (see GatePassHeader.party_type)."""
    __tablename__ = "gate_pass_vendors"

    vendor_code = Column(String(50), primary_key=True)
    vendor_name = Column(String(255), nullable=False)
    city = Column(String(100), nullable=True)
    post_code = Column(String(20), nullable=True)
    phone_no = Column(String(20), nullable=True)
    contact = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)


class GatePassCustomer(Base):
    """Customer master — fed by the daily incremental Fabric pipeline.
    Same structure/feed pattern as GatePassVendor (split out so vendor and
    customer selection are mutually exclusive on the create form)."""
    __tablename__ = "gate_pass_customers"

    customer_code = Column(String(50), primary_key=True)
    customer_name = Column(String(255), nullable=False)
    city = Column(String(100), nullable=True)
    post_code = Column(String(20), nullable=True)
    phone_no = Column(String(20), nullable=True)
    contact = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)


class GatePassAsset(Base):
    """FIXED ASSET master — fed by the daily incremental Fabric pipeline.
    Feed columns (Navision): Asset No. -> asset_code, Description ->
    asset_name, FA Class Code -> fa_class_code. This is what the create
    form's 'Fixed Asset' line type searches (renamed from gate_pass_items,
    which is now the user-populated 'Item' master below)."""
    __tablename__ = "gate_pass_assets"

    asset_code = Column(String(50), primary_key=True)     # Asset No., e.g. FA-COM-0412
    asset_name = Column(String(255), nullable=False)      # Description
    fa_class_code = Column(String(50), nullable=True)     # e.g. COMP
    is_active = Column(Boolean, nullable=False, default=True)


class GatePassItem(Base):
    """User-populated 'Item' master — NOT Fabric-fed. Used when the initiator
    can't find what they need in GatePassAsset: they type a description on
    the create form and it is looked up (case-insensitive) or created here.
    item_id is server-generated and never user-editable; item_name is unique
    so the same description is never mastered twice."""
    __tablename__ = "gate_pass_items"

    item_id = Column(Integer, primary_key=True, autoincrement=True)
    item_name = Column(String(255), unique=True, nullable=False)   # Description of goods
    is_active = Column(Boolean, nullable=False, default=True)


class GatePassCancelReason(Base):
    """Cancel reason master — PLACEHOLDER values seeded via migration;
    admin-maintained so reasons can change without a deployment."""
    __tablename__ = "gate_pass_cancel_reasons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reason_text = Column(String(255), unique=True, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)


class GatePassSequence(Base):
    """Incremental number series — one row per (location, pass type).
    Incremented under a row lock (SELECT ... FOR UPDATE) so two users
    creating simultaneously can never collide. Numbers are never reused."""
    __tablename__ = "gate_pass_sequences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_code = Column(String(10), nullable=False)
    pass_type = Column(String(3), nullable=False)        # 'R' | 'NR'
    last_number = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("location_code", "pass_type", name="uq_gate_pass_seq_loc_type"),
    )


class GatePassHeader(Base):
    __tablename__ = "gate_pass_headers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gate_pass_no = Column(String(30), unique=True, nullable=False, index=True)
    pass_type = Column(String(3), nullable=False, index=True)          # 'R' | 'NR'
    status = Column(String(30), nullable=False, default=GP_OPEN, index=True)

    location_code = Column(String(10), nullable=False, index=True)
    # Denormalised from gate_pass_locations at creation — guard visibility key.
    warehouse_code = Column(String(50), nullable=True, index=True)

    document_date = Column(Date, nullable=False)          # auto-filled at creation
    document_time = Column(String(12), nullable=False)    # "HH:MM:SS"

    party_type = Column(String(10), nullable=False)       # 'Vendor' | 'Customer'
    party_code = Column(String(50), nullable=False)
    party_name = Column(String(255), nullable=False)
    department = Column(String(50), nullable=False, index=True)   # fixed list
    mode_of_transport = Column(String(30), nullable=False)        # 'Hand Delivery' | 'Vehicle'
    vehicle_no = Column(String(20), nullable=True)
    sender_name = Column(String(100), nullable=True)
    approver_name = Column(String(100), nullable=True)            # plain text in v1
    expected_inward_date = Column(Date, nullable=True, index=True)  # R only
    remarks = Column(Text, nullable=True)                 # initiator remarks — frozen

    # Lifecycle stamps (append-only; no field is ever edited after being set)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    released_by = Column(String(50), nullable=True)
    released_at = Column(DateTime(timezone=True), nullable=True)
    dispatched_by = Column(String(50), nullable=True)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)
    dispatch_remarks = Column(Text, nullable=True)        # security remarks at dispatch
    # Stamped on every /inward call (partial or fully-received) - distinct
    # from completed_at, which is only set once the pass is FULLY back.
    # Lets the UI show "last movement back on <date>" even mid-return.
    last_inward_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)  # fully received / closed
    cancelled_by = Column(String(50), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason_id = Column(Integer, ForeignKey("gate_pass_cancel_reasons.id"), nullable=True)
    cancel_remarks = Column(Text, nullable=True)
    replacement_pass_no = Column(String(30), nullable=True)  # audit link: recreated as
    closed_by = Column(String(50), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    close_reason = Column(Text, nullable=True)            # mandatory on force close

    lines = relationship(
        "GatePassLine", back_populates="header",
        order_by="GatePassLine.line_no", cascade="all, delete-orphan",
    )
    events = relationship(
        "GatePassEvent", back_populates="header",
        order_by="GatePassEvent.event_at", cascade="all, delete-orphan",
    )
    cancel_reason = relationship("GatePassCancelReason")

    # ── Derived helpers (no state is stored) ────────────────────────────────
    def total_outstanding(self):
        """Quantity still not returned across all lines (RGP)."""
        return sum(max((l.quantity or 0) - (l.received_qty or 0), 0) for l in self.lines)

    def is_overdue(self, today):
        """Derived flag — never a status. Dispatched/Partial RGP past its
        expected inward date with quantities outstanding."""
        return (
            self.pass_type == PASS_TYPE_RETURNABLE
            and self.status in (GP_DISPATCHED, GP_PARTIAL)
            and self.expected_inward_date is not None
            and self.expected_inward_date <= today
            and self.total_outstanding() > 0
        )


class GatePassLine(Base):
    __tablename__ = "gate_pass_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gate_pass_id = Column(
        Integer, ForeignKey("gate_pass_headers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    line_no = Column(Integer, nullable=False)
    item_type = Column(String(20), nullable=True)         # 'Fixed Asset' | 'Item'
    # Exactly one of the two is set, matching item_type — different master
    # tables with different key types (GatePassAsset.asset_code is a Fabric
    # string code; GatePassItem.item_id is our own auto-increment integer).
    asset_code = Column(String(50), nullable=True)        # set when item_type == 'Fixed Asset'
    item_id = Column(Integer, nullable=True)              # set when item_type == 'Item'
    # Snapshot of the asset's FA class at creation (decision 14 Jul 2026):
    # master rows are updated by the pipeline over time, but the class a
    # pass moved under is a historical fact — frozen here, never updated.
    fa_class_code = Column(String(50), nullable=True)
    description = Column(String(250), nullable=False)     # Navision parity: 250 chars
    serial_no = Column(String(100), nullable=True)
    uom = Column(String(20), nullable=False, default="NOS")
    quantity = Column(Integer, nullable=False)
    amount = Column(Numeric(14, 2), nullable=True)
    chargeable = Column(String(20), nullable=True)        # 'Chargeable' | 'Non-chargeable'
    # Accumulated from inward receipt events — the ONLY mutable column, and it
    # only ever increases via append-only receipt transactions.
    received_qty = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("gate_pass_id", "line_no", name="uq_gate_pass_line_no"),
    )

    header = relationship("GatePassHeader", back_populates="lines")


class GatePassEvent(Base):
    """Append-only lifecycle log: every transition, with who/when/remarks.
    Inward events store per-line received quantities in details_json so a
    5-out / 3-back / 2-later history is fully reconstructable."""
    __tablename__ = "gate_pass_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gate_pass_id = Column(
        Integer, ForeignKey("gate_pass_headers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    event_type = Column(String(20), nullable=False)
    # 'CREATE' | 'RELEASE' | 'DISPATCH' | 'INWARD' | 'CANCEL' | 'FORCE_CLOSE'
    event_by = Column(String(50), nullable=False)
    event_at = Column(DateTime(timezone=True), server_default=func.now())
    remarks = Column(Text, nullable=True)                 # security remarks live here
    details_json = Column(Text, nullable=True)            # e.g. inward line receipts

    header = relationship("GatePassHeader", back_populates="events")


class UserGatePassLocation(Base):
    """One user -> N gate pass locations (Meena case), exactly one starred
    default per user (enforced by partial unique index in the migration).
    users_master.gate_pass_location stays as legacy fallback during
    transition — see user_gate_pass_locations_migration.sql."""
    __tablename__ = "user_gate_pass_locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), ForeignKey("users_master.username", ondelete="CASCADE"),
                      nullable=False, index=True)
    location_code = Column(String(10), ForeignKey("gate_pass_locations.location_code"),
                           nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("username", "location_code"),)
