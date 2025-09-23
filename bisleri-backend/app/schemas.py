# # from pydantic import BaseModel, EmailStr
# # from datetime import datetime
# # from typing import Optional

# # class UserBase(BaseModel):
# #     username: str
# #     first_name: str
# #     last_name: str
# #     role: str
# #     warehouse_code: Optional[str] = None
# #     warehouse_name: Optional[str] = None
# #     site_code: Optional[str] = None
# #     email: Optional[EmailStr] = None           # ✅ optional for Security Guard
# #     phone_number: Optional[str] = None      

# # class UserCreate(BaseModel):
# #     username: str
# #     password: str
# #     first_name: str
# #     last_name: str
# #     role: str
# #     email: Optional[EmailStr] = None       # Changed from str to EmailStr
# #     phone_number: Optional[str] = None    # ADD THIS LINE
# #     warehouse_code: Optional[str] = None
# #     site_code: Optional[str] = None


# # class UserResponse(UserBase):
# #     warehouse_code: Optional[str] = ""
# #     warehouse_name: Optional[str] = ""
# #     site_code: Optional[str] = ""
# #     last_login: Optional[datetime] = None
# #     email: Optional[str] = None           # ADD THIS IF MISSING
# #     phone_number: Optional[str] = None    # ADD 

# #     class Config:
# #         orm_mode = True
# #         validate_assignment = True
# #         use_enum_values = True


# # class LoginRequest(BaseModel):
# #     username: str
# #     password: str


# # class TokenData(BaseModel):
# #     username: Optional[str] = None


# # class Token(BaseModel):
# #     access_token: str
# #     token_type: str


# # class GateEntryCreate(BaseModel):
# #     gate_type: str
# #     vehicle_no: str
# #     document_no: Optional[str] = None
# #     remarks: Optional[str] = None


# # class GateEntryResponse(BaseModel):
# #     gate_entry_no: str
# #     date: datetime
# #     time: datetime
# #     vehicle_no: str
# #     document_no: str
# #     warehouse_name: str
# #     movement_type: str


# # class InsightsFilter(BaseModel):
# #     from_date: datetime
# #     to_date: datetime
# #     site_code: Optional[str] = None
# #     warehouse_code: Optional[str] = None
# #     movement_type: Optional[str] = None


# # class DocumentResponse(BaseModel):
# #     document_no: str
# #     document_type: str
# #     document_date: datetime
# #     vehicle_no: str
# #     warehouse_name: str
# #     customer_name: Optional[str] = None
# #     total_quantity: float
# #     e_way_bill_no: Optional[str] = None
# #     from_warehouse_code: Optional[str] = None
# #     to_warehouse_code: Optional[str] = None
# #     sub_document_type: Optional[str] = None
# #     salesman: Optional[str] = None


# # class PasswordReset(BaseModel):
# #     username: str
# #     new_password: str
# #     confirm_password: str


# # class RegisterResponse(BaseModel):
# #     message: str
# #     user: UserResponse


# # class UserRoleUpdate(BaseModel):
# #     role: Optional[str] = None
# #     warehouse_code: Optional[str] = None

# #     class Config:
# #         orm_mode = True
    

# from pydantic import BaseModel, EmailStr
# from datetime import datetime
# from typing import Optional

# # ---------- USER SCHEMAS ----------
# class UserBase(BaseModel):
#     username: str
#     first_name: str
#     last_name: str
#     role: str
#     warehouse_code: Optional[str] = None
#     warehouse_name: Optional[str] = None
#     site_code: Optional[str] = None
#     email: Optional[str] = None   # ✅ optional
#     phone_number: Optional[str] = None # ✅ optional

# class UserCreate(BaseModel):
#     username: str
#     password: str
#     first_name: str
#     last_name: str
#     role: str
#     email: Optional[str] = None
#     phone_number: Optional[str] = None
#     warehouse_code: Optional[str] = None
#     site_code: Optional[str] = None

