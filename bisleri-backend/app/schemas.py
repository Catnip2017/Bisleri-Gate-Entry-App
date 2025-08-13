from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    username: str
    first_name: str
    last_name: str
    role: str
    warehouse_code: str
    site_code: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    last_login: Optional[datetime]
    
    class Config:
        orm_code = True

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenData(BaseModel):
    username: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class GateEntryCreate(BaseModel):
    gate_type: str  # "Gate-In" or "Gate-Out"
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