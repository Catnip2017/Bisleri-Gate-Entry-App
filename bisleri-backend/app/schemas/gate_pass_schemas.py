# app/schemas/gate_pass_schemas.py — typed request/response models for the
# Returnable / Non-Returnable Gate Pass module. Typed from day one (no raw
# dict payloads — Pass 3 finding #10).
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


# ── Masters / lookups ────────────────────────────────────────────────────────
class GatePassLocationResponse(BaseModel):
    id: int
    location_code: str
    location_name: str
    warehouse_code: Optional[str] = None

    class Config:
        from_attributes = True


class VendorResponse(BaseModel):
    vendor_code: str
    vendor_name: str
    city: Optional[str] = None
    post_code: Optional[str] = None
    phone_no: Optional[str] = None
    contact: Optional[str] = None

    class Config:
        from_attributes = True


class CustomerResponse(BaseModel):
    customer_code: str
    customer_name: str
    city: Optional[str] = None
    post_code: Optional[str] = None
    phone_no: Optional[str] = None
    contact: Optional[str] = None

    class Config:
        from_attributes = True


class AssetResponse(BaseModel):
    asset_code: str
    asset_name: str
    fa_class_code: Optional[str] = None

    class Config:
        from_attributes = True


class ItemResponse(BaseModel):
    item_id: int
    item_code: Optional[str] = None   # Fabric's itemid; None for manually-added items
    item_name: str
    source: str                       # 'FABRIC' | 'MANUAL' — shown in the lookup pop-up

    class Config:
        from_attributes = True


class ItemCreateRequest(BaseModel):
    """Manual "+ Add new item" from the lookup pop-up — never gets an
    item_code (Fabric's Inventtable is the only source of those)."""
    item_name: str = Field(..., min_length=1, max_length=255)


class CancelReasonResponse(BaseModel):
    id: int
    reason_text: str

    class Config:
        from_attributes = True


# ── Create ───────────────────────────────────────────────────────────────────
class GatePassLineCreate(BaseModel):
    asset_code: Optional[str] = None         # Fixed Asset lines only (from GatePassAsset)
    item_id: Optional[int] = None            # Item lines only (from GatePassItem, Fabric or manual)
    item_type: Optional[str] = None          # 'Fixed Asset' | 'Item'
    description: str = Field(..., min_length=1, max_length=250)
    serial_no: Optional[str] = Field(None, max_length=100)
    uom: str = Field("NOS", max_length=20)
    quantity: int = Field(..., gt=0)
    amount: Optional[Decimal] = Field(None, ge=0)
    chargeable: Optional[str] = None         # 'Chargeable' | 'Non-chargeable'

    @field_validator("item_type")
    @classmethod
    def validate_item_type(cls, v):
        if v is not None and v not in ("Fixed Asset", "Item"):
            raise ValueError("item_type must be 'Fixed Asset' or 'Item'")
        return v

    @field_validator("chargeable")
    @classmethod
    def validate_chargeable(cls, v):
        if v is not None and v not in ("Chargeable", "Non-chargeable"):
            raise ValueError("chargeable must be 'Chargeable' or 'Non-chargeable'")
        return v


class GatePassCreate(BaseModel):
    pass_type: str                            # 'R' | 'NR'
    location_code: str
    party_type: str                           # 'Vendor' | 'Customer'
    party_code: str
    department: str
    mode_of_transport: str                    # 'Hand Delivery' | 'Vehicle'
    vehicle_no: Optional[str] = Field(None, max_length=20)
    sender_name: Optional[str] = Field(None, max_length=100)
    approver_name: Optional[str] = Field(None, max_length=100)
    expected_inward_date: Optional[date] = None   # required for R, forbidden for NR
    remarks: Optional[str] = Field(None, max_length=1000)
    lines: List[GatePassLineCreate] = Field(..., min_length=1)

    @field_validator("pass_type")
    @classmethod
    def validate_pass_type(cls, v):
        if v not in ("R", "NR"):
            raise ValueError("pass_type must be 'R' or 'NR'")
        return v

    @field_validator("mode_of_transport")
    @classmethod
    def validate_transport(cls, v):
        if v not in ("Hand Delivery", "Vehicle"):
            raise ValueError("mode_of_transport must be 'Hand Delivery' or 'Vehicle'")
        return v

    @field_validator("party_type")
    @classmethod
    def validate_party_type(cls, v):
        if v not in ("Vendor", "Customer"):
            raise ValueError("party_type must be 'Vendor' or 'Customer'")
        return v


# ── Actions ──────────────────────────────────────────────────────────────────
class GatePassCancelRequest(BaseModel):
    cancel_reason_id: int
    cancel_remarks: Optional[str] = Field(None, max_length=500)


class GatePassDispatchRequest(BaseModel):
    security_remarks: Optional[str] = Field(None, max_length=500)


class InwardLineReceipt(BaseModel):
    line_id: int
    received_qty: int = Field(..., gt=0)


class GatePassInwardRequest(BaseModel):
    receipts: List[InwardLineReceipt] = Field(..., min_length=1)
    security_remarks: Optional[str] = Field(None, max_length=500)


class GatePassForceCloseRequest(BaseModel):
    close_reason: str = Field(..., min_length=5, max_length=500)


# ── Responses ────────────────────────────────────────────────────────────────
class GatePassLineResponse(BaseModel):
    id: int
    line_no: int
    asset_code: Optional[str] = None
    item_id: Optional[int] = None
    item_type: Optional[str] = None
    fa_class_code: Optional[str] = None
    description: str
    serial_no: Optional[str] = None
    uom: str
    quantity: int
    amount: Optional[Decimal] = None
    chargeable: Optional[str] = None
    received_qty: int

    class Config:
        from_attributes = True


