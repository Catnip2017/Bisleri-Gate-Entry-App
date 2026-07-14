# tests/test_gatepassuser_role.py
"""Creator-role behaviour under the LOCKED role model (14 Jul 2026):
Gate Pass Creator (GPC) originates passes scoped to own dept + locations —
identical for ITA+GPC (no admin bypass). Multi-location junction table.
(Filename kept for git history; 'gatepassuser' is the retired legacy name.)"""
import pytest

from app.models.gate_pass import UserGatePassLocation
from tests.conftest import TestingSession, create_pass, dispatch, gp_payload, make_user, release


@pytest.fixture()
def gpu_user():
    """Rakesh: Gate Pass Creator, Finance, HO (legacy single-column location)."""
    return make_user("rakesh", "Gate Pass Creator", gp_loc="HO", department="Finance")


def gpu_payload(**over):
    base = {"department": "Finance"}
    base.update(over)
    return gp_payload("NR", **base)


# ═══ The front door ══════════════════════════════════════════════════════════
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
    client.login(users["outsider"])  # Co Packer — never any gate pass access
    assert client.post("/gate-pass", json=gp_payload("NR")).status_code == 403


def test_plain_itadmin_cannot_create(client, users):
    """ITA alone has NO gate pass hands — creating requires the GPC role."""
    client.login(users["admin"])
    assert client.post("/gate-pass", json=gp_payload("NR", department="IT")).status_code == 403


def test_ita_gpc_combo_can_create_scoped(client, users):
    """ITA+GPC creates like any creator: own dept, assigned location."""
    client.login(users["admin_creator"])                    # IT dept, HO
    assert client.post("/gate-pass", json=gp_payload("NR", department="IT")).status_code == 201


# ═══ List scoping ════════════════════════════════════════════════════════════
def test_gpu_sees_only_own_department_and_location(client, users, gpu_user):
    # IT department pass at HO (created by the IT-department creator)
    create_pass(client, users, "NR")                       # department IT
    client.login(gpu_user)
    client.post("/gate-pass", json=gpu_payload())          # Finance pass
    listing = client.get("/gate-pass").json()
    assert listing["total_count"] == 1                     # only Finance@HO
    assert listing["items"][0]["department"] == "Finance"


def test_ita_gpc_list_scoped_not_global(client, users, gpu_user):
    """ITA+GPC no longer sees everything — scoped to own dept + locations."""
    client.login(gpu_user)
    client.post("/gate-pass", json=gpu_payload())          # Finance@HO
    create_pass(client, users, "NR")                       # IT@HO by init1
    client.login(users["admin_creator"])                   # IT dept, HO
    listing = client.get("/gate-pass").json()
    assert listing["total_count"] == 1                     # only IT@HO
    assert listing["items"][0]["department"] == "IT"


def test_plain_itadmin_list_blocked(client, users):
    """ITA without GPC has no locations -> no gate pass list at all."""
    client.login(users["admin"])
    r = client.get("/gate-pass")
    assert r.status_code == 403          # blocked at the initiator gate itself


# ═══ Detail page ═════════════════════════════════════════════════════════════
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


