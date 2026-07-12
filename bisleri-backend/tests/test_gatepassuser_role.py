# tests/test_gatepassuser_role.py
"""Gate Pass build queue points 1-3: real gatepassuser role (backend swap),
department auto-fill enforcement, and multi-location junction table."""
import pytest

from app.models.gate_pass import UserGatePassLocation
from tests.conftest import TestingSession, create_pass, dispatch, gp_payload, make_user, release


@pytest.fixture()
def gpu_user():
    """Rakesh: Gate Pass User, Finance, HO (legacy single-column location)."""
    return make_user("rakesh", "Gate Pass User", gp_loc="HO", department="Finance")


def gpu_payload(**over):
    base = {"department": "Finance"}
    base.update(over)
    return gp_payload("NR", **base)


# ═══ Point 1a — the front door ════════════════════════════════════════════════
def test_gpu_can_create_pass(client, users, gpu_user):
    client.login(gpu_user)
    r = client.post("/gate-pass", json=gpu_payload())
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "Open"


def test_gpu_can_release_and_cancel(client, users, gpu_user):
    client.login(gpu_user)
    gp1 = client.post("/gate-pass", json=gpu_payload()).json()
    gp2 = client.post("/gate-pass", json=gpu_payload()).json()
    assert client.post(f"/gate-pass/{gp1['id']}/release").status_code == 200
    assert client.post(f"/gate-pass/{gp2['id']}/cancel",
                       json={"cancel_reason_id": 1}).status_code == 200


def test_outsider_still_blocked(client, users):
    client.login(users["outsider"])  # Security Admin
    assert client.post("/gate-pass", json=gp_payload("NR")).status_code == 403


def test_itadmin_unchanged(client, users):
    assert create_pass(client, users, "NR")["status"] == "Open"


# ═══ Point 1b — list scoping ══════════════════════════════════════════════════
def test_gpu_sees_only_own_department_and_location(client, users, gpu_user):
    # IT department pass at HO (created by itadmin initiator)
    create_pass(client, users, "NR")                       # department IT
    client.login(gpu_user)
    client.post("/gate-pass", json=gpu_payload())          # Finance pass
    listing = client.get("/gate-pass").json()
    assert listing["total_count"] == 1                     # only Finance@HO
    assert listing["items"][0]["department"] == "Finance"


def test_itadmin_still_sees_everything(client, users, gpu_user):
    client.login(gpu_user)
    client.post("/gate-pass", json=gpu_payload())
    create_pass(client, users, "NR")
    client.login(users["admin"])
    assert client.get("/gate-pass").json()["total_count"] == 2


# ═══ Point 1c — detail page ═══════════════════════════════════════════════════
def test_gpu_can_open_own_pass_detail(client, users, gpu_user):
    client.login(gpu_user)
    gp = client.post("/gate-pass", json=gpu_payload()).json()
    r = client.get(f"/gate-pass/{gp['id']}")
    assert r.status_code == 200
    assert r.json()["department"] == "Finance"


def test_gpu_cannot_open_other_departments_pass(client, users, gpu_user):
    gp = create_pass(client, users, "NR")                  # IT department
    client.login(gpu_user)
    assert client.get(f"/gate-pass/{gp['id']}").status_code == 403


# ═══ Point 1d — segregation of duties ════════════════════════════════════════
def test_creator_guard_combo_cannot_dispatch_own_pass(client, users):
    combo = make_user("combo1", "Security Guard, Gate Pass User",
                      gp_loc="HO", department="Finance")
    client.login(combo)
    gp = client.post("/gate-pass", json=gpu_payload()).json()
    client.post(f"/gate-pass/{gp['id']}/release")
    r = client.post(f"/gate-pass/{gp['id']}/dispatch", json={"security_remarks": "x"})
    assert r.status_code == 403
    assert "SOD_VIOLATION" in r.json()["detail"]
    # a different guard CAN dispatch it
    r2 = dispatch(client, users, gp["id"], who="guard_ho")
    assert r2.status_code == 200


# ═══ Point 3 — department enforcement ════════════════════════════════════════
def test_gpu_cannot_file_under_another_department(client, users, gpu_user):
    client.login(gpu_user)
    r = client.post("/gate-pass", json=gpu_payload(department="HR"))
    assert r.status_code == 400
    assert "your own (Finance)" in r.json()["detail"]


def test_itadmin_department_free_choice_unchanged(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload("NR", department="HR"))
    assert r.status_code == 201


# ═══ Point 2 — multi-location junction ═══════════════════════════════════════
def _assign_locations(username, codes, default):
    db = TestingSession()
    for c in codes:
        db.add(UserGatePassLocation(username=username, location_code=c,
                                    is_default=(c == default)))
    db.commit()
    db.close()


def test_multi_location_user_can_create_at_both(client, users):
    meena = make_user("meena", "Gate Pass User", gp_loc="HO", department="Finance")
    _assign_locations("meena", ["HO", "CHN"], default="HO")
    client.login(meena)
    assert client.post("/gate-pass", json=gpu_payload(location_code="HO")).status_code == 201
    assert client.post("/gate-pass", json=gpu_payload(location_code="CHN")).status_code == 201


def test_gpu_blocked_at_unassigned_location(client, users, gpu_user):
    client.login(gpu_user)                                  # HO only (legacy column)
    r = client.post("/gate-pass", json=gpu_payload(location_code="CHN"))
    assert r.status_code == 403
    assert "not assigned" in r.json()["detail"]


def test_multi_location_user_sees_both_locations_passes(client, users):
    meena = make_user("meena", "Gate Pass User", gp_loc="HO", department="Finance")
    _assign_locations("meena", ["HO", "CHN"], default="HO")
    client.login(meena)
    client.post("/gate-pass", json=gpu_payload(location_code="HO"))
    client.post("/gate-pass", json=gpu_payload(location_code="CHN"))
    assert client.get("/gate-pass").json()["total_count"] == 2


def test_my_locations_returns_starred_default_first(client, users):
    meena = make_user("meena", "Gate Pass User", gp_loc="HO", department="Finance")
    _assign_locations("meena", ["CHN", "HO"], default="HO")
    client.login(meena)
    locs = client.get("/gate-pass/my-locations").json()["locations"]
    assert locs[0] == {"location_code": "HO", "is_default": True}
    assert len(locs) == 2


def test_my_locations_legacy_fallback(client, users, gpu_user):
    client.login(gpu_user)                                  # no junction rows
    locs = client.get("/gate-pass/my-locations").json()["locations"]
    assert locs == [{"location_code": "HO", "is_default": True}]


def test_junction_guard_scoped_by_rows_not_column(client, users):
    """Guard with junction rows for CHN only must not see HO's worklist,
    even though the legacy column says HO."""
    guard = make_user("guardx", "Security Guard", gp_loc="HO")
    _assign_locations("guardx", ["CHN"], default="CHN")
    gp = create_pass(client, users, "NR")                   # HO pass
    release(client, users, gp["id"])
    client.login(guard)
    assert client.get("/gate-pass/guard/pending?view=dispatch").json()["total_count"] == 0
