from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    username: str
    first_name: str
    last_name: str
    role: str
    warehouse_code: Optional[str] = None
    site_code: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    last_login: Optional[datetime] = None

    class Config:
        orm_mode = True  # fixed typo

class PasswordReset(BaseModel):
    username: str
    new_password: str
    confirm_password: str

# ✅ Add this for role updates
class UserRoleUpdate(BaseModel):
    role: Optional[str] = None
    warehouse_code: Optional[str] = None

    class Config:
        orm_mode = True
