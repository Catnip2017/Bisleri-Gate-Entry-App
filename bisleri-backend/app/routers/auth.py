# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import UserCreate, UserResponse, LoginRequest, Token, PasswordReset
from app.auth import create_access_token, get_password_hash, get_current_user, verify_password
from app.models import UsersMaster, LocationMaster
from datetime import datetime, timedelta

router = APIRouter(tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    # Look up user first so we can give distinct messages
    db_user = db.query(UsersMaster).filter(
        UsersMaster.username == login_data.username.strip()
    ).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username not found. Please check your username.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(login_data.password, db_user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please try again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db_user
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token(data={
        "sub": user.username,
        "role": user.role,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "warehouse_code": user.warehouse_code,
        "site_code": user.site_code,
        "copacker_location": user.copacker_location,
    })

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
def logout(current_user: UsersMaster = Depends(get_current_user), db: Session = Depends(get_db)):
    db.commit()
    return {"message": f"User '{current_user.username}' successfully logged out."}
