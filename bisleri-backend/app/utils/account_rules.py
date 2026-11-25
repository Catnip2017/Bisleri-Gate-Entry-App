# app/utils/account_rules.py - Password and mobile-number rules (25 Nov 2026).
# One place for both, used by Register, Reset Password, the admin
# user-details update and the self-service "add your mobile number" step.
import re
from typing import Optional

SPECIALS = r"""!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~"""


def password_error(pw: Optional[str]) -> Optional[str]:
    """Return a message if the password breaks the policy, else None.

    Policy: at least 6 characters, 1 upper-case letter, 1 number and
    1 special character. Applies to NEW passwords only (register / reset);
    existing passwords keep working at login.
    """
    pw = pw or ""
    missing = []
    if len(pw) < 6:
        missing.append("at least 6 characters")
    if not re.search(r"[A-Z]", pw):
        missing.append("1 upper-case letter")
    if not re.search(r"\d", pw):
        missing.append("1 number")
    if not re.search(r"[^A-Za-z0-9]", pw):
        missing.append("1 special character")
    if missing:
        return "Password must have " + ", ".join(missing) + "."
    return None


def normalise_mobile(raw: Optional[str]) -> Optional[str]:
    """Digits only; returns the 10-digit number or None if invalid/blank."""
    digits = re.sub(r"\D", "", raw or "")
    return digits if re.fullmatch(r"\d{10}", digits) else None
