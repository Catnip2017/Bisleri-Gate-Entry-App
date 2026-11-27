# tests/test_password_viewas_docs.py - Password policy, old-format self-reset,
# "View as user" and the Documents folders (27 Nov 2026). Uses the REAL
# get_current_user with real JWTs, so the token restrictions are exercised.
import hashlib

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_password_hash
from app.config import settings
from app.database import Base, get_db
from app.models import UsersMaster, LocationMaster
from app.models.security import AuditLog
from app.routers import admin as admin_module
from app.routers import auth as auth_module
from app.routers import security as security_module
from app.routers import library as library_module
from app.services import security as sec
from tests.conftest import TestingSession, engine


@pytest.fixture()
def c():
    sec._reset_ready_cache()
    sec._seen_cache.clear()
    Base.metadata.create_all(engine)
    db = TestingSession()
    db.add_all([
        LocationMaster(warehouse_code="WH1", warehouse_name="Mumbai", site_code="MUM"),
        UsersMaster(username="adm", first_name="Ad", last_name="Min", role="IT Admin",
                    password=get_password_hash("Secret@1"), phone_number="9000000001"),
        UsersMaster(username="adm2", first_name="Ad", last_name="Two", role="IT Admin",
                    password=get_password_hash("Secret@1"), phone_number="9000000004"),
        UsersMaster(username="g1", first_name="Guard", last_name="One", role="Security Guard",
                    warehouse_code="WH1", password=get_password_hash("weakpass"), phone_number="9000000002"),
        UsersMaster(username="old1", first_name="Old", last_name="Pw", role="Security Guard",
                    warehouse_code="WH1", password=hashlib.sha256(b"oldpass").hexdigest(), phone_number="9000000003"),
    ])
    db.commit()
    db.close()
    app = FastAPI()
    for r in (auth_module.router, admin_module.router, security_module.router, library_module.router):
        app.include_router(r)

    def _db():
        s = TestingSession()
        try:
            yield s
        finally:
            s.close()
    app.dependency_overrides[get_db] = _db
    yield TestClient(app)
    Base.metadata.drop_all(bind=engine)
    sec._reset_ready_cache()


def login(c, u, p):
    return c.post("/login", json={"username": u, "password": p})


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_old_format_password_self_reset(c):
    r = login(c, "old1", "oldpass")
    assert r.status_code == 200 and r.json()["password_change_required"] == "legacy"
    tok = r.json()["access_token"]
    # restricted token: nothing but the password change
    assert c.get("/users-overview", headers=H(tok)).json()["detail"] == "PASSWORD_CHANGE_REQUIRED"
    assert c.get("/me/account-status", headers=H(tok)).json()["password_change_required"] == "legacy"
    assert c.post("/me/change-password", headers=H(tok),
                  json={"current_password": "wrong", "new_password": "Better@1"}).status_code == 400
    assert c.post("/me/change-password", headers=H(tok),
                  json={"current_password": "oldpass", "new_password": "weak"}).status_code == 400
    r = c.post("/me/change-password", headers=H(tok), json={"current_password": "oldpass", "new_password": "Better@1"})
    assert r.status_code == 200, r.text
    assert login(c, "old1", "oldpass").status_code == 401
    r = login(c, "old1", "Better@1")
    assert r.status_code == 200 and r.json()["password_change_required"] is None
    db = TestingSession()
    acts = [a.action for a in db.query(AuditLog).order_by(AuditLog.id).all()]
    assert "password_changed" in acts and "password_change_required" in acts
    assert db.query(UsersMaster).get("old1").password_policy_ok is True
    db.close()


def test_policy_recorded_and_enforced_only_when_switched_on(c, monkeypatch):
    r = login(c, "g1", "weakpass")
    assert r.status_code == 200 and r.json()["password_change_required"] is None      # switch OFF
    adm = login(c, "adm", "Secret@1").json()["access_token"]
    st = {u["username"]: u["password_status"] for u in c.get("/users-overview", headers=H(adm)).json()}
    assert st == {"adm": "ok", "adm2": "not_checked", "g1": "needs_update", "old1": "not_checked"}
    monkeypatch.setattr(settings, "ENFORCE_PASSWORD_POLICY", True)
    r = login(c, "g1", "weakpass")
    assert r.json()["password_change_required"] == "policy"
    assert login(c, "adm", "Secret@1").json()["password_change_required"] is None


def test_view_as_is_read_only(c):
    adm = login(c, "adm", "Secret@1").json()["access_token"]
    assert c.post("/security/view-as/adm2", headers=H(adm)).status_code == 403          # no IT Admins
    assert c.post("/security/view-as/nobody", headers=H(adm)).status_code == 404
    r = c.post("/security/view-as/g1", headers=H(adm))
    assert r.status_code == 200
    va = r.json()["access_token"]
    s = c.get("/me/account-status", headers=H(va)).json()
    assert s["view_as_by"] == "adm"
    blocked = c.put("/me/mobile", headers=H(va), json={"phone_number": "9111111111"})
    assert blocked.status_code == 403 and blocked.json()["detail"].startswith("VIEW_ONLY")
    assert c.post("/security/view-as/old1", headers=H(va)).status_code == 403            # no nesting
    # a guard cannot start a preview
    g = login(c, "g1", "weakpass").json()["access_token"]
    assert c.post("/security/view-as/old1", headers=H(g)).status_code == 403
    assert c.post("/security/view-as/end", headers=H(va)).status_code == 200
    db = TestingSession()
    acts = [(a.action, a.actor, a.target_user) for a in db.query(AuditLog).filter(AuditLog.action.like("view_as%")).all()]
    db.close()
    assert acts == [("view_as_started", "adm", "g1"), ("view_as_ended", "adm", "g1")]


def test_documents_folders(c, tmp_path, monkeypatch):
    psd = tmp_path / "Process Solution Documents"
    (psd / "Archive").mkdir(parents=True)
    for f in ["Vendor_Payment_Advice_PSD_v5.pdf", "Vendor_Payment_Advice_PSD_v4.pdf",
              "Monthly_Sales_Invoice_PSD_v5.pdf", "notes.txt"]:
        (psd / f).write_bytes(b"%PDF-1.4 test")
    (psd / "Archive" / "Old_PSD_v1.pdf").write_bytes(b"%PDF")
    (tmp_path / "secret.pdf").write_bytes(b"%PDF secret")
    monkeypatch.setattr(settings, "PSD_FOLDER", str(psd))
    monkeypatch.setattr(settings, "GUIDES_FOLDER", "")
    adm = login(c, "adm", "Secret@1").json()["access_token"]
    docs = c.get("/library/psd", headers=H(adm)).json()["documents"]
    assert [(d["name"], d["version"]) for d in docs] == [("Monthly Sales Invoice", "v5"), ("Vendor Payment Advice", "v5")]
    ok = c.get("/library/psd/download", headers=H(adm), params={"file": "Vendor_Payment_Advice_PSD_v5.pdf"})
    assert ok.status_code == 200 and ok.content.startswith(b"%PDF")
    for bad in ["../secret.pdf", "..\\secret.pdf", "Archive/Old_PSD_v1.pdf", "nope.pdf"]:
        assert c.get("/library/psd/download", headers=H(adm), params={"file": bad}).status_code in (400, 404)
    g = login(c, "g1", "weakpass").json()["access_token"]
    assert c.get("/library/psd", headers=H(g)).status_code == 403
    assert c.get("/library/guides", headers=H(g)).status_code == 503          # folder not set
