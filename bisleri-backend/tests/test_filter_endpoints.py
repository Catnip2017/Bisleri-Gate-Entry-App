# tests/test_filter_endpoints.py
"""Tier 2 — Q6/Q10/Q11: typed filter bodies + GET twins for the FG movements
and RM entries list endpoints."""
from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import Base, get_db
from app.models import InsightsData, RawMaterialsData
from app.routers import insights as insights_module
from app.routers import raw_materials as rm_module
from tests.conftest import TestingSession, engine, make_user


def _insight(vehicle="MH01AB1234", warehouse="WH1", movement="Inward", hours_ago=2):
    created = datetime.now() - timedelta(hours=hours_ago)
    return InsightsData(
        gate_entry_no=f"GE-{vehicle}-{hours_ago}",
        document_type="PO", document_no="DOC1",
        vehicle_no=vehicle, warehouse_name="W One",
        date=created, time=created.time(),
        movement_type=movement, warehouse_code=warehouse, site_code="S1",
        security_name="Guard One", security_username="guard1",
        driver_name="Ram", km_reading="123", loader_names="A,B", edit_count=0,
    )


def _rm_entry(vehicle="KA05CD9999", warehouse="WH1", gate_type="Gate-In", hours_ago=2):
    return RawMaterialsData(
        gate_entry_no=f"RM-{vehicle}-{hours_ago}", gate_type=gate_type,
        vehicle_no=vehicle, document_no="RMDOC1", name_of_party="Acme",
        description_of_material="Caps", quantity="100",
        date_time=datetime.now() - timedelta(hours=hours_ago),
        security_name="Guard One", security_username="guard1",
        warehouse_code=warehouse, site_code="S1",
    )


@pytest.fixture()
def fclient():
    """Client with the insights + raw_materials routers and seeded rows."""
    Base.metadata.create_all(engine)
    db = TestingSession()
    db.add_all([
        _insight(vehicle="MH01AB1234", warehouse="WH1"),
        _insight(vehicle="KA05XX0001", warehouse="WH2", hours_ago=3),
        _rm_entry(vehicle="KA05CD9999", warehouse="WH1"),
        _rm_entry(vehicle="TN10ZZ0001", warehouse="WH2", hours_ago=3),
    ])
    db.commit()
    db.close()

    app = FastAPI()
    app.include_router(insights_module.router)
    app.include_router(rm_module.router)
    current = {"user": make_user("admin1", "IT Admin", warehouse="WH1")}

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


# ── Q6/Q10: validation instead of 500s / silence ────────────────────────────
def test_bad_date_is_422_not_500(fclient):
    r = fclient.get("/movements", params={"from_date": "01-07-2026"})
    assert r.status_code == 422
    assert "from_date" in r.text


def test_bad_date_on_rm_is_422_not_500(fclient):
    r = fclient.get("/rm/entries", params={"from_date": "not-a-date"})
    assert r.status_code == 422


def test_typo_field_name_rejected_by_schema():
    """extra='forbid' regression at the schema level (the HTTP POST route
    that carried this body is retired; the GET twins use typed params)."""
    import pytest as _pytest
    from pydantic import ValidationError
    from app.schemas.filter_schemas import MovementFilters
    with _pytest.raises(ValidationError, match="vehcile_no"):
        MovementFilters(vehcile_no="MH01")


def test_valid_get_works(fclient):
    r = fclient.get("/movements", params={"vehicle_no": "MH01"})
    assert r.status_code == 200
    assert r.json()["count"] == 1
    assert r.json()["results"][0]["vehicle_no"] == "MH01AB1234"


def test_no_filters_returns_everything_for_admin(fclient):
    r = fclient.get("/movements")
    assert r.status_code == 200
    assert r.json()["count"] == 2


# ── Q11 phase 2: deprecated POST routes are RETIRED ──────────────────────────
def test_post_routes_are_gone(fclient):
    assert fclient.post("/filtered-movements", json={}).status_code in (404, 405)
    assert fclient.post("/rm/filtered-entries", json={}).status_code in (404, 405)
    assert fclient.post("/rm/admin-filtered-entries", json={}).status_code in (404, 405)


def test_get_rm_entries_works(fclient):
    get = fclient.get("/rm/entries", params={"vehicle_no": "KA05CD"}).json()
    assert get["count"] == 1


def test_get_admin_entries_works(fclient):
    r = fclient.get("/rm/admin-entries", params={"warehouse_code": "WH2"})
    assert r.status_code == 200
    assert r.json()["count"] == 1


def test_get_movements_bad_date_is_422(fclient):
    assert fclient.get("/movements", params={"from_date": "garbage"}).status_code == 422


# ── security scoping survives the refactor ───────────────────────────────────
def test_non_admin_stays_warehouse_locked_even_when_asking_for_more(fclient):
    fclient.login(make_user("sa1", "Security Admin", warehouse="WH1"))
    r = fclient.get("/movements", params={"warehouse_code": "WH2"})
    assert r.status_code == 200
    rows = r.json()["results"]
    assert all(m["to_warehouse_code"] == "WH1" for m in rows)  # WH2 request ignored


def test_rm_admin_endpoint_requires_admin_role(fclient):
    fclient.login(make_user("guard9", "Security Guard", warehouse="WH1"))
    assert fclient.get("/rm/admin-entries").status_code == 403


# ── legacy edit endpoint: old JSON shape still accepted ──────────────────────
def test_legacy_update_gate_entry_still_accepts_old_shape(fclient):
    fclient.login(make_user("guard1", "Security Guard", warehouse="WH1"))
    r = fclient.put("/update-gate-entry", json={
        "gate_entry_no": "GE-MH01AB1234-2",
        "driver_name": "Shyam",
    })
    assert r.status_code == 200, r.text
    assert r.json()["updated_data"]["driver_name"] == "Shyam"
