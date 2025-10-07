# app/schemas/gate_schemas.py - UPDATED WITH EMPTY VEHICLE SUPPORT
from pydantic import BaseModel, validator
from datetime import datetime
from typing import Optional, List

class GateEntryCreate(BaseModel):
    gate_type: str
    vehicle_no: str
    document_no: Optional[str] = None
    remarks: Optional[str] = None

class GateEntryResponse(BaseModel):
    gate_entry_no: str
    date: datetime
    time: datetime
    vehicle_no: str
    document_no: str
    warehouse_name: str
    movement_type: str

class InsightsFilter(BaseModel):
    from_date: datetime
    to_date: datetime
    site_code: Optional[str] = None
    warehouse_code: Optional[str] = None
    movement_type: Optional[str] = None

# Enhanced schemas for operational data capture
class EnhancedGateEntryCreate(BaseModel):
    gate_type: str = "Gate-In"
    vehicle_no: str  # Mandatory
    document_nos: List[str] = []  # For batch entry
    remarks: Optional[str] = None
    
    # NEW: Optional operational data that can be captured during gate entry
    driver_name: Optional[str] = None
    km_reading: Optional[str] = None
    loader_names: Optional[str] = None

class EnhancedManualGateEntryCreate(BaseModel):
    gate_type: str = "Gate-In"
    vehicle_no: str  # Only this is mandatory
    document_type: Optional[str] = None
    document_no: Optional[str] = None
    document_date: Optional[str] = None
    customer_code: Optional[str] = None
    customer_name: Optional[str] = None
    total_quantity: Optional[str] = None
    transporter_name: Optional[str] = None
    e_way_bill_no: Optional[str] = None
    route_code: Optional[str] = None
    direct_dispatch: Optional[str] = None
    salesman_name: Optional[str] = None
    remarks: Optional[str] = None
    
    # NEW: Operational data fields
    driver_name: Optional[str] = None
    km_reading: Optional[str] = None
    loader_names: Optional[str] = None

# Schema for Manual Gate Entry
class ManualGateEntryCreate(BaseModel):
    gate_type: str = "Gate-In"
    vehicle_no: str  # Only this is mandatory
    document_type: Optional[str] = None
    document_no: Optional[str] = None
    document_date: Optional[str] = None
    customer_code: Optional[str] = None
    customer_name: Optional[str] = None
    total_quantity: Optional[str] = None
    transporter_name: Optional[str] = None
    e_way_bill_no: Optional[str] = None
    route_code: Optional[str] = None
    direct_dispatch: Optional[str] = None
    salesman_name: Optional[str] = None
    remarks: Optional[str] = None

# Schema for Batch Gate Entry
class BatchGateEntryCreate(BaseModel):
    gate_type: str = "Gate-In"
    vehicle_no: str
    document_nos: List[str]
    remarks: Optional[str] = None

# ✅ UPDATED: Schema for Multi-Document Manual Entry with Empty Vehicle Support
class MultiDocumentManualEntryCreate(BaseModel):
    gate_type: str = "Gate-In"
    vehicle_no: str  # Mandatory
    no_of_documents: int = 0  # ✅ CHANGED: Default to 0 for empty vehicle
    remarks: Optional[str] = None
    driver_name: Optional[str] = None
    km_reading: Optional[str] = None
    loader_names: Optional[str] = None
    
    # ✅ UPDATED: Validation for no_of_documents - now allows 0 for empty vehicles
    @validator('no_of_documents')
    def validate_no_of_documents(cls, v):
        if v < 0 or v > 20:  # ✅ CHANGED: Allow 0 for empty vehicle scenario
            raise ValueError('Number of documents must be between 0 and 20')
        return v
    
    @validator('vehicle_no')
    def validate_vehicle_no(cls, v):
        if not v or not v.strip():
            raise ValueError('Vehicle number is required')
        return v.strip().upper()

# ✅ Enhanced edit schema for operational fields
class OperationalDataEdit(BaseModel):
    gate_entry_no: str
    
    # ✅ Operational fields (required for completion)
    driver_name: Optional[str] = None
    km_reading: Optional[str] = None  
    loader_names: Optional[str] = None
    
    # ✅ Optional fields
    remarks: Optional[str] = None
    
    @validator('km_reading')
    def validate_km_reading(cls, v):
        if v is not None:
            v = v.strip()
            if v:
                # Must be numeric and reasonable length
                if not v.isdigit() or len(v) < 3 or len(v) > 6:
                    raise ValueError('KM reading must be 3-6 digits')
                # Reasonable range check (0-999999)
                km_value = int(v)
                if km_value < 0 or km_value > 999999:
                    raise ValueError('KM reading must be between 0 and 999999')
        return v
    
    @validator('driver_name')
    def validate_driver_name(cls, v):
        if v is not None:
            v = v.strip()
            if v and (len(v) < 2 or len(v) > 50):
                raise ValueError('Driver name must be 2-50 characters')
        return v
    
    @validator('loader_names')
    def validate_loader_names(cls, v):
        if v is not None:
            v = v.strip()
            if v:
                # Split by comma and validate each name
                names = [name.strip() for name in v.split(',')]
                valid_names = [name for name in names if name and len(name) >= 2]
                if len(valid_names) != len(names):
                    raise ValueError('Each loader name must be at least 2 characters')
                if len(valid_names) > 10:
                    raise ValueError('Maximum 10 loader names allowed')
                # Return cleaned names
                return ', '.join(valid_names)
        return v

