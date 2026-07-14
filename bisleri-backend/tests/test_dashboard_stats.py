# tests/test_dashboard_stats.py
"""Tier 2 — Q7/Q15: admin dashboard stats via one SQL aggregation.
Seeds the exact 'tiny register' worked example so every number is
hand-verifiable, including the duplicate-pass and blank-vehicle traps."""
from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import Base, get_db
from app.models import InsightsData, RawMaterialsData
from app.routers import admin as admin_module
from tests.conftest import TestingSession, engine, make_user


def _mv(entry_no, vehicle, mtype, days_ago, warehouse="WH1"):
    d = datetime.combine((datetime.now() - timedelta(days=days_ago)).date(),
                         datetime.min.time())  # date column stores midnight
    return InsightsData(
        gate_entry_no=entry_no, document_type="PO", document_no="D1",
        vehicle_no=vehicle, warehouse_name="W", date=d, time=d.time(),
        movement_type=mtype, warehouse_code=warehouse, site_code="S1",
        security_name="G", security_username="g1", edit_count=0,
    )


@pytest.fixture()
def sclient():
    Base.metadata.create_all(engine)
    db = TestingSession()
    db.add_all([
        # The tiny register: 6 rows, all within the default 7-day window
        _mv("GE-101", "MH01AB1111", "Gate-In", 6),
        _mv("GE-101", "MH01AB1111", "Gate-In", 6),   # duplicate pass no.
        _mv("GE-102", "MH01AB1111", "Gate-Out", 4),
        _mv("GE-103", "KA05CD2222", "Gate-In", 0),   # today
        _mv("GE-104", "", "Gate-Out", 0),            # today, blank vehicle
        _mv("GE-105", "TN10EF3333", "Gate-In", 0),   # today
        # noise in another warehouse — must not leak into WH1-scoped stats
        _mv("GE-901", "DL01ZZ0001", "Gate-In", 1, warehouse="WH2"),
        # RM rows for the RM stats endpoint
        RawMaterialsData(
            gate_entry_no="RM-1", gate_type="Gate-In", vehicle_no="KA05CD9999",
            document_no="RD1", name_of_party="Acme", description_of_material="Caps",
            quantity="10", date_time=datetime.now() - timedelta(hours=3),
            security_name="G", security_username="g1",
            warehouse_code="WH1", site_code="S1", edit_count=2,
        ),
        RawMaterialsData(
            gate_entry_no="RM-2", gate_type="Gate-Out", vehicle_no="KA05CD9999",
            document_no="RD2", name_of_party="Acme", description_of_material="Caps",
            quantity="5", date_time=datetime.now() - timedelta(hours=2),
            security_name="G", security_username="g1",
            warehouse_code="WH1", site_code="S1", edit_count=0,
        ),
    ])
    db.commit()
    db.close()

    app = FastAPI()
    app.include_router(admin_module.router)
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


def test_all_six_numbers_match_hand_count(sclient):
    r = sclient.get("/admin-dashboard-stats", params={"warehouse_code": "WH1"}).json()
    assert r["total_movements"] == 6
    assert r["unique_vehicles"] == 3          # blank vehicle NOT counted
    assert r["gate_in"] == 3                  # GE-101 counted ONCE despite 2 rows
    assert r["gate_out"] == 2
    assert r["today"]["gate_in"] == 2
    assert r["today"]["gate_out"] == 1


def test_legacy_security_admin_string_denied(sclient):
    """SA removed 14 Jul 2026: a leftover 'Security Admin' role string no
    longer grants dashboard access (admin stats are ITA-only)."""
    sclient.login(make_user("sa1", "Security Admin", warehouse="WH2"))
    assert sclient.get("/admin-dashboard-stats").status_code == 403


def test_empty_window_returns_zeros(sclient):
    r = sclient.get("/admin-dashboard-stats", params={
        "from_date": "2020-01-01", "to_date": "2020-01-02"}).json()
    assert r["total_movements"] == 0
    assert r["unique_vehicles"] == 0
    assert r["today"]["gate_in"] == 0


def test_bad_date_is_422_not_500(sclient):
    assert sclient.get("/admin-dashboard-stats",
                       params={"from_date": "garbage", "to_date": "2026-07-12"}).status_code == 422


def test_guard_denied(sclient):
    sclient.login(make_user("g9", "Security Guard", warehouse="WH1"))
    assert sclient.get("/admin-dashboard-stats").status_code == 403


def test_rm_stats_aggregation(sclient):
    r = sclient.get("/admin-rm-statistics", params={"warehouse_code": "WH1"}).json()
    assert r["total_entries"] == 2
    assert r["gate_in_count"] == 1
    assert r["gate_out_count"] == 1
    assert r["unique_vehicles"] == 1          # same vehicle both entries
    assert r["edited_entries"] == 1           # only RM-1 has edit_count > 0
