# from pydantic import BaseModel
# from datetime import datetime
# from typing import Optional

# class UserBase(BaseModel):
#     username: str
#     first_name: str
#     last_name: str
#     role: str
#     warehouse_code: str
#     site_code: str

# class UserCreate(UserBase):
#     password: str

# class UserResponse(UserBase):
#     last_login: Optional[datetime]
    
#     class Config:
#         orm_code = True

# class PasswordReset(BaseModel):
#     username: str
#     new_password: str
#     confirm_password: str

# # ✅ Add this for role updates
# class UserRoleUpdate(BaseModel):
#     role: Optional[str] = None
#     warehouse_code: Optional[str] = None

#     class Config:
#         orm_mode = True

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
    first_name: str
    last_name: str
    email: EmailStr
    phone_number: Annotated[str, StringConstraints(pattern=r'^\d{10}$')]



class UserSearchResponse(BaseModel):
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None


# Keep all your other existing schemas below (LoginRequest, Token, GateEntryCreate, etc.)
# ... rest of your schemas.py file unchanged
