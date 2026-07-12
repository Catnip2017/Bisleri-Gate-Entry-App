# tests/test_security_admin_viewonly.py
"""Security Admin is fully VIEW-ONLY (decisions 12 Jul 2026):
(1) edit buttons disabled — only Security Guards edit operational data;
(2) gate entry creation locked server-side behind the view-only pill;
(3) no gate pass access at all (covered in test_gatepassuser_role)."""
from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import Base, get_db
from app.models import InsightsData, RawMaterialsData
from app.routers import gate as gate_module
from app.routers import insights as insights_module
from app.routers import raw_materials as rm_module
from tests.conftest import TestingSession, engine, make_user

SA = lambda: make_user("sa1", "Security Admin", warehouse="WH1")
GUARD = lambda: make_user("guard1", "Security Guard", warehouse="WH1")
ITADMIN = lambda: make_user("admin1", "IT Admin", warehouse="WH1")


@pytest.fixture()
def vclient():
    Base.metadata.create_all(engine)
    db = TestingSession()
    created = datetime.now() - timedelta(hours=2)
    db.add(InsightsData(
        gate_entry_no="GE-1", document_type="PO", document_no="D1",
        vehicle_no="MH01AB1234", warehouse_name="W", date=created, time=created.time(),
        movement_type="Inward", warehouse_code="WH1", site_code="S1",
        security_name="G", security_username="guard1",
        driver_name="Ram", km_reading="1", loader_names="A", edit_count=0,
    ))
    db.add(RawMaterialsData(
        gate_entry_no="RM-1", gate_type="Gate-In", vehicle_no="KA05CD9999",
        document_no="RD1", name_of_party="Acme", description_of_material="Caps",
        quantity="10", date_time=datetime.now() - timedelta(hours=2),
        security_name="G", security_username="guard1",
        warehouse_code="WH1", site_code="S1", edit_count=0,
    ))
    db.commit()
    db.close()

    app = FastAPI()
    app.include_router(insights_module.router)
    app.include_router(rm_module.router)
    app.include_router(gate_module.router)
    current = {"user": SA()}

    def override_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current["user"]
    tc = TestClient(app)
    tc.login = lambda u: current.__setitem__("user", u)
    yield tc
    Base.metadata.drop_all(engine)


# ═══ (1) edit buttons disabled for admin roles ═══════════════════════════════
def test_sa_sees_movements_but_edit_button_is_disabled(vclient):
    r = vclient.get("/movements").json()
    assert r["count"] == 1                                  # oversight: sees it
    row = r["results"][0]
    assert row["can_edit"] is False                          # but cannot touch it
    assert row["edit_button_config"]["enabled"] is False


def test_sa_cannot_update_operational_data(vclient):
    r = vclient.put("/update-operational-data", json={
        "gate_entry_no": "GE-1", "driver_name": "Hacked"})
    assert r.status_code == 403


def test_sa_cannot_update_rm_entry(vclient):
    r = vclient.put("/rm/update-entry", json={
        "gate_entry_no": "RM-1", "quantity": "999"})
    assert r.status_code == 403
    assert "view-only" in r.json()["detail"]


def test_sa_rm_list_shows_can_edit_false(vclient):
    r = vclient.get("/rm/entries").json()
    assert r["count"] == 1
    assert r["results"][0]["can_edit"] is False


def test_guard_still_edits_own_warehouse(vclient):
    vclient.login(GUARD())
    r = vclient.put("/update-operational-data", json={
        "gate_entry_no": "GE-1", "driver_name": "Shyam"})
    assert r.status_code == 200
    assert r.json()["updated_data"]["driver_name"] == "Shyam"


def test_itadmin_also_viewonly_for_edits(vclient):
    vclient.login(ITADMIN())
    r = vclient.put("/update-operational-data", json={
        "gate_entry_no": "GE-1", "driver_name": "Hacked"})
    assert r.status_code == 403


# ═══ (2) gate entry creation locked server-side ══════════════════════════════
CREATE_ENDPOINTS = [
    "/enhanced-batch-gate-entry",
    "/batch-gate-entry",
    "/enhanced-manual-gate-entry",
    "/manual-gate-entry",
    "/assign-document-to-manual-entry",
    "/multi-document-manual-entry",
]


def test_sa_blocked_from_all_gate_entry_creation(vclient):
    for ep in CREATE_ENDPOINTS:
        r = vclient.post(ep, json={})
        assert r.status_code == 403, f"{ep} -> {r.status_code}"
        assert "Only Security Guards" in r.json()["detail"]


def test_itadmin_blocked_from_gate_entry_creation(vclient):
    vclient.login(ITADMIN())
    assert vclient.post("/manual-gate-entry", json={}).status_code == 403


def test_guard_passes_the_role_gate(vclient):
    """Guard with an empty body gets 422 (validation), NOT 403 —
    proof the role gate lets guards through."""
    vclient.login(GUARD())
    assert vclient.post("/manual-gate-entry", json={}).status_code == 422


def test_gpu_blocked_from_gate_entry_creation(vclient):
    vclient.login(make_user("rakesh", "Gate Pass User", department="Finance"))
    assert vclient.post("/manual-gate-entry", json={}).status_code == 403
