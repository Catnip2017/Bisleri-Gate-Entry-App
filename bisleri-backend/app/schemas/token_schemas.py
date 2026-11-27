from pydantic import BaseModel
from typing import Optional

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenData(BaseModel):
    username: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    # 27 Nov 2026: "legacy" (old-format password) or "policy" (weak password
    # with ENFORCE_PASSWORD_POLICY on) -> the app opens "Set a new password".
    password_change_required: Optional[str] = None
