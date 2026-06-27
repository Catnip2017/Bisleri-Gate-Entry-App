# app/routers/auth.py
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.schemas import UserCreate, UserResponse, LoginRequest, Token, PasswordReset
from app.auth import create_access_token, get_password_hash, get_current_user, verify_password
from app.models import UsersMaster, LocationMaster
from app.config import settings
from app import redis_client as _rc

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

    # Generate a unique token ID — stored in Redis so we can revoke this specific token
    jti = str(uuid.uuid4())

    access_token = create_access_token(data={
        "sub": user.username,
        "jti": jti,                             # unique ID for this token
        "role": user.role,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "warehouse_code": user.warehouse_code,
        "site_code": user.site_code,
        "copacker_location": user.copacker_location,
    })

    # Revoke any previous token for this user (re-login invalidates old session)
    _rc.revoke_user_token(user.username)
    # Track the new token so admin actions can revoke it without needing the token itself
    ttl = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    _rc.store_active_jti(user.username, jti, ttl)

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
def logout(current_user: UsersMaster = Depends(get_current_user)):
    """
    Blocklist the current token so it is immediately invalid — even if it
    hasn't expired yet. The user must log in again to get a new token.
    """
    if current_user.jti and current_user.token_exp:
        import time
        remaining = max(int(current_user.token_exp - time.time()), 1)
        _rc.revoke_jti(current_user.jti, remaining)
        _rc.revoke_user_token(current_user.username)  # also clean the active_jti key

    return {"message": f"User '{current_user.username}' successfully logged out."}
