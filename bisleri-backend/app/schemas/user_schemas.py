from pydantic import BaseModel,EmailStr,StringConstraints
from datetime import datetime
from typing import Optional,Annotated

# Fixed USER SCHEMAS - add missing fields and make optional fields truly optional
class UserCreate(BaseModel):
    username: str
    password: str
    first_name: str
    last_name: str
    role: str
    email: Optional[str] = None           # ADDED - was missing
    phone_number: Optional[str] = None    # ADDED - was missing
    warehouse_code: Optional[str] = None  # CHANGED - was required, now optional
    site_code: Optional[str] = None       # CHANGED - was required, now optional

class UserResponse(BaseModel):  # FIXED - removed inheritance to avoid conflicts
    username: str
    first_name: str
    last_name: str
    role: str
    warehouse_code: Optional[str] = ""
    warehouse_name: Optional[str] = ""    # ADDED - was missing
    site_code: Optional[str] = ""
    email: Optional[str] = None           # ADDED - was missing
    phone_number: Optional[str] = None    # ADDED - was missing
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True  # FIXED - was orm_mode

class PasswordReset(BaseModel):
    username: str
    new_password: str
    confirm_password: str

class UserRoleUpdate(BaseModel):
    role: Optional[str] = None
    warehouse_code: Optional[str] = None

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None   # Optional, you can add regex validation if needed



class UserSearchResponse(BaseModel):
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
