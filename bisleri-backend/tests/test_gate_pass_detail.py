# tests/test_gate_pass_detail.py - GET /gate-pass/{id} (27 Nov 2026).
# The detail response used to fail with "got multiple values for keyword
# argument 'dispatched_by'" (Print and Dispatch both open the pass first).
from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import Base, get_db
from app.models import UsersMaster
from app.models.gate_pass import GatePassHeader
from app.routers import gate_pass as gp_module
from tests.conftest import TestingSession, engine


def test_pass_detail_returns_dispatched_and_cancelled_by():
    Base.metadata.create_all(bind=engine)
    db = TestingSession()
    db.add(UsersMaster(username="adm", first_name="A", last_name="B", role="IT Admin"))
    db.add(UsersMaster(username="sa", first_name="S", last_name="A", role="Security Admin",
                       gate_pass_location="MUM"))
    db.add(GatePassHeader(
        gate_pass_no="NR-HO-2026-27-000001", pass_type="NR", status="Dispatched", location_code="MUM",
        document_date=date.today(), document_time="10:00:00", party_type="Vendor", party_code="V1",
        party_name="Vendor One", department="IT", mode_of_transport="Hand Delivery", created_by="adm",
        dispatched_by="guard1", cancelled_by=None))
    db.commit()
    pid = db.query(GatePassHeader).first().id
    app = FastAPI()
    app.include_router(gp_module.router)

    def _db():
        s = TestingSession()
        try:
            yield s
        finally:
            s.close()
    app.dependency_overrides[get_db] = _db
    state = {"u": db.query(UsersMaster).get("sa")}
    app.dependency_overrides[get_current_user] = lambda: state["u"]
    r = TestClient(app).get(f"/gate-pass/{pid}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["dispatched_by"] == "guard1" and body["cancelled_by"] is None
    assert body["gate_pass_no"] == "NR-HO-2026-27-000001"
    db.close()
    Base.metadata.drop_all(bind=engine)
