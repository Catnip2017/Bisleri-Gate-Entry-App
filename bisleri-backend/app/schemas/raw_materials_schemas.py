# app/schemas/raw_materials_schemas.py
from pydantic import BaseModel, validator
from datetime import datetime
from typing import Optional

class RawMaterialsCreate(BaseModel):
    gate_type: str = "Gate-In"  # Gate-In or Gate-Out
    vehicle_no: str
    document_no: str
    name_of_party: str
    description_of_material: str
    quantity: str
    
    @validator('gate_type')
    def validate_gate_type(cls, v):
        if v not in ['Gate-In', 'Gate-Out']:
            raise ValueError('Gate type must be Gate-In or Gate-Out')
        return v
    
    @validator('vehicle_no')
    def validate_vehicle_no(cls, v):
        if not v or not v.strip():
            raise ValueError('Vehicle number is required')
        return v.strip().upper()
    
    @validator('document_no', 'name_of_party', 'description_of_material', 'quantity')
    def validate_required_fields(cls, v):
        if not v or not v.strip():
            raise ValueError('This field is required')
        return v.strip()

class RawMaterialsResponse(BaseModel):
    id: int
    gate_entry_no: str
    gate_type: str
    vehicle_no: str
    document_no: str
    name_of_party: str
    description_of_material: str
    quantity: str
    date_time: datetime
    security_name: str
    security_username: str
    warehouse_code: str
    site_code: str
    last_edited_at: Optional[datetime]
    edit_count: int
    
    class Config:
        orm_mode = True

class RawMaterialsEdit(BaseModel):
    gate_entry_no: str
    vehicle_no: Optional[str] = None
    document_no: Optional[str] = None
    name_of_party: Optional[str] = None
    description_of_material: Optional[str] = None
    quantity: Optional[str] = None
    
    @validator('vehicle_no')
    def validate_vehicle_no(cls, v):
        if v is not None:
            v = v.strip()
            if v and len(v) < 8:
                raise ValueError('Vehicle number must be at least 8 characters')
        return v
    
    @validator('document_no', 'name_of_party', 'description_of_material', 'quantity')
    def validate_fields(cls, v):
        if v is not None:
            v = v.strip()
            if v and len(v) < 1:
                raise ValueError('Field cannot be empty')
        return v