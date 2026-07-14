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


# ── Role model redesign (LOCKED 14 Jul 2026 — see CONTEXT_SUMMARY §11) ──────
# Roles: securityguard (SG), gatepassdispatcher (GPD, only with SG),
# gatepasscreator (GPC, alone or with itadmin), itadmin (ITA), copacker.
# securityadmin is REMOVED; gatepassuser is a retired legacy name.
GATE_PASS_CREATOR = "gatepasscreator"
GATE_PASS_DISPATCHER = "gatepassdispatcher"

ASSIGNABLE_ROLES = ["securityguard", "itadmin", GATE_PASS_CREATOR,
                    GATE_PASS_DISPATCHER, "copacker"]


def validate_role_combo(normalized: List[str]) -> Optional[str]:
    """Return a human-readable error if the role combo is illegal, else None.

    Structural SOD: origination (GPC) and gate-confirmation (GPD) can never
    meet in one person. Enforced here + Assign Access + Register UI, so no
    API path can create an illegal combo.
    """
    s = set(normalized)
    if "securityadmin" in s:
        return "The Security Admin role has been removed and can no longer be assigned."
    if "gatepassuser" in s:
        return ("'Gate Pass User' is retired — assign 'Gate Pass Creator' "
                "(initiates passes) or 'Gate Pass Dispatcher' (gate actions, guards only).")
    unknown = s - set(ASSIGNABLE_ROLES)
    if unknown:
        return f"Unknown role(s): {', '.join(sorted(unknown))}"
    if "copacker" in s and len(s) > 1:
        return "Co Packer is an exclusive role — it cannot be combined with any other role."
    if GATE_PASS_DISPATCHER in s and "securityguard" not in s:
        return "Gate Pass Dispatcher can only be assigned together with Security Guard."
    if GATE_PASS_CREATOR in s and ("securityguard" in s or GATE_PASS_DISPATCHER in s):
        return ("Gate Pass Creator cannot be combined with Security Guard or Gate Pass "
                "Dispatcher — the creator of a pass can never be the one who dispatches it.")
    if "itadmin" in s and ("securityguard" in s or GATE_PASS_DISPATCHER in s):
        return "IT Admin cannot be combined with Security Guard or Gate Pass Dispatcher."
    return None
