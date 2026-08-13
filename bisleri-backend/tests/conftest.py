# tests/conftest.py
"""Shared fixtures for the Bisleri backend test suite (Pass 3 — Q13).

Run from bisleri-backend/ with:  pytest
Tier 1 tests (roles / edit window / edit service / errors) need nothing.
Tier 2 tests (gate pass API) run against an in-memory SQLite DB with the
real FastAPI router mounted — auth and DB are dependency-overridden, so no
Postgres and no JWT are needed.

NOTE: SQLite ignores row locks (SELECT ... FOR UPDATE), so true concurrency
(two guards dispatching the same pass at the same instant) is NOT covered
here — that behaviour relies on Postgres and is verified on the dev DB.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from datetime import date, timedelta  # noqa: E402

import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.auth import get_current_user  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.models import UsersMaster  # noqa: E402
from app.models.gate_pass import (  # noqa: E402
    GatePassCancelReason,
    GatePassDepartment,
    GatePassItem,
    GatePassLocation,
    GatePassParty,
)
from app.routers import gate_pass as gate_pass_module  # noqa: E402

# ── in-memory DB shared across connections in one test ──────────────────────
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def make_user(username, role, gp_loc=None, department=None, warehouse=None):
    """Build a non-persisted UsersMaster for the auth override."""
    return UsersMaster(
        username=username,
        first_name=username,
        last_name="Test",
        role=role,
        gate_pass_location=gp_loc,
        department=department,
        warehouse_code=warehouse,
    )


@pytest.fixture()
def users():
    """The cast of characters used across gate pass tests."""
    return {
        # Role model LOCKED 14 Jul 2026: GPC creates, SG+GPD dispatches,
        # ITA alone has NO gate pass access, ITA+GPC is scoped like any GPC.
        "initiator": make_user("init1", "Gate Pass Creator", department="IT", gp_loc="HO"),
        "admin": make_user("admin1", "IT Admin"),
        "admin_creator": make_user("admin2", "IT Admin, Gate Pass Creator", department="IT", gp_loc="HO"),
        "guard_ho": make_user("guard1", "Security Guard, Gate Pass Dispatcher", gp_loc="HO"),
        "guard_chn": make_user("guard2", "Security Guard, Gate Pass Dispatcher", gp_loc="CHN"),
        "guard_no_loc": make_user("guard3", "Security Guard, Gate Pass Dispatcher", gp_loc=None),
        "guard_no_gpd": make_user("guard4", "Security Guard", gp_loc="HO"),
        "outsider": make_user("sales1", "Co Packer"),
    }


@pytest.fixture()
def client(users):
    """TestClient with a fresh seeded DB per test. Switch identity with
    client.login(users['guard_ho'])."""
    Base.metadata.create_all(engine)
    db = TestingSession()
    db.add_all([
        GatePassLocation(location_code="HO", location_name="Head Office", warehouse_code="WH-HO"),
        GatePassLocation(location_code="CHN", location_name="Chennai", warehouse_code=None),
        GatePassParty(party_code="P001", party_name="Acme Services",
                      city="Mumbai", post_code="400099", phone_no="9920988105",
                      contact="R. Mehta"),
        GatePassItem(item_code="FA-LAP-001", item_name="Dell Laptop", fa_class_code="COMP"),
        GatePassCancelReason(id=1, reason_text="Wrong party selected", sort_order=1),
        GatePassCancelReason(id=2, reason_text="Duplicate pass", sort_order=2),
        # Real master values (department table replaced the hardcoded list,
        # 3 Aug 2026) — "Accounts" stands in for the old "Finance" test
        # fixture value, which isn't in the real department master.
        GatePassDepartment(department_name="IT", sort_order=1),
        GatePassDepartment(department_name="Accounts", sort_order=2),
        GatePassDepartment(department_name="HR", sort_order=3),
    ])
    db.commit()
    db.close()

    test_app = FastAPI()
    test_app.include_router(gate_pass_module.router)

    current = {"user": users["initiator"]}

    def override_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    def override_user():
        return current["user"]

    test_app.dependency_overrides[get_db] = override_db
    test_app.dependency_overrides[get_current_user] = override_user

    tc = TestClient(test_app)
    tc.login = lambda user: current.__setitem__("user", user)
    yield tc
    Base.metadata.drop_all(engine)


# ── payload helpers ──────────────────────────────────────────────────────────
def gp_payload(pass_type="NR", **overrides):
    """A valid create payload; override any field per test."""
    payload = {
        "pass_type": pass_type,
        "location_code": "HO",
        "party_code": "P001",
        "department": "IT",
        "mode_of_transport": "Hand Delivery",
        "lines": [
            {"description": "Dell Laptop", "quantity": 2, "uom": "NOS"},
        ],
    }
    if pass_type == "R":
        payload["expected_inward_date"] = str(date.today() + timedelta(days=7))
    payload.update(overrides)
    return payload


def create_pass(client, users, pass_type="NR", **overrides):
    """Create a pass as the initiator; returns the JSON (id, gate_pass_no)."""
    client.login(users["initiator"])
    r = client.post("/gate-pass", json=gp_payload(pass_type, **overrides))
    assert r.status_code == 201, r.text
    return r.json()


def release(client, users, pass_id):
    client.login(users["initiator"])
    r = client.post(f"/gate-pass/{pass_id}/release")
    assert r.status_code == 200, r.text
    return r.json()


def dispatch(client, users, pass_id, who="guard_ho"):
    client.login(users[who])
    return client.post(f"/gate-pass/{pass_id}/dispatch", json={"security_remarks": "ok"})


def get_line_ids(client, users, pass_id):
    # ITA alone sees no passes (locked model) — view as ITA+GPC (IT dept, HO)
    client.login(users["admin_creator"])
    r = client.get(f"/gate-pass/{pass_id}")
    assert r.status_code == 200, r.text
    return {l["line_no"]: l["id"] for l in r.json()["lines"]}
