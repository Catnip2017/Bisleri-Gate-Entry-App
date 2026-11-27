from pydantic import BaseModel,EmailStr,StringConstraints
from datetime import datetime
from typing import List, Optional,Annotated

class GatePassLocationAssignment(BaseModel):
    location_code: str
    is_default: bool = False


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
    # Gate Pass scope at registration time (same shape as Assign Access /
    # modify-user): department for Gate Pass Creators, and a multi-location
    # list with one starred default shared by Creator + Dispatcher roles.
    department: Optional[str] = None
    gate_pass_locations: Optional[List[GatePassLocationAssignment]] = None
    # Blinkit Inventory Portal mapping (26 Nov 2026)
    inventory_warehouses: Optional[List[str]] = None   # operator + viewer
    inventory_stores: Optional[List[str]] = None       # operator only (blinkit_stores.store_code)
    store_code: Optional[str] = None                   # viewer only (blinkit_stores.store_code)


class InventoryAccessUpdate(BaseModel):
    warehouses: List[str] = []
    stores: List[str] = []
    store_code: Optional[str] = None

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
    department: Optional[str] = None
    gate_pass_location: Optional[str] = None                       # legacy single
    gate_pass_locations: Optional[List[GatePassLocationAssignment]] = None  # multi (wins)
    is_active: Optional[bool] = None                                # deactivate-don't-delete

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
    warehouse_code: Optional[str] = None
    warehouse_name: Optional[str] = None
    site_code: Optional[str] = None
    copacker_location: Optional[str] = None
    department: Optional[str] = None
    gate_pass_location: Optional[str] = None
    is_active: Optional[bool] = True
    last_login: Optional[datetime] = None   # users_master.last_login (stored UTC)
    # 27 Nov 2026: "ok" | "needs_update" | "not_checked"; None before migration a7c3e5d1f9b2
    password_status: Optional[str] = None

    class Config:
        from_attributes = True
