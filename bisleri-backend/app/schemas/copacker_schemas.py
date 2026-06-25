# app/schemas/copacker_schemas.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time, datetime


# ── Feature status ──────────────────────────────────────────────────────────
class FeatureStatusResponse(BaseModel):
    enabled: bool
    field_edit_enabled: bool = False


# ── Locations ───────────────────────────────────────────────────────────────
class RegisterLocationRequest(BaseModel):
    location_name: str


class LocationResponse(BaseModel):
    id: int
    location_name: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Assets ──────────────────────────────────────────────────────────────────
class RegisterAssetRequest(BaseModel):
    location_name: str
    line_no: int
    asset_model_id: str


class AssetResponse(BaseModel):
    id: int
    location_id: int
    line_no: int
    asset_model_id: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── SKU search ──────────────────────────────────────────────────────────────
class SKUItem(BaseModel):
    item_number: str
    product_name: str

    class Config:
        from_attributes = True


# ── Entries ─────────────────────────────────────────────────────────────────
class EntryResponse(BaseModel):
    id: int
    copacker_location: str
    line_no: int
    asset_model_id: str
    entry_date: date
    entry_time: time
    image_path: Optional[str] = None
    sku_name: Optional[str] = None
    sku_itemid: Optional[str] = None
    username: str
    # Legacy
    extracted_quantity: Optional[int] = None
    extracted_quantity_raw: Optional[int] = None
    # Multi-field OCR
    preform_total:   Optional[int] = None
    preform_shift:   Optional[int] = None
    bottles_total:   Optional[int] = None
    bottles_shift:   Optional[int] = None
    operating_hours: Optional[int] = None
    recipe:          Optional[str] = None
    asset_model_no:  Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Edit quantity (legacy) ───────────────────────────────────────────────────
class EditQuantityRequest(BaseModel):
    entry_id: int
    new_quantity: int


class EditQuantityResponse(BaseModel):
    entry_id: int
    original_value: Optional[int]
    new_value: int
    auto_remarks: str
    edited_by: str
    edited_at: datetime


# ── Edit field (new multi-field) ─────────────────────────────────────────────
class EditFieldRequest(BaseModel):
    entry_id: int
    field_name: str   # e.g. "preform_total", "recipe", "asset_model_no"
    new_value: str    # always string; backend converts to int where needed


class EditFieldResponse(BaseModel):
    entry_id: int
    field_name: str
    original_value: Optional[str]
    new_value: str
    auto_remarks: str
    edited_by: str
    edited_at: datetime


# ── Edit logs (admin view) ───────────────────────────────────────────────────
class EditLogResponse(BaseModel):
    id: int
    entry_id: int
    original_value: Optional[int]
    edited_value: int
    edited_by: str
    edited_at: Optional[datetime]
    auto_remarks: Optional[str]

    # Joined entry details
    copacker_location: Optional[str] = None
    line_no: Optional[int] = None
    asset_model_id: Optional[str] = None
    entry_date: Optional[date] = None
    entry_username: Optional[str] = None

    class Config:
        from_attributes = True


# ── Phase 2: Session-based capture system ────────────────────────────────────

class CreateSessionRequest(BaseModel):
    copacker_location: str
    line_no: int
    sku_name:         Optional[str] = None
    sku_item_id:      Optional[str] = None
    shift_no:         Optional[int] = None   # 1 / 2 / 3
    shift_start_time: Optional[str] = None   # "HH:MM" 24-hr
    shift_end_time:   Optional[str] = None   # "HH:MM" 24-hr


class CaptureResponse(BaseModel):
    id: int
    session_id: int
    step_order: int
    capture_type: str
    asset_model_id: Optional[str] = None
    image_path: Optional[str] = None
    # Blow Molder
    bottle_recipe:                  Optional[str] = None
    last_hour_production_count:     Optional[int] = None
    production_count_current_batch: Optional[int] = None
    total_production_count:         Optional[int] = None
    good_bottles_count:             Optional[int] = None
    preforms_processed_count:       Optional[int] = None
    target_batch_quantity:          Optional[int] = None
    # Bottling
    bottles_total:        Optional[int] = None
    production_speed_bph: Optional[int] = None
    # Labelling
    labels_count:  Optional[int] = None
    label_format:  Optional[str] = None
    # Case Counter
    packs_counter: Optional[int] = None
    pack_format:   Optional[str] = None
    captured_at:   Optional[datetime] = None

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    id: int
    copacker_location: str
    line_no: int
    sku_name:         Optional[str] = None
    sku_item_id:      Optional[str] = None
    status:           str
    submitted_by:     str
    shift_no:         Optional[int] = None
    shift_start_time: Optional[str] = None
    shift_end_time:   Optional[str] = None
    created_at:       Optional[datetime] = None
    completed_at:     Optional[datetime] = None
    captures: List[CaptureResponse] = []

    class Config:
        from_attributes = True


class EditAssetRequest(BaseModel):
    capture_id: int
    new_asset_model_id: str


class EditAssetResponse(BaseModel):
    capture_id: int
    original_value: Optional[str]
    new_value: str
    edited_by: str
    edited_at: datetime


class AssetHistoryItem(BaseModel):
    asset_model_id: str
    last_used: Optional[datetime] = None
