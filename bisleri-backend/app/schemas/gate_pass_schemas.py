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


class PartyResponse(BaseModel):
    party_code: str
    party_name: str
    city: Optional[str] = None
    post_code: Optional[str] = None
    phone_no: Optional[str] = None
    contact: Optional[str] = None

    class Config:
        from_attributes = True


class ItemResponse(BaseModel):
    item_code: str
    item_name: str
    fa_class_code: Optional[str] = None

    class Config:
        from_attributes = True


class CancelReasonResponse(BaseModel):
    id: int
    reason_text: str

    class Config:
        from_attributes = True


# ── Create ───────────────────────────────────────────────────────────────────
class GatePassLineCreate(BaseModel):
    item_code: Optional[str] = None
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
    item_code: Optional[str] = None
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
