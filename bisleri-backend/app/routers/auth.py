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
 
 
 
@router.post("/logout")
def logout(current_user: UsersMaster = Depends(get_current_user), db: Session = Depends(get_db)):
    db.commit()
    return {"message": f"User '{current_user.username}' successfully logged out."}