# ═══ Structural SOD (tripwire — combos can no longer exist via the app) ══════
def test_creator_guard_combo_cannot_dispatch_own_pass(client, users):
    """Hand-edited DB role string granting GPC+GPD: the SOD tripwire still
    blocks dispatching (and receiving) your own pass."""
    combo = make_user("combo1", "Security Guard, Gate Pass Dispatcher, Gate Pass Creator",
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


def test_sod_tripwire_on_inward(client, users):
    """Same tripwire on the return leg: you cannot receive your own pass."""
    combo = make_user("combo2", "Security Guard, Gate Pass Dispatcher, Gate Pass Creator",
                      gp_loc="HO", department="Finance")
    client.login(combo)
    gp = client.post("/gate-pass", json=gp_payload("R", department="Finance")).json()
    client.post(f"/gate-pass/{gp['id']}/release")
    dispatch(client, users, gp["id"], who="guard_ho")
    client.login(combo)
    detail = client.get(f"/gate-pass/{gp['id']}").json()
    line_id = detail["lines"][0]["id"]
    r = client.post(f"/gate-pass/{gp['id']}/inward",
                    json={"receipts": [{"line_id": line_id, "received_qty": 1}]})
    assert r.status_code == 403
    assert "SOD_VIOLATION" in r.json()["detail"]


# ═══ Department enforcement — for EVERY creator ══════════════════════════════
def test_gpu_cannot_file_under_another_department(client, users, gpu_user):
    client.login(gpu_user)
    r = client.post("/gate-pass", json=gpu_payload(department="HR"))
    assert r.status_code == 400
    assert "your own (Finance)" in r.json()["detail"]


def test_ita_gpc_department_locked_too(client, users):
    """The old ITA free-choice bypass is GONE: dept fixed for all creators."""
    client.login(users["admin_creator"])                    # IT department
    r = client.post("/gate-pass", json=gp_payload("NR", department="HR"))
    assert r.status_code == 400
    assert "your own (IT)" in r.json()["detail"]


def test_creator_without_department_blocked(client, users):
    nodept = make_user("nodept", "Gate Pass Creator", gp_loc="HO", department=None)
    client.login(nodept)
    r = client.post("/gate-pass", json=gp_payload("NR", department="IT"))
    assert r.status_code == 400
    assert "no department" in r.json()["detail"]


# ═══ Multi-location junction ═════════════════════════════════════════════════
def _assign_locations(username, codes, default):
    db = TestingSession()
    for c in codes:
        db.add(UserGatePassLocation(username=username, location_code=c,
                                    is_default=(c == default)))
    db.commit()
    db.close()


def test_multi_location_user_can_create_at_both(client, users):
    meena = make_user("meena", "Gate Pass Creator", gp_loc="HO", department="Finance")
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
    meena = make_user("meena", "Gate Pass Creator", gp_loc="HO", department="Finance")
    _assign_locations("meena", ["HO", "CHN"], default="HO")
    client.login(meena)
    client.post("/gate-pass", json=gpu_payload(location_code="HO"))
    client.post("/gate-pass", json=gpu_payload(location_code="CHN"))
    assert client.get("/gate-pass").json()["total_count"] == 2


def test_my_locations_returns_starred_default_first(client, users):
    meena = make_user("meena", "Gate Pass Creator", gp_loc="HO", department="Finance")
    _assign_locations("meena", ["CHN", "HO"], default="HO")
    client.login(meena)
    locs = client.get("/gate-pass/my-locations").json()["locations"]
    assert locs[0] == {"location_code": "HO", "is_default": True}
    assert len(locs) == 2


def test_my_locations_legacy_fallback(client, users, gpu_user):
    client.login(gpu_user)                                  # no junction rows
    locs = client.get("/gate-pass/my-locations").json()["locations"]
    assert locs == [{"location_code": "HO", "is_default": True}]


def test_my_locations_no_ita_fallback(client, users):
    """Plain ITA no longer gets the whole master back — empty list."""
    client.login(users["admin"])
    assert client.get("/gate-pass/my-locations").json()["locations"] == []


def test_junction_guard_scoped_by_rows_not_column(client, users):
    """Dispatcher with junction rows for CHN only must not see HO's worklist,
    even though the legacy column says HO."""
    guard = make_user("guardx", "Security Guard, Gate Pass Dispatcher", gp_loc="HO")
    _assign_locations("guardx", ["CHN"], default="CHN")
    gp = create_pass(client, users, "NR")                   # HO pass
    release(client, users, gp["id"])
    client.login(guard)
    assert client.get("/gate-pass/guard/pending?view=dispatch").json()["total_count"] == 0


def test_guard_without_gpd_blocked(client, users):
    """SG without the Dispatcher role: worklist 403s with NO_GPD_ROLE."""
    client.login(users["guard_no_gpd"])
    r = client.get("/gate-pass/guard/pending?view=dispatch")
    assert r.status_code == 403
    assert "NO_GPD_ROLE" in r.json()["detail"]
