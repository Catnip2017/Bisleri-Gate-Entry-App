# app/utils/roles.py
"""Single source of truth for role normalisation (Pass 3 — Q1).

users_master.role stores roles as a comma-separated display string,
e.g. "IT Admin, Security Guard". Every access check in the app must
compare against the normalised form: lowercase, no spaces
("itadmin", "securityguard").

Before this module existed the same list-comprehension was copy-pasted
in 12+ routers. Import from here instead — never re-implement it.
"""
from typing import List, Optional


def normalize_roles(role_string: Optional[str]) -> List[str]:
    """Split a comma-separated role string into normalised tokens.

    "IT Admin, Security Guard" -> ["itadmin", "securityguard"]
    None / "" -> []
    """
    if not role_string:
        return []
    return [r.strip().lower().replace(" ", "") for r in role_string.split(",") if r.strip()]


def normalize_role_list(roles: Optional[List[str]]) -> List[str]:
    """Same normalisation for an already-split list of role names."""
    return [r.strip().lower().replace(" ", "") for r in (roles or []) if r and r.strip()]


def has_role(role_string: Optional[str], role: str) -> bool:
    """True if the (raw) role string contains the given normalised role."""
    return role in normalize_roles(role_string)


def has_any_role(role_string: Optional[str], allowed: List[str]) -> bool:
    """True if the (raw) role string contains any of the given normalised roles."""
    roles = normalize_roles(role_string)
    return any(r in roles for r in allowed)
