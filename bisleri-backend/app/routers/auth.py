# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import UserCreate, UserResponse, LoginRequest, Token, PasswordReset
from app.auth import create_access_token, get_password_hash, get_current_user, verify_password
from app.models import UsersMaster, LocationMaster
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.utils.account_rules import normalise_mobile

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


# ── Compulsory mobile number (25 Nov 2026) ────────────────────────────────────
# Every signed-in user, whatever their role, must have a mobile number. The
# app checks this right after login and shows a one-field page until it is
# filled in. These two endpoints are self-service (own account only).
class MobileUpdate(BaseModel):
    phone_number: str


@router.get("/me/mobile-status")
def my_mobile_status(current_user: UsersMaster = Depends(get_current_user)):
    return {"has_mobile": bool(normalise_mobile(current_user.phone_number))}


@router.put("/me/mobile")
def set_my_mobile(
    payload: MobileUpdate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    mobile = normalise_mobile(payload.phone_number)
    if not mobile:
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit mobile number.")
    clash = db.query(UsersMaster).filter(
        UsersMaster.phone_number == mobile,
        UsersMaster.username != current_user.username,
    ).first()
    if clash:
        raise HTTPException(status_code=409, detail="This mobile number is already used by another account. Contact your IT Admin.")
    user = db.query(UsersMaster).filter(UsersMaster.username == current_user.username).first()
    user.phone_number = mobile
    db.commit()
    return {"message": "Mobile number saved", "has_mobile": True}


@router.post("/logout")
def logout(current_user: UsersMaster = Depends(get_current_user), db: Session = Depends(get_db)):
    db.commit()
    return {"message": f"User '{current_user.username}' successfully logged out."}
