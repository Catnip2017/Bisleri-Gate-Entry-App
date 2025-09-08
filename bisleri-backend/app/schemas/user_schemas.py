from pydantic import BaseModel
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
