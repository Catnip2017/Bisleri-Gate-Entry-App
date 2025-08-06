# app/routers/auth.py - UPDATED VERSION
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import UserCreate, UserResponse, LoginRequest, Token, PasswordReset
from app.auth import authenticate_user, create_access_token, get_password_hash, get_current_user
from fastapi import HTTPException, status
from app.models import UsersMaster, LocationMaster
from datetime import datetime, timedelta

router = APIRouter(tags=["Authentication"])

@router.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(UsersMaster).filter(UsersMaster.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = UsersMaster(
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        warehouse_code=user.warehouse_code,
        warehouse_name=db.query(LocationMaster.warehouse_name)
                     .filter(LocationMaster.warehouse_code == user.warehouse_code)
                     .first()[0],
        site_code=user.site_code,
        password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # 🔥 UPDATED: Include user data in JWT token
    access_token = create_access_token(data={
        "sub": user.username,
        "role": user.role,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "warehouse_code": user.warehouse_code,
        "site_code": user.site_code
    })
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/reset-password")
def reset_password(reset_data: PasswordReset, db: Session = Depends(get_db)):
    user = db.query(UsersMaster).filter(UsersMaster.username == reset_data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if reset_data.new_password != reset_data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    user.password = get_password_hash(reset_data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}

@router.post("/logout")
def logout(current_user: UsersMaster = Depends(get_current_user), db: Session = Depends(get_db)):
    db.commit()
    
    return {"message": f"User '{current_user.username}' successfully logged out."}