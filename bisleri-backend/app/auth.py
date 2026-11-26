from fastapi import Depends, HTTPException, status
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

async def get_current_user(
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

    # 🔥 Normalize roles into list (single source of truth: app/utils/roles.py)
    user.roles = normalize_roles(user.role)

    # Last activity for the dormant-account check (at most one write per
    # user every 5 minutes; no-op until migration b9e4d2a7c1f5 is applied).
    from app.services.security import touch_last_seen
    touch_last_seen(db, user.username)

    return user

