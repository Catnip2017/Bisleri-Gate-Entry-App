from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import UsersMaster, LocationMaster
from app.schemas import UserCreate, UserResponse, PasswordReset
from app.auth import get_current_user, get_password_hash
from typing import List

router = APIRouter(tags=["Admin Operations"])

@router.post("/register-user", response_model=UserResponse)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Register new users (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can register users"
        )

    # Check if username exists
    db_user = db.query(UsersMaster).filter(UsersMaster.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Verify warehouse exists
    warehouse = db.query(LocationMaster).filter(
        LocationMaster.warehouse_code == user.warehouse_code
    ).first()
    if not warehouse:
        raise HTTPException(status_code=400, detail="Invalid warehouse code")

    new_user = UsersMaster(
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role.lower(),
        warehouse_code=user.warehouse_code,
        warehouse_name=warehouse.warehouse_name,
        site_code=warehouse.site_code,
        password=get_password_hash(user.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/reset-password")
def reset_password(
    reset_data: PasswordReset,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Reset user password (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can reset passwords"
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

@router.get("/list-users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """List all users (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list users"
        )
    return db.query(UsersMaster).all()