from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List
import traceback
import logging
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models import UsersMaster, LocationMaster, InsightsData, RawMaterialsData
from app.schemas import UserCreate, UserResponse, PasswordReset, UserRoleUpdate, UserUpdate,UserSearchResponse
from app.auth import get_current_user, get_password_hash
from sqlalchemy import func

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
@router.put("/users/{username}/update")
def update_user_details(username: str, payload: UserUpdate, db: Session = Depends(get_db)):
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
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: UsersMaster = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    roles = normalize_roles(current_user.role)
    if not any(r in ["securityadmin", "itadmin"] for r in roles):
        raise HTTPException(status_code=403, detail=f"Only Admin/ITAdmin can view dashboard stats. Your roles: {current_user.role}")

    try:
        # Build base query
        base_query = db.query(InsightsData)
        
        # ✅ NEW: Role-based filtering
        if "securityadmin" in roles and "itadmin" not in roles:
            # Security Admin: only their warehouse
            base_query = base_query.filter(InsightsData.warehouse_code == current_user.warehouse_code)
        elif site_code or warehouse_code:
            # IT Admin: apply site/warehouse filters if provided
            if site_code:
                base_query = base_query.filter(InsightsData.site_code == site_code)
            if warehouse_code:
                base_query = base_query.filter(InsightsData.warehouse_code == warehouse_code)
        
        # ✅ NEW: Date range filtering (default to last 7 days if not provided)
        if not from_date or not to_date:
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=7)
        else:
            start_date = datetime.strptime(from_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(to_date, '%Y-%m-%d').date()
        
        base_query = base_query.filter(
            InsightsData.date >= start_date,
            InsightsData.date <= end_date
        )
        
        # Calculate stats
        today = datetime.now().date()
        today_query = base_query.filter(InsightsData.date == today)
        
        total_movements = base_query.count()
        unique_vehicles = len(set([r.vehicle_no for r in base_query.all() if r.vehicle_no]))
        
        gate_in_today = today_query.filter(InsightsData.movement_type == "Gate-In").count()
        gate_out_today = today_query.filter(InsightsData.movement_type == "Gate-Out").count()
        
        gate_in_total = base_query.filter(InsightsData.movement_type == "Gate-In").count()
        gate_out_total = base_query.filter(InsightsData.movement_type == "Gate-Out").count()
        
        return {
            "total_movements": total_movements,
            "unique_vehicles": unique_vehicles,
            "gate_in": gate_in_total,
            "gate_out": gate_out_total,
            "today": {
                "gate_in": gate_in_today,
                "gate_out": gate_out_today
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
        
    except Exception as e:
        print(f"Error calculating dashboard stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate stats: {str(e)}")

# ✅ ENHANCED: Filtered Movements for Admin
@router.post("/filtered-movements")
def get_admin_filtered_movements(
    filters: dict,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Enhanced filtered movements for admin with proper role-based access"""
    try:
        roles = normalize_roles(current_user.role)
        if not any(r in ["securityadmin", "itadmin"] for r in roles):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Build dynamic query
        query = db.query(InsightsData)
        
        # ✅ NEW: Role-based filtering
        if "securityadmin" in roles and "itadmin" not in roles:
            # Security Admin: only their warehouse
            query = query.filter(InsightsData.warehouse_code == current_user.warehouse_code)
        else:
            # IT Admin: can filter by site/warehouse if provided
            if filters.get('site_code'):
                query = query.filter(InsightsData.site_code == filters['site_code'])
            if filters.get('warehouse_code'):
                query = query.filter(InsightsData.warehouse_code == filters['warehouse_code'])
        
        # Date filters
        if filters.get('from_date'):
            query = query.filter(InsightsData.date >= filters['from_date'])
        if filters.get('to_date'):
            query = query.filter(InsightsData.date <= filters['to_date'])
            
        
        # Vehicle number filter
        if filters.get('vehicle_no'):
            vehicle_filter = f"%{filters['vehicle_no'].upper()}%"
            query = query.filter(InsightsData.vehicle_no.ilike(vehicle_filter))
            
        # Movement type filter
        if filters.get('movement_type'):
            query = query.filter(InsightsData.movement_type == filters['movement_type'])
        
        # Execute query
        movements = query.order_by(
            InsightsData.date.desc(), 
            InsightsData.time.desc()
        ).limit(500).all()
        
        # Enhanced response with operational edit status
        result_list = []
        for movement in movements:
            # Calculate document age
            document_age_time = None
            if movement.document_date:
                time_diff = datetime.now() - movement.document_date
                total_seconds = int(time_diff.total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                seconds = total_seconds % 60
                document_age_time = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            
            # Get edit status and button configuration
            edit_button_config = movement.get_edit_button_config(
                current_user.username, 
                current_user.role
            )
            
            result_list.append({
                "id": movement.id,
                "gate_entry_no": movement.gate_entry_no,
                "document_type": movement.document_type,
                "sub_document_type": movement.sub_document_type,
                "document_no": movement.document_no,
                "vehicle_no": movement.vehicle_no,
                "date": movement.date.isoformat() if movement.date else None,
                "time": movement.time.isoformat() if movement.time else None,
                "movement_type": movement.movement_type,
                "warehouse_code": movement.warehouse_code,
                "warehouse_name": getattr(movement, 'warehouse_name', f"WH-{movement.warehouse_code}"),
                "security_name": movement.security_name,
                "security_username": movement.security_username,
                "site_code": movement.site_code,
                "remarks": movement.remarks,
                "document_date": movement.document_date.isoformat() if movement.document_date else None,
                "document_age_time": document_age_time,
                
                # Operational fields
                "driver_name": movement.driver_name,
                "km_reading": movement.km_reading,
                "loader_names": movement.loader_names,
                "last_edited_at": movement.last_edited_at.isoformat() if movement.last_edited_at else None,
                "edit_count": movement.edit_count or 0,
                
                # Edit status information
                "edit_status": movement.get_edit_status(),
                "time_remaining": movement.get_time_remaining(),
                "is_operational_complete": movement.is_operational_data_complete(),
                "missing_fields": movement.get_missing_operational_fields(),
                "can_edit": movement.can_be_edited(current_user.username, current_user.role),
                "edit_button_config": edit_button_config
            })
        
        return {
            "count": len(result_list),
            "results": result_list,
            "filters_applied": filters,
            "user_role": current_user.role,
            "access_level": "itadmin" if "itadmin" in roles else "securityadmin"
        }
        
    except Exception as e:
        print(f"Error in admin filtered movements: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Filter error: {str(e)}")

# Add this route to your bisleri-backend/app/routers/admin.py

# ✅ NEW: Admin RM Statistics with Filtering
@router.get("/rm/statistics")
def get_admin_rm_statistics(
    site_code: Optional[str] = None,
    warehouse_code: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: UsersMaster = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get RM statistics for admin with filtering"""
    try:
        roles = normalize_roles(current_user.role)
        if not any(r in ["securityadmin", "itadmin"] for r in roles):
            raise HTTPException(status_code=403, detail="Access denied")
        
        base_query = db.query(RawMaterialsData)
        
        # Role-based filtering
        if "securityadmin" in roles and "itadmin" not in roles:
            base_query = base_query.filter(RawMaterialsData.warehouse_code == current_user.warehouse_code)
        else:
            if site_code:
                base_query = base_query.filter(RawMaterialsData.site_code == site_code)
            if warehouse_code:
                base_query = base_query.filter(RawMaterialsData.warehouse_code == warehouse_code)
        
        # Date filtering
        if not from_date or not to_date:
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=7)
        else:
            start_date = datetime.strptime(from_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(to_date, '%Y-%m-%d').date()
        
        base_query = base_query.filter(
            func.DATE(RawMaterialsData.date_time) >= start_date,
            func.DATE(RawMaterialsData.date_time) <= end_date
        )
        
        recent_records = base_query.all()
        
        if not recent_records:
            return {
                "total_entries": 0,
                "gate_in_count": 0,
                "gate_out_count": 0,
                "unique_vehicles": 0,
                "edited_entries": 0,
                "period": f"{start_date} to {end_date}",
                "filters_applied": {
                    "site_code": site_code,
                    "warehouse_code": warehouse_code
                }
            }
        
        total_entries = len(recent_records)
        gate_in_count = len([r for r in recent_records if r.gate_type == "Gate-In"])
        gate_out_count = len([r for r in recent_records if r.gate_type == "Gate-Out"])
        unique_vehicles = len(set(r.vehicle_no for r in recent_records))
        edited_entries = len([r for r in recent_records if (r.edit_count or 0) > 0])
        
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
        
    except Exception as e:
        print(f"Error getting admin RM statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Statistics error: {str(e)}")
