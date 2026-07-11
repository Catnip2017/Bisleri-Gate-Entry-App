# tests/test_gate_pass_flow.py
"""Tier 2 — gate pass module API tests (locked design decisions from the
context summary, verified end-to-end against the real router).

Covers: numbering, lifecycle NR & R, cancel rules, partial returns,
force close, guard location scoping, NO_GP_LOCATION, access control.
"""
from datetime import date, timedelta

from tests.conftest import create_pass, dispatch, get_line_ids, gp_payload, release


# ═════════════════════ Numbering ═════════════════════════════════════════════
def test_numbers_increment_per_location_and_type(client, users):
    first = create_pass(client, users, "NR")
    second = create_pass(client, users, "NR")
    r_pass = create_pass(client, users, "R")
    assert first["gate_pass_no"] == "NRHO1"
    assert second["gate_pass_no"] == "NRHO2"
    assert r_pass["gate_pass_no"] == "RHO1"  # R series independent of NR


def test_cancelled_number_is_never_reused(client, users):
    first = create_pass(client, users, "NR")
    client.post(f"/gate-pass/{first['id']}/cancel",
                json={"cancel_reason_id": 2, "cancel_remarks": "dup"})
    replacement = create_pass(client, users, "NR")
    assert first["gate_pass_no"] == "NRHO1"
    assert replacement["gate_pass_no"] == "NRHO2"  # 1 stays spent forever


# ═════════════════════ Create validation ═════════════════════════════════════
def test_r_pass_requires_expected_inward_date(client, users):
    client.login(users["initiator"])
    payload = gp_payload("R")
    del payload["expected_inward_date"]
    r = client.post("/gate-pass", json=payload)
    assert r.status_code == 400
    assert "Expected inward date is required" in r.json()["detail"]


def test_nr_pass_forbids_expected_inward_date(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload(
        "NR", expected_inward_date=str(date.today() + timedelta(days=3))))
    assert r.status_code == 400


def test_expected_inward_date_cannot_be_past(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload(
        "R", expected_inward_date=str(date.today() - timedelta(days=1))))
    assert r.status_code == 400


def test_vehicle_mode_requires_vehicle_no(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload("NR", mode_of_transport="Vehicle"))
    assert r.status_code == 400
    assert "Vehicle number is required" in r.json()["detail"]


def test_invalid_department_rejected(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload("NR", department="Warehouse"))
    assert r.status_code == 400


def test_unknown_party_rejected(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload("NR", party_code="NOPE"))
    assert r.status_code == 400


def test_unknown_item_code_rejected(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload("NR", lines=[
        {"description": "Mystery box", "quantity": 1, "item_code": "GHOST-1"}]))
    assert r.status_code == 400


def test_non_initiator_cannot_create(client, users):
    client.login(users["outsider"])
    r = client.post("/gate-pass", json=gp_payload("NR"))
    assert r.status_code == 403


# ═════════════════════ Lifecycle NR: Open→Released→Dispatched ═══════════════
def test_nr_happy_path(client, users):
    gp = create_pass(client, users, "NR")
    assert gp["status"] == "Open"
    assert release(client, users, gp["id"])["status"] == "Released"
    r = dispatch(client, users, gp["id"])
    assert r.status_code == 200
    assert r.json()["status"] == "Dispatched"


def test_cannot_release_twice(client, users):
    gp = create_pass(client, users, "NR")
    release(client, users, gp["id"])
    client.login(users["initiator"])
    r = client.post(f"/gate-pass/{gp['id']}/release")
    assert r.status_code == 409


def test_cannot_dispatch_open_pass(client, users):
    gp = create_pass(client, users, "NR")
    r = dispatch(client, users, gp["id"])  # never released
    assert r.status_code == 409


def test_nr_dispatched_is_terminal(client, users):
    gp = create_pass(client, users, "NR")
    release(client, users, gp["id"])
    dispatch(client, users, gp["id"])
    assert dispatch(client, users, gp["id"]).status_code == 409  # no re-dispatch
    client.login(users["guard_ho"])
    r = client.post(f"/gate-pass/{gp['id']}/inward",
                    json={"receipts": [{"line_id": 1, "received_qty": 1}]})
    assert r.status_code == 409  # NR has no inward leg


def test_release_nonexistent_pass_404(client, users):
    client.login(users["initiator"])
    assert client.post("/gate-pass/9999/release").status_code == 404


# ═════════════════════ Cancel rules ══════════════════════════════════════════
def test_cancel_from_open_and_released_only(client, users):
    open_gp = create_pass(client, users, "NR")
    released_gp = create_pass(client, users, "NR")
    release(client, users, released_gp["id"])
    dispatched_gp = create_pass(client, users, "NR")
    release(client, users, dispatched_gp["id"])
    dispatch(client, users, dispatched_gp["id"])

    client.login(users["initiator"])
    ok1 = client.post(f"/gate-pass/{open_gp['id']}/cancel",
                      json={"cancel_reason_id": 1})
    ok2 = client.post(f"/gate-pass/{released_gp['id']}/cancel",
                      json={"cancel_reason_id": 1})
    blocked = client.post(f"/gate-pass/{dispatched_gp['id']}/cancel",
                          json={"cancel_reason_id": 1})
    assert ok1.status_code == 200 and ok1.json()["status"] == "Cancelled"
    assert ok2.status_code == 200
    assert blocked.status_code == 409  # material already left the gate


