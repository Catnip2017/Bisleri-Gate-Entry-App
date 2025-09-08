# app/schemas.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal
from typing import List

class UserBase(BaseModel):
    username: str
    first_name: str
    last_name: str
    role: str
    warehouse_code: Optional[str] = None
    warehouse_name: Optional[str] = None
    site_code: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str
    first_name: str
    last_name: str
    role: str
    # ✅ FIXED: Make these fields truly optional
    warehouse_code: Optional[str] = None
    site_code: Optional[str] = None

# In user_schemas.py:
class UserResponse(UserBase):
    warehouse_code: Optional[str] = ""
    warehouse_name: Optional[str] = ""
    site_code: Optional[str] = ""
    last_login: Optional[datetime] = None
    
    class Config:
        orm_mode = True
        # Add this to handle None values gracefully
        validate_assignment = True
        use_enum_values = True

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenData(BaseModel):
    username: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

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

class DocumentResponse(BaseModel):
    document_no: str
    document_type: str
    document_date: datetime
    vehicle_no: str
    warehouse_name: str
    customer_name: Optional[str] = None
    total_quantity: float
    e_way_bill_no: Optional[str] = None
    from_warehouse_code: Optional[str] = None
    to_warehouse_code: Optional[str] = None
    sub_document_type: Optional[str] = None
    salesman: Optional[str] = None

class PasswordReset(BaseModel):
    username: str
    new_password: str
    confirm_password: str

class RegisterResponse(BaseModel):
    message: str
    user: UserResponse

class UserRoleUpdate(BaseModel):
    role: Optional[str] = None
    warehouse_code: Optional[str] = None

    class Config:
        orm_mode = True