# class UserResponse(UserBase):
#     warehouse_code: Optional[str] = ""
#     warehouse_name: Optional[str] = ""
#     site_code: Optional[str] = ""
#     last_login: Optional[datetime] = None
#     email: Optional[str] = None
#     phone_number: Optional[str] = None

#     class Config:
#         orm_mode = True
#         validate_assignment = True
#         use_enum_values = True

# # ---------- AUTH SCHEMAS ----------
# class LoginRequest(BaseModel):
#     username: str
#     password: str

# class TokenData(BaseModel):
#     username: Optional[str] = None

# class Token(BaseModel):
#     access_token: str
#     token_type: str

# # ---------- GATE ENTRY ----------
# class GateEntryCreate(BaseModel):
#     gate_type: str
#     vehicle_no: str
#     document_no: Optional[str] = None
#     remarks: Optional[str] = None

# class GateEntryResponse(BaseModel):
#     gate_entry_no: str
#     date: datetime
#     time: datetime
#     vehicle_no: str
#     document_no: str
#     warehouse_name: str
#     movement_type: str

# # ---------- INSIGHTS ----------
# class InsightsFilter(BaseModel):
#     from_date: datetime
#     to_date: datetime
#     site_code: Optional[str] = None
#     warehouse_code: Optional[str] = None
#     movement_type: Optional[str] = None

# # ---------- DOCUMENTS ----------
# class DocumentResponse(BaseModel):
#     document_no: str
#     document_type: str
#     document_date: datetime
#     vehicle_no: str
#     warehouse_name: str
#     customer_name: Optional[str] = None
#     total_quantity: float
#     e_way_bill_no: Optional[str] = None
#     from_warehouse_code: Optional[str] = None
#     to_warehouse_code: Optional[str] = None
#     sub_document_type: Optional[str] = None
#     salesman: Optional[str] = None

# # ---------- PASSWORD RESET ----------
# class PasswordReset(BaseModel):
#     username: str
#     new_password: str
#     confirm_password: str

# # ---------- REGISTER RESPONSE ----------
# class RegisterResponse(BaseModel):
#     message: str
#     user: UserResponse

# # ---------- ROLE UPDATE ----------
# class UserRoleUpdate(BaseModel):
#     role: Optional[str] = None
#     warehouse_code: Optional[str] = None

#     class Config:
#         orm_mode = True
     

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# ---------- USER SCHEMAS ----------
class UserBase(BaseModel):
    username: str
    first_name: str
    last_name: str
    role: str
    warehouse_code: Optional[str] = None
    warehouse_name: Optional[str] = None
    site_code: Optional[str] = None
    email: Optional[str] = None   # ✅ optional
    phone_number: Optional[str] = None # ✅ optional

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

class UserResponse(UserBase):
    warehouse_code: Optional[str] = ""
    warehouse_name: Optional[str] = ""
    site_code: Optional[str] = ""
    last_login: Optional[datetime] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None

    class Config:
        from_attributes = True          # ✅ instead of orm_mode
        validate_assignment = True
        use_enum_values = True

# ---------- AUTH SCHEMAS ----------
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenData(BaseModel):
    username: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

# ---------- GATE ENTRY ----------
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

# ---------- INSIGHTS ----------
class InsightsFilter(BaseModel):
    from_date: datetime
    to_date: datetime
    site_code: Optional[str] = None
    warehouse_code: Optional[str] = None
    movement_type: Optional[str] = None

# ---------- DOCUMENTS ----------
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

# ---------- PASSWORD RESET ----------
class PasswordReset(BaseModel):
    username: str
    new_password: str
    confirm_password: str

# ---------- REGISTER RESPONSE ----------
class RegisterResponse(BaseModel):
    message: str
    user: UserResponse

# ---------- ROLE UPDATE ----------
class UserRoleUpdate(BaseModel):
    role: Optional[str] = None
    warehouse_code: Optional[str] = None

    class Config:
        from_attributes = True   # ✅ updated for Pydantic v2