def test_cancel_requires_valid_reason(client, users):
    gp = create_pass(client, users, "NR")
    client.login(users["initiator"])
    r = client.post(f"/gate-pass/{gp['id']}/cancel", json={"cancel_reason_id": 999})
    assert r.status_code == 400


# ═════════════════════ R lifecycle: partial returns ══════════════════════════
def test_partial_then_full_inward(client, users):
    gp = create_pass(client, users, "R", lines=[
        {"description": "Dell Laptop", "quantity": 5, "uom": "NOS"}])
    release(client, users, gp["id"])
    dispatch(client, users, gp["id"])
    line_id = list(get_line_ids(client, users, gp["id"]).values())[0]

    client.login(users["guard_ho"])
    part = client.post(f"/gate-pass/{gp['id']}/inward",
                       json={"receipts": [{"line_id": line_id, "received_qty": 2}]})
    assert part.status_code == 200
    assert part.json()["status"] == "Partially Received"
    assert part.json()["outstanding_quantity"] == 3

    rest = client.post(f"/gate-pass/{gp['id']}/inward",
                       json={"receipts": [{"line_id": line_id, "received_qty": 3}]})
    assert rest.json()["status"] == "Inward Received"
    assert rest.json()["outstanding_quantity"] == 0


def test_over_receipt_rejected(client, users):
    gp = create_pass(client, users, "R", lines=[
        {"description": "Dell Laptop", "quantity": 2, "uom": "NOS"}])
    release(client, users, gp["id"])
    dispatch(client, users, gp["id"])
    line_id = list(get_line_ids(client, users, gp["id"]).values())[0]
    client.login(users["guard_ho"])
    r = client.post(f"/gate-pass/{gp['id']}/inward",
                    json={"receipts": [{"line_id": line_id, "received_qty": 3}]})
    assert r.status_code == 400
    assert "only 2 outstanding" in r.json()["detail"]


def test_foreign_line_id_rejected(client, users):
    gp1 = create_pass(client, users, "R")
    gp2 = create_pass(client, users, "R")
    for gp in (gp1, gp2):
        release(client, users, gp["id"])
        dispatch(client, users, gp["id"])
    gp2_line = list(get_line_ids(client, users, gp2["id"]).values())[0]
    client.login(users["guard_ho"])
    r = client.post(f"/gate-pass/{gp1['id']}/inward",
                    json={"receipts": [{"line_id": gp2_line, "received_qty": 1}]})
    assert r.status_code == 400


# ═════════════════════ Force close ═══════════════════════════════════════════
def test_force_close_admin_only(client, users):
    gp = create_pass(client, users, "R")
    release(client, users, gp["id"])
    dispatch(client, users, gp["id"])
    client.login(users["guard_ho"])
    denied = client.post(f"/gate-pass/{gp['id']}/force-close",
                         json={"close_reason": "items written off"})
    assert denied.status_code == 403
    client.login(users["admin"])
    ok = client.post(f"/gate-pass/{gp['id']}/force-close",
                     json={"close_reason": "items written off"})
    assert ok.status_code == 200
    assert ok.json()["status"] == "Closed Without Return"


def test_force_close_needs_dispatched_returnable(client, users):
    nr = create_pass(client, users, "NR")
    release(client, users, nr["id"])
    dispatch(client, users, nr["id"])
    client.login(users["admin"])
    r = client.post(f"/gate-pass/{nr['id']}/force-close",
                    json={"close_reason": "items written off"})
    assert r.status_code == 409  # NR can never be force closed


# ═════════════════════ Guard scoping & access ════════════════════════════════
def test_guard_without_location_gets_no_gp_location(client, users):
    client.login(users["guard_no_loc"])
    r = client.get("/gate-pass/guard/pending?view=dispatch")
    assert r.status_code == 403
    assert r.json()["detail"] == "NO_GP_LOCATION"


def test_guard_sees_only_own_location_worklist(client, users):
    gp = create_pass(client, users, "NR")  # location HO
    release(client, users, gp["id"])
    client.login(users["guard_ho"])
    ho = client.get("/gate-pass/guard/pending?view=dispatch").json()
    client.login(users["guard_chn"])
    chn = client.get("/gate-pass/guard/pending?view=dispatch").json()
    assert ho["total_count"] == 1
    assert chn["total_count"] == 0


def test_guard_cannot_dispatch_other_locations_pass(client, users):
    gp = create_pass(client, users, "NR")  # HO
    release(client, users, gp["id"])
    r = dispatch(client, users, gp["id"], who="guard_chn")
    assert r.status_code == 403
    assert "another location" in r.json()["detail"]


def test_guard_cannot_open_detail_of_open_pass(client, users):
    gp = create_pass(client, users, "NR")  # still Open — not the guard's business
    client.login(users["guard_ho"])
    assert client.get(f"/gate-pass/{gp['id']}").status_code == 403
    release(client, users, gp["id"])
    client.login(users["guard_ho"])
    assert client.get(f"/gate-pass/{gp['id']}").status_code == 200


def test_outsider_cannot_use_guard_endpoints(client, users):
    client.login(users["outsider"])
    assert client.get("/gate-pass/guard/pending").status_code == 403
