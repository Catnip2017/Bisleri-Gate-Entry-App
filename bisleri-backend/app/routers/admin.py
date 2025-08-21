# app/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import UsersMaster, LocationMaster
from app.schemas import UserCreate, UserResponse, PasswordReset
from app.auth import get_current_user, get_password_hash

router = APIRouter(tags=["Admin Operations"])

# ✅ MOVED FROM auth.py - Register User (ITAdmin only)
@router.post("/register", response_model=UserResponse)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    try:
        logger.info(f"=== REGISTRATION DEBUG START ===")
        logger.info(f"Current user: {current_user.username}, Role: {current_user.role}")
        logger.info(f"Attempting to register: {user.username}, Role: {user.role}")
        logger.info(f"Warehouse code: '{user.warehouse_code}'")
        logger.info(f"Site code: '{user.site_code}'")
        
        # ✅ Authorization check
        if current_user.role.lower() != "itadmin":
            logger.warning(f"Unauthorized registration attempt by {current_user.username} ({current_user.role})")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only ITAdmins can register users"
            )

        # ✅ Check for duplicate username
        logger.info(f"Checking for existing user: {user.username}")
        existing_user = db.query(UsersMaster).filter(UsersMaster.username == user.username).first()
        if existing_user:
            logger.warning(f"Username {user.username} already exists")
            raise HTTPException(status_code=400, detail="Username already registered")

        # ✅ Initialize warehouse data
        warehouse_name = ""
        final_site_code = ""

        # ✅ Warehouse validation for admin/security roles
        if user.role.lower() in ["admin", "security"]:
            logger.info(f"Validating warehouse for role: {user.role}")
            
            if not user.warehouse_code or user.warehouse_code.strip() == "":
                logger.error("Missing warehouse code for admin/security role")
                raise HTTPException(status_code=400, detail="Warehouse code is required for this role")

            logger.info(f"Looking up warehouse: {user.warehouse_code}")
            warehouse = db.query(LocationMaster).filter(
                LocationMaster.warehouse_code == user.warehouse_code.strip()
            ).first()

            if not warehouse:
                logger.error(f"Warehouse not found: {user.warehouse_code}")
                raise HTTPException(status_code=400, detail="Invalid warehouse code")

            warehouse_name = warehouse.warehouse_name
            final_site_code = warehouse.site_code
            logger.info(f"Warehouse found: {warehouse_name}, Site: {final_site_code}")
        else:
            logger.info(f"ITAdmin role - skipping warehouse validation")

        # ✅ FIXED: Create user object with proper if/else handling
        logger.info("Creating new user object...")
        
        # Handle warehouse fields based on role
        if user.role.lower() in ["admin", "security"]:
            user_warehouse_code = user.warehouse_code.strip()
            user_warehouse_name = warehouse_name
            user_site_code = final_site_code
        else:
            # For IT Admin users
            user_warehouse_code = None
            user_warehouse_name = None
            user_site_code = None

        # Create user object (OUTSIDE the if block)
        new_user = UsersMaster(
            username=user.username.strip(),
            first_name=user.first_name.strip(),
            last_name=user.last_name.strip(),
            role=user.role.lower().strip(),
            warehouse_code=user_warehouse_code,
            warehouse_name=user_warehouse_name,
            site_code=user_site_code,
            password=get_password_hash(user.password),
        )

        logger.info(f"User object created:")
        logger.info(f"  Username: {new_user.username}")
        logger.info(f"  Role: {new_user.role}")
        logger.info(f"  Warehouse Code: {new_user.warehouse_code}")
        logger.info(f"  Warehouse Name: {new_user.warehouse_name}")
        logger.info(f"  Site Code: {new_user.site_code}")
        
        # ✅ Database operations with transaction handling
        logger.info("Adding user to database...")
        db.add(new_user)
        
        logger.info("Committing transaction...")
        db.commit()
        
        logger.info("Refreshing user object...")
        db.refresh(new_user)
        
        logger.info(f"✅ User {new_user.username} created successfully!")

        # ✅ Return response
        response = UserResponse(
            username=new_user.username,
            first_name=new_user.first_name,
            last_name=new_user.last_name,
            role=new_user.role,
            warehouse_code=new_user.warehouse_code or "",
            warehouse_name=new_user.warehouse_name or "",
            site_code=new_user.site_code or "",
            last_login=None
        )
        
        logger.info(f"=== REGISTRATION DEBUG END - SUCCESS ===")
        return response
        
    except HTTPException as he:
        # Re-raise HTTP exceptions (these are expected)
        logger.error(f"HTTP Exception: {he.detail}")
        raise he
        
    except IntegrityError as ie:
        logger.error(f"Database integrity error: {str(ie)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database constraint violation - possibly duplicate username"
        )
        
    except SQLAlchemyError as se:
        logger.error(f"Database error: {str(se)}")
        logger.error(f"SQLAlchemy error type: {type(se).__name__}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(se)}"
        )
        
    except Exception as e:
        logger.error(f"❌ Unexpected error during registration: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Full traceback:")
        traceback.print_exc()
        
        try:
            db.rollback()
        except:
            pass
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )
# -------------------------------
# Reset Password (ITAdmin only)
# -------------------------------
@router.post("/reset-password")
def reset_password(
    reset_data: PasswordReset,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    if current_user.role.lower() != "itadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ITAdmins can reset passwords"
        )

    if reset_data.new_password != reset_data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    user = db.query(UsersMaster).filter(
        UsersMaster.username == reset_data.username
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = get_password_hash(reset_data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}

# -------------------------------
# List Users (ITAdmin only)
# -------------------------------
@router.get("/list-users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    if current_user.role.lower() != "itadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ITAdmins can list users"
        )
    return db.query(UsersMaster).all()

# -------------------------------
# Get Single User by Username (ITAdmin only)
# -------------------------------
@router.get("/user/{username}", response_model=UserResponse)
def get_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    if current_user.role.lower() != "itadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ITAdmins can fetch user details"
        )

    user = db.query(UsersMaster).filter(UsersMaster.username == username).first()
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

