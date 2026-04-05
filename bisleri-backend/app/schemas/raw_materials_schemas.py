# app/schemas/raw_materials_schemas.py
from pydantic import BaseModel, validator, root_validator
from datetime import datetime
from typing import Optional

class RawMaterialsCreate(BaseModel):
    gate_type: str = "Gate-In"  # Gate-In or Gate-Out
    vehicle_no: str
    document_no: Optional[str] = ""
    name_of_party: Optional[str] = ""
    description_of_material: Optional[str] = ""
    quantity: Optional[str] = ""
    entry_type: Optional[str] = "with_document"  # "with_document" or "empty_vehicle"

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

    @validator('entry_type')
    def validate_entry_type(cls, v):
        allowed = ['with_document', 'empty_vehicle']
        if v not in allowed:
            raise ValueError(f'entry_type must be one of: {allowed}')
        return v

    @validator('document_no', 'name_of_party', 'description_of_material', 'quantity', pre=True, always=True)
    def strip_optional_fields(cls, v):
        if v is None:
            return ""
        return v.strip()

    @root_validator
    def validate_required_fields(cls, values):
        entry_type = values.get('entry_type', 'with_document')

        # document_no is only required when not an empty vehicle
        if entry_type == 'with_document':
            if not values.get('document_no', '').strip():
                raise ValueError('Document number is required')

        # These fields are always required regardless of entry type
        always_required = {
            'name_of_party': 'Name of party',
            'description_of_material': 'Description of material',
            'quantity': 'Quantity',
        }
        for field, label in always_required.items():
            if not values.get(field, '').strip():
                raise ValueError(f'{label} is required')

        return values

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