from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List
import traceback
import logging
from app.database import get_db
from app.models import UsersMaster, LocationMaster
from app.schemas.user_schemas import UserCreate, UserResponse, PasswordReset, UserRoleUpdate, UserUpdate,UserSearchResponse
from app.auth import get_current_user, get_password_hash

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin Operations"])

# ✅ Helper to normalize roles
def normalize_roles(role_string: str) -> List[str]:
    if not role_string:
        return []
    return [r.strip().lower().replace(" ", "") for r in role_string.split(",") if r.strip()]

# ✅ ENHANCED: Register User
@router.post("/register", response_model=UserResponse)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    try:
        # ✅ Only IT Admins can create users
        if "itadmin" not in normalize_roles(current_user.role):
            raise HTTPException(status_code=403, detail="Only ITAdmins can register users")

        # ✅ Duplicate username check
        if db.query(UsersMaster).filter(UsersMaster.username == user.username).first():
            raise HTTPException(status_code=400, detail="Username already registered")

        roles_requested = [r.strip() for r in user.role.split(",")]
        needs_warehouse = any(r.lower().replace(" ", "") in ["securityadmin", "securityguard"] for r in roles_requested)

        # ❌ Removed requires_email check
        # ❌ Removed duplicate email check

        # ✅ Warehouse handling
        warehouse_name, final_site_code = None, None
        if needs_warehouse:
            if not user.warehouse_code:
                raise HTTPException(status_code=400, detail="Warehouse code is required for security roles")
            warehouse = db.query(LocationMaster).filter(LocationMaster.warehouse_code == user.warehouse_code).first()
            if not warehouse:
                raise HTTPException(status_code=400, detail="Invalid warehouse code")
            warehouse_name = warehouse.warehouse_name
            final_site_code = warehouse.site_code

        # ✅ Create user (email & phone_number stored only if provided in request body)
        new_user = UsersMaster(
            username=user.username.strip(),
            first_name=user.first_name.strip(),
            last_name=user.last_name.strip(),
            role=", ".join(roles_requested),
            warehouse_code=user.warehouse_code if needs_warehouse else None,
            warehouse_name=warehouse_name,
            site_code=final_site_code,
            password=get_password_hash(user.password),
           email=user.email.strip() if user.email else None,
           phone_number=user.phone_number.strip() if user.phone_number else None

        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return UserResponse(
            username=new_user.username,
            first_name=new_user.first_name,
            last_name=new_user.last_name,
            role=new_user.role,
            warehouse_code=new_user.warehouse_code or "",
            warehouse_name=new_user.warehouse_name or "",
            site_code=new_user.site_code or "",
            last_login=None,
            email=new_user.email,
            phone_number=new_user.phone_number
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test-admin")
def test_admin_router():
    return {"message": "Admin router is working", "status": "success"}

# ✅ Reset Password
@router.post("/reset-password")
def reset_password(
    reset_data: PasswordReset,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    try:
        roles = normalize_roles(current_user.role)
        if not any(r in ["itadmin", "securityadmin"] for r in roles):
            raise HTTPException(status_code=403, detail="Only ITAdmins or SecurityAdmins can reset passwords")

        user = db.query(UsersMaster).filter(UsersMaster.username.ilike(reset_data.username.strip())).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if "securityadmin" in roles and user.warehouse_code != current_user.warehouse_code:
            raise HTTPException(status_code=403, detail="Cannot reset password outside your warehouse")

        if reset_data.new_password != reset_data.confirm_password:
            raise HTTPException(status_code=400, detail="Passwords do not match")

        user.password = get_password_hash(reset_data.new_password)
        db.commit()
        return {"message": f"Password updated successfully for user {user.username}"}
    except:
        db.rollback()
        raise

# ✅ List Users
@router.get("/list-users", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    roles = normalize_roles(current_user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail="Only ITAdmins can list users")
    return db.query(UsersMaster).all()

# ✅ Get User
@router.get("/user/{username}", response_model=UserResponse)
def get_user(username: str, db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    roles = normalize_roles(current_user.role)
    if not any(r in ["itadmin", "securityadmin"] for r in roles):
        raise HTTPException(status_code=403, detail="Only ITAdmins or SecurityAdmins can fetch user details")

    user = db.query(UsersMaster).filter(UsersMaster.username.ilike(username.strip())).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        warehouse_code=user.warehouse_code or "",
        warehouse_name=user.warehouse_name or "",
        site_code=user.site_code or "",
        last_login=getattr(user, "last_login", None)
    )

# ✅ Admin Dashboard
@router.get("/admin-dashboard-stats")
def get_dashboard_stats(current_user: UsersMaster = Depends(get_current_user)):
    roles = normalize_roles(current_user.role)
    if not any(r in ["securityadmin", "itadmin"] for r in roles):
        raise HTTPException(status_code=403, detail=f"Only Admin/ITAdmin can view dashboard stats. Your roles: {current_user.role}")

    return {
        "total_movements": 50,
        "unique_vehicles": 20,
        "gate_in": 30,
        "gate_out": 20,
    }

# ✅ Warehouses
@router.get("/warehouses")
def get_warehouses(db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    roles = normalize_roles(current_user.role)
    if not any(r in ["securityadmin", "itadmin"] for r in roles):
        raise HTTPException(status_code=403, detail=f"Only Admin/ITAdmin can fetch warehouses. Your roles: {current_user.role}")

    warehouses = db.query(LocationMaster).all()
    if not warehouses:
        raise HTTPException(status_code=404, detail="No warehouses found")

    return [
        {"warehouse_code": w.warehouse_code, "warehouse_name": w.warehouse_name, "site_code": w.site_code, "warehouse_id": w.warehouse_id or w.warehouse_code}
        for w in warehouses
    ]

# ✅ Modify User
@router.put("/modify-user/{username}", response_model=UserResponse)
def modify_user(username: str, update_data: UserRoleUpdate, db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    roles = normalize_roles(current_user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail="Only ITAdmins can modify users")

    user = db.query(UsersMaster).filter(UsersMaster.username.ilike(username.strip())).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if update_data.role:
        roles_cleaned = [r.strip() for r in update_data.role.split(",")]
        user.role = ", ".join(roles_cleaned)

    db.commit()
    db.refresh(user)

    return UserResponse(
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        warehouse_code=user.warehouse_code or "",
        warehouse_name=user.warehouse_name or "",
        site_code=user.site_code or "",
        last_login=getattr(user, "last_login", None)
    )

# ✅ Delete User
@router.delete("/user/{username}/delete")
def delete_user(username: str, db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    roles = normalize_roles(current_user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail="Only ITAdmins can delete users")

    user = db.query(UsersMaster).filter(UsersMaster.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": f"User {username} deleted successfully"}

# ✅ Search Users
@router.get("/search-users", response_model=List[UserSearchResponse])
def search_users(q: str, db: Session = Depends(get_db)):
    if not q:
        return []

    users = (
        db.query(UsersMaster)
        .filter(UsersMaster.username.ilike(f"%{q}%"))
        .limit(10)
        .all()
    )
    return users   # ✅ FastAPI will auto-convert ORM to schema

 # ✅ Edit User Details (Name, Email, Phone)
# ✅ Update User Details (edit user info, not just roles)
@router.put("/users/{username}/update")
def update_user_details(username: str, payload: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(UsersMaster).filter(UsersMaster.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.first_name = payload.first_name
    user.last_name = payload.last_name
    user.email = payload.email
    user.phone_number = payload.phone_number

    db.commit()
    db.refresh(user)
    return {"message": "User details updated successfully"}
