# tests/test_roles.py
"""Tier 1 — app/utils/roles.py (Q1). Role strings come from users_master.role
as comma-separated display names; every access check depends on this parsing."""
from app.utils.roles import has_any_role, has_role, normalize_role_list, normalize_roles


def test_single_role():
    assert normalize_roles("IT Admin") == ["itadmin"]


def test_multi_role():
    assert normalize_roles("IT Admin, Security Guard") == ["itadmin", "securityguard"]


def test_extra_spaces_and_case():
    assert normalize_roles("  security GUARD ,Co Packer ") == ["securityguard", "copacker"]


def test_trailing_comma_produces_no_empty_token():
    assert normalize_roles("IT Admin,") == ["itadmin"]


def test_empty_and_none():
    assert normalize_roles("") == []
    assert normalize_roles(None) == []


def test_all_five_known_roles():
    raw = "Security Guard, Security Admin, IT Admin, Gate Pass User, Co Packer"
    assert normalize_roles(raw) == [
        "securityguard", "securityadmin", "itadmin", "gatepassuser", "copacker",
    ]


def test_normalize_role_list():
    assert normalize_role_list(["Gate Pass User", " IT Admin "]) == ["gatepassuser", "itadmin"]
    assert normalize_role_list([]) == []
    assert normalize_role_list(None) == []


def test_has_role():
    assert has_role("IT Admin, Security Guard", "securityguard")
    assert not has_role("IT Admin", "securityguard")
    assert not has_role(None, "itadmin")


def test_has_any_role():
    assert has_any_role("Security Admin", ["itadmin", "securityadmin"])
    assert not has_any_role("Co Packer", ["itadmin", "securityadmin"])


def test_whole_string_is_never_one_token():
    """Regression: the old inline pattern normalised the WHOLE string without
    splitting, so 'IT Admin, Security Guard' compared as one token and
    slipped past `== "itadmin"` checks (raw_materials edit bug)."""
    roles = normalize_roles("IT Admin, Security Guard")
    assert "itadmin,securityguard" not in roles
    assert "itadmin" in roles
