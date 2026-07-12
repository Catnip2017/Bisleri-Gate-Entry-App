# tests/test_pagination.py
"""Tier 2 — Q8/Q16: pagination on movements/RM lists and /list-users."""
from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import Base, get_db
from app.models import InsightsData, UsersMaster
from app.routers import admin as admin_module
from app.routers import insights as insights_module
from tests.conftest import TestingSession, engine, make_user


def _insight(i):
    created = datetime.now() - timedelta(hours=i + 1)
    return InsightsData(
        gate_entry_no=f"GE-{i:03d}", document_type="PO", document_no=f"D{i}",
        vehicle_no=f"MH01AB{i:04d}", warehouse_name="W One",
        date=created, time=created.time(), movement_type="Inward",
        warehouse_code="WH1", site_code="S1",
        security_name="G", security_username="guard1",
        driver_name="Ram", km_reading="1", loader_names="A", edit_count=0,
    )


@pytest.fixture()
def pclient():
    Base.metadata.create_all(engine)
    db = TestingSession()
    db.add_all([_insight(i) for i in range(15)])          # 15 movements
    db.add_all([                                          # 7 users
        UsersMaster(username=f"user{i:02d}", first_name=f"U{i}", last_name="T",
                    role="Security Guard", password="x")
        for i in range(7)
    ])
    db.commit()
    db.close()

    app = FastAPI()
    app.include_router(insights_module.router)
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


# ── Q8: movements paging ─────────────────────────────────────────────────────
def test_default_behaviour_unchanged(pclient):
    """No paging fields sent (today's frontend) -> everything, as before."""
    r = pclient.get("/movements").json()
    assert r["count"] == 15
    assert r["total_count"] == 15


def test_limit_slices_but_total_reports_all(pclient):
    r = pclient.get("/movements", params={"limit": 5}).json()
    assert r["count"] == 5           # this page
    assert r["total_count"] == 15    # what exists
    assert r["limit"] == 5 and r["skip"] == 0


def test_pages_do_not_overlap(pclient):
    page1 = pclient.get("/movements", params={"limit": 5, "skip": 0}).json()
    page2 = pclient.get("/movements", params={"limit": 5, "skip": 5}).json()
    ids1 = {m["gate_entry_no"] for m in page1["results"]}
    ids2 = {m["gate_entry_no"] for m in page2["results"]}
    assert len(ids1) == len(ids2) == 5
    assert ids1.isdisjoint(ids2)


def test_last_page_is_short(pclient):
    r = pclient.get("/movements", params={"limit": 6, "skip": 12}).json()
    assert r["count"] == 3           # 15 rows -> pages of 6,6,3
    assert r["total_count"] == 15


def test_limit_too_large_is_422(pclient):
    assert pclient.get("/movements", params={"limit": 9999}).status_code == 422


def test_negative_skip_is_422(pclient):
    assert pclient.get("/movements", params={"skip": -1}).status_code == 422


def test_paging_respects_filters(pclient):
    """total_count reflects the FILTERED set, not the whole table."""
    r = pclient.get("/movements", params={"vehicle_no": "MH01AB0001", "limit": 5}).json()
    assert r["total_count"] == 1 and r["count"] == 1


# ── Q16: /list-users paging ──────────────────────────────────────────────────
def test_list_users_default_and_order(pclient):
    r = pclient.get("/list-users")
    assert r.status_code == 200
    names = [u["username"] for u in r.json()]
    assert names == sorted(names)    # deterministic alphabetical pages


def test_list_users_pages_do_not_overlap(pclient):
    p1 = {u["username"] for u in pclient.get("/list-users", params={"limit": 3, "skip": 0}).json()}
    p2 = {u["username"] for u in pclient.get("/list-users", params={"limit": 3, "skip": 3}).json()}
    assert len(p1) == len(p2) == 3
    assert p1.isdisjoint(p2)


def test_list_users_cap_enforced(pclient):
    assert pclient.get("/list-users", params={"limit": 501}).status_code == 422


def test_list_users_still_itadmin_only(pclient):
    pclient.login(make_user("guard1", "Security Guard"))
    assert pclient.get("/list-users").status_code == 403
