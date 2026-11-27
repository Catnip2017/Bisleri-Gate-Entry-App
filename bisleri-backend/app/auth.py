from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.config import settings
from app.models import UsersMaster
from app.database import get_db
from app.utils.roles import normalize_roles
from app.schemas.token_schemas import TokenData
from passlib.context import CryptContext

# Secure hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def is_legacy_hash(hashed_password) -> bool:
    """True for the first app's unsalted SHA-256 hex passwords (64 hex chars),
    which this app does not accept (it reads bcrypt only)."""
    import re
    return bool(hashed_password) and re.fullmatch(r"[0-9a-fA-F]{64}", hashed_password) is not None


def legacy_password_matches(plain_password, hashed_password) -> bool:
    import hashlib, hmac
    return hmac.compare_digest(hashlib.sha256((plain_password or "").encode()).hexdigest(),
                               (hashed_password or "").lower())


def verify_password(plain_password, hashed_password):
    """bcrypt only. Any other / unreadable hash (e.g. an old SHA-256 password
    from Bisleri_01) is simply 'no match' instead of a server error."""
    if not hashed_password or not plain_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False

def get_password_hash(password):
    return pwd_context.hash(password)

def authenticate_user(db: Session, username: str, password: str):
    user = db.query(UsersMaster).filter(UsersMaster.username == username).first()
    if not user or not verify_password(password, user.password):
        return None
    return user

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def make_token(user, expires_delta: timedelta = None, **extra) -> str:
    """The app's login token for a user (same claims as /login has always
    issued) plus optional extra claims (pwc / va)."""
    data = {
        "sub": user.username,
        "role": user.role,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "warehouse_code": user.warehouse_code,
        "site_code": user.site_code,
        "copacker_location": user.copacker_location,
        "gate_pass_location": user.gate_pass_location,
        "department": user.department,
    }
    data.update({k: v for k, v in extra.items() if v})
    return create_access_token(data=data, expires_delta=expires_delta)


# ── Restricted tokens (27 Nov 2026) ───────────────────────────────────────────
# "pwc" (password change required): issued when an old-format password was
#   typed correctly, or — with ENFORCE_PASSWORD_POLICY=true — when the password
#   breaks the policy. Such a token can ONLY change the password.
# "va" (view as user): an IT Admin's read-only preview of another user. Every
#   change (POST/PUT/PATCH/DELETE) is refused, except ending the preview.
PWC_ALLOWED_PATHS = {"/me/change-password", "/me/account-status", "/logout"}
VIEW_AS_ALLOWED_WRITES = {"/security/view-as/end", "/logout"}
VIEW_AS_MINUTES = 30


def _path(request) -> str:
    try:
        return request.url.path.rstrip("/") or "/"
    except Exception:  # noqa: BLE001
        return ""


async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(UsersMaster).filter(UsersMaster.username == username).first()
    if user is None:
        raise credentials_exception

    # is_active kill switch: checked on EVERY request (not just login), so
    # deactivation bites mid-session despite 8h tokens. 401 (not 403) on
    # purpose — the frontend interceptor auto-clears the token and returns
    # the user to the login screen. NULL/legacy rows count as active.
    if user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account deactivated — contact your IT Admin.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    path = _path(request)
    if payload.get("pwc") and path not in PWC_ALLOWED_PATHS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="PASSWORD_CHANGE_REQUIRED")
    view_by = payload.get("va")
    if view_by:
        # The IT Admin who started the preview must still be an active IT Admin.
        admin = db.query(UsersMaster).filter(UsersMaster.username == view_by).first()
        if not admin or admin.is_active is False or "itadmin" not in normalize_roles(admin.role):
            raise credentials_exception
        if request.method not in ("GET", "HEAD", "OPTIONS") and path not in VIEW_AS_ALLOWED_WRITES:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="VIEW_ONLY: this is a read-only preview — changes are not allowed.")
    user.view_as_by = view_by

    # 🔥 Normalize roles into list (single source of truth: app/utils/roles.py)
    user.roles = normalize_roles(user.role)

    # Last activity for the dormant-account check (at most one write per
    # user every 5 minutes; no-op until migration b9e4d2a7c1f5 is applied).
    from app.services.security import touch_last_seen
    if not view_by:                       # a preview is not the user's own activity
        touch_last_seen(db, user.username)

    return user

