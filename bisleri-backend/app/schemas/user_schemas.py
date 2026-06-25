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
    email: Optional[str] = None
    phone_number: Optional[str] = None
    warehouse_code: Optional[str] = None
    site_code: Optional[str] = None
    copacker_location: Optional[str] = None

class UserResponse(BaseModel):
    username: str
    first_name: str
    last_name: str
    role: str
    warehouse_code: Optional[str] = ""
    warehouse_name: Optional[str] = ""
    site_code: Optional[str] = ""
    email: Optional[str] = None
    phone_number: Optional[str] = None
    copacker_location: Optional[str] = None
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

class PasswordReset(BaseModel):
    username: str
    new_password: str
    confirm_password: str

class UserRoleUpdate(BaseModel):
    role: Optional[str] = None
    warehouse_code: Optional[str] = None
    copacker_location: Optional[str] = None

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
