from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List
import traceback
import logging
from typing import Optional
from datetime import datetime, timedelta, date
from app.database import get_db
from app.models import UsersMaster, LocationMaster, InsightsData, RawMaterialsData
from app.models.gate_pass import UserGatePassLocation
from app.schemas import UserCreate, UserResponse, PasswordReset, UserRoleUpdate, UserUpdate,UserSearchResponse
from app.auth import get_current_user, get_password_hash
from app.utils.errors import internal_error
from sqlalchemy import and_, case, distinct, func, or_
from app.utils.roles import normalize_roles, normalize_role_list, validate_role_combo

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin Operations"])

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
            raise HTTPException(status_code=409, detail="Username already exists. Please choose a different username.")

        # ✅ Optional duplicate email check
        if user.email and db.query(UsersMaster).filter(UsersMaster.email == user.email).first():
            raise HTTPException(status_code=409, detail="Email already exists. Please use a different email address.")

        # ✅ Optional duplicate phone number check
        if user.phone_number and db.query(UsersMaster).filter(UsersMaster.phone_number == user.phone_number).first():
            raise HTTPException(status_code=409, detail="Mobile number already exists. Please use a different number.")

        roles_requested = [r.strip() for r in user.role.split(",")]
        normalized_roles = normalize_role_list(roles_requested)

        # ✅ Role combo rules (LOCKED 14 Jul 2026 — structural SOD, see roles.py)
        combo_error = validate_role_combo(normalized_roles)
        if combo_error:
            raise HTTPException(status_code=400, detail=combo_error)

        needs_warehouse = "securityguard" in normalized_roles
        needs_copacker_location = "copacker" in normalized_roles

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

        # ✅ Copacker location handling
        final_copacker_location = None
        if needs_copacker_location:
            if not user.copacker_location or not user.copacker_location.strip():
                raise HTTPException(
                    status_code=400,
                    detail="CoPacker Location is required when registering a Co Packer user."
                )
            from app.models.copacker import CopackerLocation
            loc = db.query(CopackerLocation).filter(
                CopackerLocation.location_name == user.copacker_location.strip()  # ← changed from .ilike() to ==
            ).first()
            if not loc:
                raise HTTPException(
                    status_code=400,
                    detail=f"CoPacker location '{user.copacker_location}' does not exist. Please register it first."
                )
            final_copacker_location = loc.location_name

        # ✅ Create user
        new_user = UsersMaster(
            username=user.username.strip(),
            first_name=user.first_name.strip(),
            last_name=user.last_name.strip(),
            role=", ".join(roles_requested),
            warehouse_code=user.warehouse_code if needs_warehouse else None,
            warehouse_name=warehouse_name,
            site_code=final_site_code,
            copacker_location=final_copacker_location,
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

    except IntegrityError as e:
        db.rollback()
        err = str(e.orig).lower()
        if "username" in err:
            raise HTTPException(status_code=409, detail="Username already exists. Please choose a different username.")
        elif "email" in err:
            raise HTTPException(status_code=409, detail="Email already exists. Please use a different email address.")
        elif "phone" in err:
            raise HTTPException(status_code=409, detail="Mobile number already exists. Please use a different number.")
        else:
            raise HTTPException(status_code=409, detail="Duplicate entry. A record with these details already exists.")

    except HTTPException:
        raise  # keep original 400 / 403 errors intact

    except Exception as e:
        db.rollback()
        print("Unexpected Error:", e)
        raise HTTPException(status_code=500, detail="Internal server error")

# ✅ Reset Password
@router.post("/reset-password")
def reset_password(
    reset_data: PasswordReset,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    try:
        roles = normalize_roles(current_user.role)
        if "itadmin" not in roles:
            raise HTTPException(status_code=403, detail="Only ITAdmins can reset passwords")

        user = db.query(UsersMaster).filter(UsersMaster.username.ilike(reset_data.username.strip())).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

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
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Q16: paginated; ordered by username so pages are deterministic."""
    roles = normalize_roles(current_user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail="Only ITAdmins can list users")
    return (
        db.query(UsersMaster)
        .order_by(UsersMaster.username)
        .offset(skip)
        .limit(limit)
        .all()
    )

# ✅ Get User
@router.get("/user/{username}", response_model=UserResponse)
def get_user(username: str, db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    roles = normalize_roles(current_user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail="Only ITAdmins can fetch user details")

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



# ✅ Warehouses
@router.get("/warehouses")
def get_warehouses(db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    roles = normalize_roles(current_user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail=f"Only ITAdmin can fetch warehouses. Your roles: {current_user.role}")

    warehouses = db.query(LocationMaster).all()
    if not warehouses:
        raise HTTPException(status_code=404, detail="No warehouses found")

    return [
        {"warehouse_code": w.warehouse_code, "warehouse_name": w.warehouse_name, "site_code": w.site_code, "warehouse_id": w.warehouse_id or w.warehouse_code}
        for w in warehouses
    ]

# ✅ Modify User
@router.get("/user-gp-locations/{username}")
def get_user_gp_locations(username: str, db: Session = Depends(get_db),
                          current_user: UsersMaster = Depends(get_current_user)):
    """Junction rows for one user (Assign Access screen). Falls back to the
    legacy users_master.gate_pass_location column."""
    roles = normalize_roles(current_user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail="Only ITAdmins can view user assignments")
    rows = (
        db.query(UserGatePassLocation)
        .filter(UserGatePassLocation.username == username)
        .order_by(UserGatePassLocation.is_default.desc(), UserGatePassLocation.location_code)
        .all()
    )
    if rows:
        return {"locations": [
            {"location_code": r.location_code, "is_default": r.is_default} for r in rows
        ]}
    user = db.query(UsersMaster).filter(UsersMaster.username == username).first()
    if user and user.gate_pass_location:
        return {"locations": [{"location_code": user.gate_pass_location, "is_default": True}]}
    return {"locations": []}


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
        normalized_new_roles = normalize_role_list(roles_cleaned)

        # Role combo rules (LOCKED 14 Jul 2026 — structural SOD, see roles.py)
        combo_error = validate_role_combo(normalized_new_roles)
        if combo_error:
            raise HTTPException(status_code=400, detail=combo_error)

        # Gate Pass Creator requires a fixed department + >=1 location for
        # EVERY holder (ITA included — no bypass, per locked spec).
        if "gatepasscreator" in normalized_new_roles:
            dept_after = update_data.department if update_data.department is not None else user.department
            if not dept_after:
                raise HTTPException(status_code=400,
                    detail="Department is required for the Gate Pass Creator role.")
            locs_after = update_data.gate_pass_locations
            if locs_after is not None and len(locs_after) == 0:
                raise HTTPException(status_code=400,
                    detail="At least one Gate Pass Location is required for the Gate Pass Creator role.")

        user.role = ", ".join(roles_cleaned)

        # Handle copacker_location when assigning Co Packer role
        if "copacker" in normalized_new_roles:
            if not update_data.copacker_location or not update_data.copacker_location.strip():
                raise HTTPException(
                    status_code=400,
                    detail="CoPacker Location is required when assigning Co Packer role."
                )
            from app.models.copacker import CopackerLocation
            loc = db.query(CopackerLocation).filter(
                CopackerLocation.location_name.ilike(update_data.copacker_location.strip())
            ).first()
            if not loc:
                raise HTTPException(
                    status_code=400,
                    detail=f"CoPacker location '{update_data.copacker_location}' does not exist. Please register it first."
                )
            user.copacker_location = loc.location_name
        else:
            # Clear copacker_location when switching away from Co Packer role
            user.copacker_location = None

    # Handle warehouse update (Security Guard / Security Admin scope)
    if update_data.warehouse_code is not None:
        if update_data.warehouse_code:
            warehouse = db.query(LocationMaster).filter(
                LocationMaster.warehouse_code == update_data.warehouse_code.strip()
            ).first()
            if warehouse:
                user.warehouse_code = warehouse.warehouse_code
                user.warehouse_name = warehouse.warehouse_name
                user.site_code = warehouse.site_code
        else:
            user.warehouse_code = None
            user.warehouse_name = None
            user.site_code = None

    # Handle is_active (deactivate-don't-delete). Self-deactivation is
    # blocked so the last IT Admin can't lock everyone out with a misclick.
    if update_data.is_active is not None:
        if update_data.is_active is False and user.username == current_user.username:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        user.is_active = update_data.is_active

    # Handle department (Gate Pass User scope)
    if update_data.department is not None:
        user.department = update_data.department or None

    # Handle gate pass locations (Gate Pass User / Security Guard scope).
    # Multi-location list wins when provided; else legacy single value.
    # Junction table and users_master.gate_pass_location are kept in sync
    # (legacy column holds the starred default).
    if update_data.gate_pass_locations is not None:
        locs = update_data.gate_pass_locations
        db.query(UserGatePassLocation).filter(
            UserGatePassLocation.username == user.username).delete()
        default_code = None
        if locs:
            if not any(l.is_default for l in locs):
                locs[0].is_default = True          # guarantee exactly one star
            for l in locs:
                db.add(UserGatePassLocation(
                    username=user.username,
                    location_code=l.location_code,
                    is_default=l.is_default,
                ))
                if l.is_default:
                    default_code = l.location_code
        user.gate_pass_location = default_code
    elif update_data.gate_pass_location is not None:
        user.gate_pass_location = update_data.gate_pass_location or None
        db.query(UserGatePassLocation).filter(
            UserGatePassLocation.username == user.username).delete()
        if user.gate_pass_location:
            db.add(UserGatePassLocation(
                username=user.username,
                location_code=user.gate_pass_location,
                is_default=True,
            ))

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
        copacker_location=user.copacker_location,
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

# ✅ Search Users — IT Admin only
@router.get("/search-users", response_model=List[UserSearchResponse])
def search_users(
    q: str,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    roles = normalize_roles(current_user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail="Only IT Admins can search users")

    if not q:
        return []

    users = (
        db.query(UsersMaster)
        .filter(
            or_(
                UsersMaster.username.ilike(f"%{q}%"),
                UsersMaster.email.ilike(f"%{q}%"),
                UsersMaster.first_name.ilike(f"%{q}%"),
                UsersMaster.last_name.ilike(f"%{q}%"),
            )
        )
        .limit(10)
        .all()
    )
    return users
# ✅ Update User Details — IT Admin only
@router.put("/users/{username}/update")
def update_user_details(
    username: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    roles = normalize_roles(current_user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail="Only IT Admins can update user details")
    user = db.query(UsersMaster).filter(UsersMaster.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # ✅ Update only if payload has value
    if payload.first_name is not None:
        user.first_name = payload.first_name.strip() or None
    if payload.last_name is not None:
        user.last_name = payload.last_name.strip() or None
    if payload.email is not None:
        user.email = payload.email.strip() or None
    if payload.phone_number is not None:
        user.phone_number = payload.phone_number.strip() or None

    db.commit()
    db.refresh(user)
    return {"message": "User details updated successfully"}


@router.get("/admin-dashboard-stats")
def get_dashboard_stats(
    site_code: Optional[str] = None,
    warehouse_code: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: UsersMaster = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    roles = normalize_roles(current_user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail=f"Only ITAdmin can view dashboard stats. Your roles: {current_user.role}")

    try:
        # Build base query
        base_query = db.query(InsightsData)
        
        # Role-based filtering (Security Admin removed 14 Jul 2026)
        if site_code or warehouse_code:
            # IT Admin: apply site/warehouse filters if provided
            if site_code:
                base_query = base_query.filter(InsightsData.site_code == site_code)
            if warehouse_code:
                base_query = base_query.filter(InsightsData.warehouse_code == warehouse_code)
        
        # ✅ Date range filtering (default to last 7 days if not provided);
        # params are typed `date` (Q6 style) so bad input is a 422, not a 500.
        if not from_date or not to_date:
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=7)
        else:
            start_date = from_date
            end_date = to_date
        
        # Half-open range: includes ALL of end_date regardless of the time
        # part (old `<= end_date` only worked because rows store midnight).
        base_query = base_query.filter(
            InsightsData.date >= start_date,
            InsightsData.date < end_date + timedelta(days=1),
        )
        
        # Calculate stats — Q7/Q15: ONE aggregation query instead of
        # 1 count + 4 full-table .all() loads + Python sets. NULLIF drops
        # empty strings, matching the old `if r.vehicle_no` / `if r.gate_entry_no`
        # checks. CASE(...)->NULL rows are skipped by COUNT(DISTINCT).
        today = datetime.now().date()

        def _distinct_entry_no(*conditions):
            return func.count(distinct(case(
                (and_(*conditions), func.nullif(InsightsData.gate_entry_no, ''))
            )))

        stats = base_query.with_entities(
            func.count().label("total_movements"),
            func.count(distinct(func.nullif(InsightsData.vehicle_no, ''))).label("unique_vehicles"),
            _distinct_entry_no(InsightsData.movement_type == "Gate-In").label("gate_in_total"),
            _distinct_entry_no(InsightsData.movement_type == "Gate-Out").label("gate_out_total"),
            _distinct_entry_no(InsightsData.movement_type == "Gate-In",
                               InsightsData.date >= today,
                               InsightsData.date < today + timedelta(days=1)).label("gate_in_today"),
            _distinct_entry_no(InsightsData.movement_type == "Gate-Out",
                               InsightsData.date >= today,
                               InsightsData.date < today + timedelta(days=1)).label("gate_out_today"),
        ).one()

        return {
            "total_movements": stats.total_movements,
            "unique_vehicles": stats.unique_vehicles,
            "gate_in": stats.gate_in_total,
            "gate_out": stats.gate_out_total,
            "today": {
                "gate_in": stats.gate_in_today,
                "gate_out": stats.gate_out_today
            },
            "period": {
                "from_date": start_date.isoformat(),
                "to_date": end_date.isoformat()
            },
            "filters_applied": {
                "site_code": site_code,
                "warehouse_code": warehouse_code
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise internal_error("Failed to calculate stats", e)


# ✅ NEW: Admin RM Statistics with Filtering
@router.get("/admin-rm-statistics")
def get_admin_rm_statistics(
    site_code: Optional[str] = None,
    warehouse_code: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: UsersMaster = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get RM statistics for admin with filtering"""
    try:
        roles = normalize_roles(current_user.role)
        if "itadmin" not in roles:
            raise HTTPException(status_code=403, detail="Access denied")
        
        base_query = db.query(RawMaterialsData)
        
        # Role-based filtering (Security Admin removed 14 Jul 2026)
        if site_code:
            base_query = base_query.filter(RawMaterialsData.site_code == site_code)
        if warehouse_code:
            base_query = base_query.filter(RawMaterialsData.warehouse_code == warehouse_code)
        
        # Date filtering (typed `date` params: bad input -> 422, not 500)
        if not from_date or not to_date:
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=7)
        else:
            start_date = from_date
            end_date = to_date
        
        base_query = base_query.filter(
            func.DATE(RawMaterialsData.date_time) >= start_date,
            func.DATE(RawMaterialsData.date_time) <= end_date
        )
        
        # Q7/Q15: one aggregation instead of loading all rows into Python.
        # NOTE: unique_vehicles keeps the OLD semantics deliberately (plain
        # DISTINCT, empty string counts as a value — the old set() did too).
        rm = base_query.with_entities(
            func.count().label("total_entries"),
            func.count(case((RawMaterialsData.gate_type == "Gate-In", 1))).label("gate_in_count"),
            func.count(case((RawMaterialsData.gate_type == "Gate-Out", 1))).label("gate_out_count"),
            func.count(distinct(RawMaterialsData.vehicle_no)).label("unique_vehicles"),
            func.count(case((func.coalesce(RawMaterialsData.edit_count, 0) > 0, 1))).label("edited_entries"),
        ).one()

        total_entries = rm.total_entries
        gate_in_count = rm.gate_in_count
        gate_out_count = rm.gate_out_count
        unique_vehicles = rm.unique_vehicles
        edited_entries = rm.edited_entries

        return {
            "total_entries": total_entries,
            "gate_in_count": gate_in_count,
            "gate_out_count": gate_out_count,
            "unique_vehicles": unique_vehicles,
            "edited_entries": edited_entries,
            "period": f"{start_date} to {end_date}",
            "filters_applied": {
                "site_code": site_code,
                "warehouse_code": warehouse_code
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise internal_error("Statistics error", e)