class GatePassEventResponse(BaseModel):
    id: int
    event_type: str
    event_by: str
    event_at: Optional[datetime] = None
    remarks: Optional[str] = None
    details_json: Optional[str] = None

    class Config:
        from_attributes = True


class GatePassListItem(BaseModel):
    id: int
    gate_pass_no: str
    pass_type: str
    status: str
    location_code: str
    document_date: date
    document_time: str
    party_type: str
    party_code: str
    party_name: str
    department: str
    mode_of_transport: str
    vehicle_no: Optional[str] = None
    expected_inward_date: Optional[date] = None
    created_by: str
    created_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    last_inward_at: Optional[datetime] = None
    line_count: int = 0
    total_quantity: int = 0
    outstanding_quantity: int = 0
    is_overdue: bool = False
    cancel_reason_text: Optional[str] = None
    replacement_pass_no: Optional[str] = None


class GatePassDetailResponse(GatePassListItem):
    sender_name: Optional[str] = None
    approver_name: Optional[str] = None
    remarks: Optional[str] = None
    dispatch_remarks: Optional[str] = None
    cancel_remarks: Optional[str] = None
    close_reason: Optional[str] = None
    released_by: Optional[str] = None
    dispatched_by: Optional[str] = None
    cancelled_by: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    closed_by: Optional[str] = None
    closed_at: Optional[datetime] = None
    lines: List[GatePassLineResponse] = []
    events: List[GatePassEventResponse] = []


class GatePassListResponse(BaseModel):
    total_count: int
    items: List[GatePassListItem]


class DueNotificationItem(BaseModel):
    gate_pass_no: str
    party_name: str
    department: str
    expected_inward_date: date
    days_overdue: int
    outstanding_quantity: int
    status: str


class DueNotificationsResponse(BaseModel):
    count: int
    items: List[DueNotificationItem]


# ── Reports (Creator FY Register / Dispatcher FY Item Reconciliation) ───────
# Added 1 Oct 2026, revised 1 Oct 2026 — the "Reports" tab in the Gate Pass
# Menu. Role-scoped the same way as the existing list/guard-pending
# endpoints (own location(s) + department for Creator; own location(s) for
# Dispatcher). The on-screen JSON is grouped one entry per gate pass (with
# line items nested, for the on-screen expandable row); the downloadable
# .xlsx flattens the same underlying query to one row per line item (Excel
# Tables/AutoFilter don't tolerate merged cells, so pass-level fields repeat
# per line there instead). Both come from the same query, so they agree.

class FinancialYearsResponse(BaseModel):
    financial_years: List[str]       # e.g. ["2026-27", "2025-26"], newest first
    current: str                     # the FY in progress today


class CreatorLineItem(BaseModel):
    line_no: int
    item_type: str                   # 'Fixed Asset' | 'Item'
    item_code: Optional[str] = None  # Asset No. or Item Code
    description: str
    serial_no: Optional[str] = None
    uom: Optional[str] = None
    quantity: int
    amount: float
    chargeable: bool


class CreatorRegisterRow(BaseModel):
    gate_pass_no: str
    pass_type: str
    status: str
    location_code: str
    party_name: str
    created_by: str
    gate_pass_created_date: date
    dispatched_at: Optional[datetime] = None
    expected_return_date: Optional[date] = None      # blank for NR passes
    actual_return_date: Optional[datetime] = None     # best available: completed_at
    days_outstanding: Optional[int] = None
    total_qty: int
    total_amount: float
    chargeable: bool
    cancel_info: Optional[str] = None
    remarks: Optional[str] = None
    lines: List[CreatorLineItem] = []


class CreatorReportSummary(BaseModel):
    total_passes: int
    returnable_count: int
    non_returnable_count: int
    status_counts: dict             # {"Open": 2, "Released": 1, ...}
    pending_return_count: int       # R, dispatched, not received
    overdue_count: int              # pending_return AND past expected return date
    total_chargeable_amount: float


class CreatorReportResponse(BaseModel):
    financial_year: str
    department: Optional[str] = None   # the caller's own department — every row is scoped
    summary: CreatorReportSummary      # to it, so it's shown once here rather than per row
    rows: List[CreatorRegisterRow]


class DispatcherLineItem(BaseModel):
    item_code: Optional[str] = None       # Item Code or Asset No.
    description: str
    qty_sent: int
    unit: Optional[str] = None
    qty_returned: int
    reconciliation_status: str       # Fully Returned | Partially Returned | Pending | Not Applicable
    serial_no: Optional[str] = None


class DispatcherDetailRow(BaseModel):
    department: str
    pass_type: str
    gate_pass_no: str
    status: str                      # the pass's own workflow status (Dispatched/Partially
                                      # Received/Inward Received) — not a re-derived value
    party_name: str
    dispatch_date: Optional[datetime] = None
    expected_return_date: Optional[date] = None
    actual_return_date: Optional[datetime] = None   # best available: last_inward_at/completed_at
    total_qty_sent: int               # summed across this pass's lines
    days_outstanding: Optional[int] = None
    remarks: Optional[str] = None
    lines: List[DispatcherLineItem] = []


class DispatcherDeptSummaryRow(BaseModel):
    department: str
    total_lines: int
    total_qty_sent: int
    lines_fully_returned: int
    lines_partially_returned: int
    lines_pending: int
    nr_lines: int
    oldest_pending_days: Optional[int] = None
    overdue_lines: int


class DispatcherReportSummary(BaseModel):
    total_passes: int
    total_lines: int
    total_qty_sent: int
    departments: int
    pending_lines: int
    overdue_lines: int


class DispatcherReportResponse(BaseModel):
    financial_year: str
    summary: DispatcherReportSummary
    rows: List[DispatcherDetailRow]
    department_summary: List[DispatcherDeptSummaryRow]
