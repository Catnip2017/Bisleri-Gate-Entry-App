# tests/test_pipeline_masters.py
"""Pipeline master rules: Fixed Asset lines come from the asset master
(code must exist, description forced from master, FA class snapshotted at
creation); Item lines are matched or created by name against the
user-populated Item master. Vendor/Customer search returns the full
Navision column set."""
from tests.conftest import create_pass, gp_payload


def _fa_line(**over):
    base = {"item_type": "Fixed Asset", "asset_code": "FA-LAP-001",
            "description": "typed-by-user", "quantity": 1, "uom": "NOS"}
    base.update(over)
    return base


def test_fa_line_snapshots_class_and_keeps_user_description(client, users):
    # User may edit the auto-filled description (decision 14 Jul 2026):
    # typed text is kept; the class snapshot still comes from the master.
    gp = create_pass(client, users, "NR", lines=[
        _fa_line(description="Dell Laptop - with charger and bag")])
    client.login(users["initiator"])
    detail = client.get(f"/gate-pass/{gp['id']}").json()
    line = detail["lines"][0]
    assert line["asset_code"] == "FA-LAP-001"
    assert line["fa_class_code"] == "COMP"           # snapshotted from master
    assert line["description"] == "Dell Laptop - with charger and bag"


def test_fa_line_unknown_code_rejected(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload(
        "NR", lines=[_fa_line(asset_code="FA-NOPE-999")]))
    assert r.status_code == 400
    assert "unknown or inactive" in r.json()["detail"]


def test_fa_line_without_code_rejected(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload(
        "NR", lines=[_fa_line(asset_code=None)]))
    assert r.status_code == 400
    assert "must reference an Asset No." in r.json()["detail"]


def test_item_line_creates_and_reuses_master_row(client, users):
    gp = create_pass(client, users, "NR", lines=[
        {"item_type": "Item", "description": "Courier envelope with samples",
         "quantity": 2, "uom": "NOS"}])
    client.login(users["initiator"])
    line = client.get(f"/gate-pass/{gp['id']}").json()["lines"][0]
    assert line["asset_code"] is None
    assert line["fa_class_code"] is None
    assert line["item_id"] is not None
    assert line["description"] == "Courier envelope with samples"

    # Same name (any case) on a second pass reuses the same item_id.
    gp2 = create_pass(client, users, "NR", lines=[
        {"item_type": "Item", "description": "courier envelope with samples",
         "quantity": 1, "uom": "NOS"}])
    client.login(users["initiator"])
    line2 = client.get(f"/gate-pass/{gp2['id']}").json()["lines"][0]
    assert line2["item_id"] == line["item_id"]


def test_item_line_with_asset_code_rejected(client, users):
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload("NR", lines=[
        {"item_type": "Item", "asset_code": "FA-LAP-001",
         "description": "sneaky", "quantity": 1, "uom": "NOS"}]))
    assert r.status_code == 400
    assert "Item master" in r.json()["detail"]


def test_vendor_search_returns_full_columns(client, users):
    client.login(users["initiator"])
    rows = client.get("/gate-pass/vendors?q=acme").json()
    assert rows and rows[0]["vendor_code"] == "P001"
    assert rows[0]["city"] == "Mumbai"
    assert rows[0]["post_code"] == "400099"
    assert rows[0]["phone_no"] == "9920988105"
    assert rows[0]["contact"] == "R. Mehta"


def test_customer_search_returns_full_columns(client, users):
    client.login(users["initiator"])
    rows = client.get("/gate-pass/customers?q=beta").json()
    assert rows and rows[0]["customer_code"] == "C001"
    assert rows[0]["city"] == "Pune"


def test_asset_search_returns_class_code(client, users):
    client.login(users["initiator"])
    rows = client.get("/gate-pass/assets?q=FA-LAP").json()
    assert rows and rows[0]["fa_class_code"] == "COMP"