# -------------------------------
# Admin Dashboard (Admin + ITAdmin)
# -------------------------------
@router.get("/admin-dashboard-stats")
def get_dashboard_stats(
    current_user: UsersMaster = Depends(get_current_user),
):
    if current_user.role.lower() not in ["admin", "itadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin/ITAdmin can view dashboard stats"
        )

    return {
        "total_movements": 50,
        "unique_vehicles": 20,
        "gate_in": 30,
        "gate_out": 20,
    }

# -------------------------------
# Warehouse Master
# -------------------------------
@router.get("/warehouses")
def get_warehouses(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    if current_user.role.lower() not in ["admin", "itadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin/ITAdmin can fetch warehouses"
        )

    warehouses = db.query(LocationMaster).all()
    if not warehouses:
        raise HTTPException(status_code=404, detail="No warehouses found")

    return [
        {
            "warehouse_code": w.warehouse_code,
            "warehouse_name": w.warehouse_name,
            "site_code": w.site_code,
            "warehouse_id": w.warehouse_id or w.warehouse_code,
        }
        for w in warehouses
    ]

# app/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List
import traceback
import logging

from app.database import get_db
from app.models import UsersMaster, LocationMaster
from app.schemas import UserCreate, UserResponse, PasswordReset
from app.auth import get_current_user, get_password_hash

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin Operations"])

# ✅ ENHANCED: Register User with comprehensive error handling
@router.post("/register", response_model=UserResponse)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    try:
        logger.info(f"=== REGISTRATION DEBUG START ===")
        logger.info(f"Current user: {current_user.username}, Role: {current_user.role}")
        logger.info(f"Attempting to register: {user.username}, Role: {user.role}")
        logger.info(f"Warehouse code: '{user.warehouse_code}'")
        logger.info(f"Site code: '{user.site_code}'")
        
        # ✅ Authorization check
        if current_user.role.lower() != "itadmin":
            logger.warning(f"Unauthorized registration attempt by {current_user.username} ({current_user.role})")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only ITAdmins can register users"
            )

        # ✅ Check for duplicate username
        logger.info(f"Checking for existing user: {user.username}")
        existing_user = db.query(UsersMaster).filter(UsersMaster.username == user.username).first()
        if existing_user:
            logger.warning(f"Username {user.username} already exists")
            raise HTTPException(status_code=400, detail="Username already registered")

        # ✅ Initialize warehouse data
        warehouse_name = ""
        final_site_code = ""

        # ✅ Warehouse validation for admin/security roles
        if user.role.lower() in ["admin", "security"]:
            logger.info(f"Validating warehouse for role: {user.role}")
            
            if not user.warehouse_code or user.warehouse_code.strip() == "":
                logger.error("Missing warehouse code for admin/security role")
                raise HTTPException(status_code=400, detail="Warehouse code is required for this role")

            logger.info(f"Looking up warehouse: {user.warehouse_code}")
            warehouse = db.query(LocationMaster).filter(
                LocationMaster.warehouse_code == user.warehouse_code.strip()
            ).first()

            if not warehouse:
                logger.error(f"Warehouse not found: {user.warehouse_code}")
                raise HTTPException(status_code=400, detail="Invalid warehouse code")

            warehouse_name = warehouse.warehouse_name
            final_site_code = warehouse.site_code
            logger.info(f"Warehouse found: {warehouse_name}, Site: {final_site_code}")
        else:
            logger.info(f"ITAdmin role - skipping warehouse validation")

        # ✅ FIXED: Create user object with proper if/else handling
        logger.info("Creating new user object...")
        
        # Handle warehouse fields based on role
        if user.role.lower() in ["admin", "security"]:
            user_warehouse_code = user.warehouse_code.strip()
            user_warehouse_name = warehouse_name
            user_site_code = final_site_code
        else:
            # For IT Admin users
            user_warehouse_code = None
            user_warehouse_name = None
            user_site_code = None

        # Create user object (OUTSIDE the if block)
        new_user = UsersMaster(
            username=user.username.strip(),
            first_name=user.first_name.strip(),
            last_name=user.last_name.strip(),
            role=user.role.lower().strip(),
            warehouse_code=user_warehouse_code,
            warehouse_name=user_warehouse_name,
            site_code=user_site_code,
            password=get_password_hash(user.password),
        )

        logger.info(f"User object created:")
        logger.info(f"  Username: {new_user.username}")
        logger.info(f"  Role: {new_user.role}")
        logger.info(f"  Warehouse Code: {new_user.warehouse_code}")
        logger.info(f"  Warehouse Name: {new_user.warehouse_name}")
        logger.info(f"  Site Code: {new_user.site_code}")
        
        # ✅ Database operations with transaction handling
        logger.info("Adding user to database...")
        db.add(new_user)
        
        logger.info("Committing transaction...")
        db.commit()
        
        logger.info("Refreshing user object...")
        db.refresh(new_user)
        
        logger.info(f"✅ User {new_user.username} created successfully!")

        # ✅ Return response
        response = UserResponse(
            username=new_user.username,
            first_name=new_user.first_name,
            last_name=new_user.last_name,
            role=new_user.role,
            warehouse_code=new_user.warehouse_code or "",
            warehouse_name=new_user.warehouse_name or "",
            site_code=new_user.site_code or "",
            last_login=None
        )
        
        logger.info(f"=== REGISTRATION DEBUG END - SUCCESS ===")
        return response
        
    except HTTPException as he:
        # Re-raise HTTP exceptions (these are expected)
        logger.error(f"HTTP Exception: {he.detail}")
        raise he
        
    except IntegrityError as ie:
        logger.error(f"Database integrity error: {str(ie)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database constraint violation - possibly duplicate username"
        )
        
    except SQLAlchemyError as se:
        logger.error(f"Database error: {str(se)}")
        logger.error(f"SQLAlchemy error type: {type(se).__name__}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(se)}"
        )
        
    except Exception as e:
        logger.error(f"❌ Unexpected error during registration: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Full traceback:")
        traceback.print_exc()
        
        try:
            db.rollback()
        except:
            pass
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )

