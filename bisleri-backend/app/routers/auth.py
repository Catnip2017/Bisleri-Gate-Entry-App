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
    # Single generic failure message for both "no such user" and "wrong
    # password" — prevents account enumeration (an attacker must not be able
    # to tell whether a username exists from the login response).
    db_user = db.query(UsersMaster).filter(
        UsersMaster.username == login_data.username.strip()
    ).first()

    if not db_user or not verify_password(login_data.password, db_user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # is_active: refuse deactivated accounts before any token is issued.
    if db_user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated — contact your IT Admin.",
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
        "gate_pass_location": user.gate_pass_location,
        "department": user.department,
    })

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
def logout(current_user: UsersMaster = Depends(get_current_user), db: Session = Depends(get_db)):
    db.commit()
    return {"message": f"User '{current_user.username}' successfully logged out."}
