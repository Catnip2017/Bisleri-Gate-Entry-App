# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import UserCreate, UserResponse, LoginRequest, Token, PasswordReset
from app.auth import make_token, create_access_token, get_password_hash, get_current_user, verify_password, is_legacy_hash, legacy_password_matches
from app.services.security import audit, audit_now, client_ip, password_ready
from app.config import settings
from app.utils.account_rules import password_error
from app.models import UsersMaster, LocationMaster
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.utils.account_rules import normalise_mobile

router = APIRouter(tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    # Single generic failure message for both "no such user" and "wrong
    # password" — prevents account enumeration (an attacker must not be able
    # to tell whether a username exists from the login response).
    uname = (login_data.username or "").strip()
    db_user = db.query(UsersMaster).filter(UsersMaster.username == uname).first()
    ip = client_ip(request)

    legacy_ok = False
    if db_user and is_legacy_hash(db_user.password):
        # Old Bisleri_01 SHA-256 password (26-27 Nov 2026): never a server
        # error. The RIGHT old password gets a restricted token that can only
        # set a new password; a wrong one gets the normal message (so this
        # does not reveal which accounts exist).
        legacy_ok = legacy_password_matches(login_data.password, db_user.password)
        db_user_ok = legacy_ok
    else:
        db_user_ok = bool(db_user) and verify_password(login_data.password, db_user.password)

    if not db_user_ok:
        audit_now(db, None, "login_failed", db_user.username if db_user else None,
                  {"why": "wrong password" if db_user else "unknown username",
                   **({} if db_user else {"username_tried": uname[:50]})}, ip=ip)
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

    # Password policy (27 Nov 2026): the typed password is the only moment the
    # app can see it, so it is checked here and the result stored.
    policy_ok = (not legacy_ok) and password_error(login_data.password) is None
    if password_ready(db):
        user.password_policy_ok = policy_ok
    change = "legacy" if legacy_ok else ("policy" if settings.ENFORCE_PASSWORD_POLICY and not policy_ok else None)
    if change:
        audit(db, user.username, "password_change_required", user.username,
              {"why": "old password format" if change == "legacy" else "password does not meet the rule"}, ip=ip)
    db.commit()

    return {"access_token": make_token(user, pwc=change), "token_type": "bearer",
            "password_change_required": change}


# ── Set a new password (27 Nov 2026) ──────────────────────────────────────────
class ChangePassword(BaseModel):
    current_password: str
    new_password: str


@router.get("/me/account-status")
def my_account_status(request: Request, current_user: UsersMaster = Depends(get_current_user)):
    """What the app must ask for before the user can carry on."""
    from jose import jwt
    try:
        token = (request.headers.get("authorization") or "").split(" ", 1)[1]
        claims = jwt.get_unverified_claims(token)
    except Exception:  # noqa: BLE001
        claims = {}
    return {
        "has_mobile": bool(normalise_mobile(current_user.phone_number)),
        "password_change_required": claims.get("pwc"),
        "view_as_by": getattr(current_user, "view_as_by", None),
    }


@router.post("/me/change-password")
def change_my_password(payload: ChangePassword, request: Request, db: Session = Depends(get_db),
                       current_user: UsersMaster = Depends(get_current_user)):
    user = db.query(UsersMaster).filter(UsersMaster.username == current_user.username).first()
    if is_legacy_hash(user.password):
        ok = legacy_password_matches(payload.current_password, user.password)
    else:
        ok = verify_password(payload.current_password, user.password)
    if not ok:
        audit_now(db, user.username, "password_change_failed", user.username, {"why": "current password wrong"},
                  ip=client_ip(request))
        raise HTTPException(status_code=400, detail="Your current password is not correct.")
    err = password_error(payload.new_password)
    if err:
        raise HTTPException(status_code=400, detail=err)
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="The new password must be different from the current one.")
    was_legacy = is_legacy_hash(user.password)
    user.password = get_password_hash(payload.new_password)
    if password_ready(db):
        user.password_policy_ok = True
        user.password_changed_at = datetime.utcnow()
    audit(db, user.username, "password_changed", user.username,
          {"via": "Set a new password", **({"from_old_format": True} if was_legacy else {})}, ip=client_ip(request))
    db.commit()
    return {"message": "Password changed", "access_token": make_token(user), "token_type": "bearer"}


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