# ✅ Test endpoint to verify admin router is working
@router.get("/test-admin")
def test_admin_router():
    return {"message": "Admin router is working", "status": "success"}

# -------------------------------
# Reset Password (ITAdmin only)
# -------------------------------
@router.post("/reset-password")
def reset_password(
    reset_data: PasswordReset,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    if current_user.role.lower() != "itadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ITAdmins can reset passwords"
        )

    if reset_data.new_password != reset_data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    user = db.query(UsersMaster).filter(
        UsersMaster.username == reset_data.username
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = get_password_hash(reset_data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}

# -------------------------------
# List Users (ITAdmin only)
# -------------------------------
@router.get("/list-users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    if current_user.role.lower() != "itadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ITAdmins can list users"
        )
    return db.query(UsersMaster).all()

# -------------------------------
# Get Single User by Username (ITAdmin only)
# -------------------------------
@router.get("/user/{username}", response_model=UserResponse)
def get_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    if current_user.role.lower() != "itadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ITAdmins can fetch user details"
        )

    user = db.query(UsersMaster).filter(UsersMaster.username == username).first()
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

# -------------------------------
# Admin Dashboard (Admin + ITAdmin)
# -------------------------------
@router.get("/admin-dashboard-stats")
def get_dashboard_stats(
    current_user: UsersMaster = Depends(get_current_user),
):
    if current_user.role.lower() not in ["admin", "itadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin/ITAdmin can view dashboard stats"
        )

    return {
        "total_movements": 50,
        "unique_vehicles": 20,
        "gate_in": 30,
        "gate_out": 20,
    }

# -------------------------------
# Warehouse Master
# -------------------------------
@router.get("/warehouses")
def get_warehouses(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    if current_user.role.lower() not in ["admin", "itadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin/ITAdmin can fetch warehouses"
        )

    warehouses = db.query(LocationMaster).all()
    if not warehouses:
        raise HTTPException(status_code=404, detail="No warehouses found")

    return [
        {
            "warehouse_code": w.warehouse_code,
            "warehouse_name": w.warehouse_name,
            "site_code": w.site_code,
            "warehouse_id": w.warehouse_id or w.warehouse_code,
        }
        for w in warehouses
    ]