# ✅ Response schema with edit status
class EnhancedMovementResponse(BaseModel):
    # Basic fields
    id: int
    gate_entry_no: str
    document_type: str
    sub_document_type: Optional[str]
    vehicle_no: str
    warehouse_name: str
    date: str
    time: str
    movement_type: str
    remarks: Optional[str]
    warehouse_code: str
    site_code: str
    security_name: str
    security_username: str
    document_date: Optional[str]
    document_age_time: Optional[str]
    
    # ✅ Operational fields
    driver_name: Optional[str]
    km_reading: Optional[str]
    loader_names: Optional[str]
    last_edited_at: Optional[str]
    edit_count: int
    
    # ✅ Edit status information
    edit_status: str  # 'needs_completion', 'editable', 'expired'
    time_remaining: Optional[str]
    is_operational_complete: bool
    missing_fields: List[str]
    can_edit: bool
    edit_button_config: dict

# ✅ Batch operational update schema
class BatchOperationalUpdate(BaseModel):
    gate_entry_numbers: List[str]
    driver_name: Optional[str] = None
    km_reading: Optional[str] = None
    loader_names: Optional[str] = None
    remarks: Optional[str] = None
    
    @validator('gate_entry_numbers')
    def validate_gate_entry_numbers(cls, v):
        if not v or len(v) == 0:
            raise ValueError('At least one gate entry number required')
        if len(v) > 50:
            raise ValueError('Maximum 50 gate entries can be updated at once')
        return v

# ✅ Edit statistics schema
class EditStatistics(BaseModel):
    total_records: int
    needs_completion: int
    complete_and_editable: int
    expired: int
    completion_percentage: float
    
    # Breakdown by time
    within_6_hours: int
    within_12_hours: int
    within_24_hours: int
    
    # Breakdown by missing fields
    missing_driver: int
    missing_km: int
    missing_loaders: int
    
    # Recent activity
    edited_today: int
    most_edited_record: Optional[str]
    avg_edits_per_record: float

# ✅ KM Reading context schema
class KMReadingContext(BaseModel):
    gate_entry_no: str
    movement_type: str  # Gate-In or Gate-Out
    vehicle_no: str
    previous_km_reading: Optional[str]  # Last known KM for this vehicle
    suggested_range: dict  # Min/max reasonable values
    reading_type: str  # 'km_in' or 'km_out'
    
    class Config:
        schema_extra = {
            "example": {
                "gate_entry_no": "ATDVG2025123456",
                "movement_type": "Gate-Out",
                "vehicle_no": "MH12AB1234",
                "previous_km_reading": "45678",
                "suggested_range": {"min": 45678, "max": 46000},
                "reading_type": "km_out"
            }
        }

# NEW: Document assignment schemas
class DocumentAssignmentRequest(BaseModel):
    insights_id: int
    document_no: str
    
    @validator('insights_id')
    def validate_insights_id(cls, v):
        if v <= 0:
            raise ValueError('insights_id must be a positive integer')
        return v
    
    @validator('document_no')
    def validate_document_no(cls, v):
        if not v or not v.strip():
            raise ValueError('document_no is required')
        return v.strip()

class DocumentAssignmentResponse(BaseModel):
    message: str
    insights_id: int
    document_no: str
    gate_entry_no: str
    assigned_at: str
    updated_insights: dict
    updated_document: dict

class UnassignedDocumentsResponse(BaseModel):
    vehicle_no: str
    time_window_hours: int
    search_time: str
    available_count: int
    documents: List[dict]

# ✅ UPDATED: Multi-entry response schema with empty vehicle support
class MultiDocumentManualEntryResponse(BaseModel):
    message: str
    gate_entry_no: str
    vehicle_no: str
    entries_created: int
    movement_type: str
    date: str
    created_entries: List[dict]
    next_step: str
    entry_type: str = "manual"  # ✅ NEW: "empty_vehicle" or "manual"