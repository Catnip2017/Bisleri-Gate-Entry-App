# tests/test_pipeline_masters.py
"""Pipeline master rules (14 Jul 2026): Fixed Asset lines come from the
asset master (code must exist, description forced from master, FA class
snapshotted at creation); Item lines are free text and may not carry a
code. Party search returns the full Navision column set."""
from tests.conftest import create_pass, gp_payload


def _fa_line(**over):
    base = {"item_type": "Fixed Asset", "item_code": "FA-LAP-001",
            "description": "typed-by-user", "quantity": 1, "uom": "NOS"}
    base.update(over)
    return base


def test_fa_line_snapshots_class_and_uses_master_description(client, users):
    gp = create_pass(client, users, "NR", lines=[_fa_line()])
    client.login(users["initiator"])
    detail = client.get(f"/gate-pass/{gp['id']}").json()
    line = detail["lines"][0]
    assert line["item_code"] == "FA-LAP-001"
    assert line["fa_class_code"] == "COMP"           # snapshotted from master
    assert line["description"] == "Dell Laptop"      # master name, not user text


def test_fa_line_unknown_code_rejected(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload(
        "NR", lines=[_fa_line(item_code="FA-NOPE-999")]))
    assert r.status_code == 400
    assert "unknown or inactive" in r.json()["detail"]


def test_fa_line_without_code_rejected(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload(
        "NR", lines=[_fa_line(item_code=None)]))
    assert r.status_code == 400
    assert "must reference an Asset No." in r.json()["detail"]


def test_item_line_free_text_stored(client, users):
    gp = create_pass(client, users, "NR", lines=[
        {"item_type": "Item", "description": "Courier envelope with samples",
         "quantity": 2, "uom": "NOS"}])
    client.login(users["initiator"])
    line = client.get(f"/gate-pass/{gp['id']}").json()["lines"][0]
    assert line["item_code"] is None
    assert line["fa_class_code"] is None
    assert line["description"] == "Courier envelope with samples"


def test_item_line_with_code_rejected(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload("NR", lines=[
        {"item_type": "Item", "item_code": "FA-LAP-001",
         "description": "sneaky", "quantity": 1, "uom": "NOS"}]))
    assert r.status_code == 400
    assert "free text" in r.json()["detail"]


def test_party_search_returns_full_columns(client, users):
    client.login(users["initiator"])
    rows = client.get("/gate-pass/parties?q=acme").json()
    assert rows and rows[0]["party_code"] == "P001"
    assert rows[0]["city"] == "Mumbai"
    assert rows[0]["post_code"] == "400099"
    assert rows[0]["phone_no"] == "9920988105"
    assert rows[0]["contact"] == "R. Mehta"


def test_item_search_returns_class_code(client, users):
    client.login(users["initiator"])
    rows = client.get("/gate-pass/items?q=FA-LAP").json()
    assert rows and rows[0]["fa_class_code"] == "COMP"
    assert "uom" not in rows[0] and "item_type" not in rows[0]
