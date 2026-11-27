# tests/test_security.py - Audit trail, old-password login, Security Settings,
# nightly dormant check and the Users access Excel (26 Nov 2026).
import hashlib
import io
from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth import get_current_user, get_password_hash
from app.database import Base, get_db
from app.models import UsersMaster, LocationMaster
from app.models.security import AuditLog, SecurityAlert
from app.routers import admin as admin_module
from app.routers import auth as auth_module
from app.routers import security as security_module
from app.services import security as sec
from tests.conftest import TestingSession, engine


@pytest.fixture()
def env():
    sec._reset_ready_cache()
    sec._seen_cache.clear()
    Base.metadata.create_all(engine)
    db = TestingSession()
    db.add_all([
        LocationMaster(warehouse_code="WH1", warehouse_name="Mumbai", site_code="MUM"),
        UsersMaster(username="adm", first_name="Ad", last_name="Min", role="IT Admin",
                    password=get_password_hash("Secret@1"), phone_number="9000000001"),
        UsersMaster(username="g1", first_name="Guard", last_name="One", role="Security Guard",
                    warehouse_code="WH1", password=get_password_hash("Secret@1"), phone_number="9000000002"),
        UsersMaster(username="old1", first_name="Old", last_name="Pw", role="Security Guard",
                    password=hashlib.sha256(b"oldpass").hexdigest()),
    ])
    db.commit()
    app = FastAPI()
    for r in (auth_module.router, admin_module.router, security_module.router):
        app.include_router(r)

    def _db():
        s = TestingSession()
        try:
            yield s
        finally:
            s.close()
    app.dependency_overrides[get_db] = _db
    state = {"user": None}
    app.dependency_overrides[get_current_user] = lambda: state["user"]
    client = TestClient(app)

    def as_(u):
        state["user"] = db.query(UsersMaster).get(u)
        return client
    yield as_, db, client
    db.close()
    Base.metadata.drop_all(bind=engine)
    sec._reset_ready_cache()


def test_old_password_format_is_clean(env):
    _, db, c = env
    # 27 Nov 2026: the right old password now opens "Set a new password"
    # (restricted token) instead of an error — see test_password_viewas_docs.py
    r = c.post("/login", json={"username": "old1", "password": "oldpass"})
    assert r.status_code == 200 and r.json()["password_change_required"] == "legacy"
    r = c.post("/login", json={"username": "old1", "password": "wrong"})
    assert r.status_code == 401 and r.json()["detail"] == "Invalid username or password."
    r = c.post("/login", json={"username": "nobody", "password": "x"})
    assert r.status_code == 401
    acts = [(a.action, a.target_user) for a in db.query(AuditLog).order_by(AuditLog.id).all()]
    assert acts == [("password_change_required", "old1"), ("login_failed", "old1"), ("login_failed", None)]
    assert c.post("/login", json={"username": "g1", "password": "Secret@1"}).status_code == 200


def test_modify_user_writes_audit_with_reason(env):
    as_, db, _ = env
    c = as_("adm")
    r = c.put("/modify-user/g1", json={"role": "Security Guard", "warehouse_code": "", "is_active": False},
              headers={"X-Audit-Reason": "left%20the%20company"})
    assert r.status_code == 200, r.text
    rows = db.query(AuditLog).order_by(AuditLog.id).all()
    assert [a.action for a in rows] == ["user_deactivated", "access_changed"]
    assert rows[0].reason == "left the company" and rows[0].actor == "adm"
    assert rows[1].details["changes"]["warehouse_code"] == {"from": "WH1", "to": None}
    res = c.get("/security/audit?username=g1").json()
    assert res["total"] == 2 and "warehouse code: WH1 → —" in res["results"][0]["detail"] + res["results"][1]["detail"]
    ex = c.get("/security/audit/export?username=g1")
    assert ex.status_code == 200
    # nothing changed -> no audit row
    c.put("/modify-user/g1", json={"role": "Security Guard"})
    assert db.query(AuditLog).count() == 2


def test_settings_validation_and_history(env):
    as_, db, _ = env
    c = as_("adm")
    s = c.get("/security/settings").json()
    assert s["values"]["inactive_days"] == 90 and s["values"]["warning_days"] == 75
    body = {**s["values"], "alert_emails": ", ".join(s["values"]["alert_emails"]),
            "exempt_users": ""}
    assert c.put("/security/settings", json={**body, "warning_days": 95}).status_code == 400
    assert c.put("/security/settings", json={**body, "exempt_users": "ghost"}).status_code == 400
    assert c.put("/security/settings", json={**body, "alert_email": True, "alert_emails": ""}).status_code == 400
    r = c.put("/security/settings", json={**body, "inactive_days": 60, "warning_days": 50, "exempt_users": "g1",
                                          "reason": "policy"})
    assert r.status_code == 200, r.text
    assert r.json()["values"]["exempt_users"] == ["g1"]
    assert r.json()["history"][0]["changes"]["inactive_days"] == {"from": "90", "to": "60"}
    assert as_("g1").get("/security/settings").status_code == 403


def test_dormant_check_alerts_never_disable(env):
    as_, db, _ = env
    now = datetime.now()
    db.execute(text("UPDATE users_master SET created_at = :c"), {"c": now - timedelta(days=200)})
    db.execute(text("UPDATE users_master SET last_login = :d WHERE username = 'g1'"), {"d": now - timedelta(days=80)})
    db.execute(text("UPDATE users_master SET last_seen_at = :d WHERE username = 'adm'"), {"d": now - timedelta(days=1)})
    db.commit()
    out = sec.run_dormant_check(db, now=now, send_email=False)
    assert out["new"] == 2
    kinds = {(a.username, a.kind) for a in db.query(SecurityAlert).all()}
    assert kinds == {("g1", "inactive_warning"), ("old1", "never_used")}
    assert all(u.is_active is not False for u in db.query(UsersMaster).all())   # never disables
    # second run: no duplicates
    assert sec.run_dormant_check(db, now=now, send_email=False)["new"] == 0
    # g1 becomes inactive (>90) -> new 'inactive' alert, warning resolved
    out = sec.run_dormant_check(db, now=now + timedelta(days=15), send_email=False)
    assert out["new"] == 1 and out["resolved"] == 1
    c = as_("adm")
    al = c.get("/security/alerts").json()
    assert al["open_count"] == 2
    aid = [a for a in al["alerts"] if a["username"] == "old1"][0]["id"]
    assert c.post(f"/security/alerts/{aid}/dismiss", json={"reason": "service account"}).status_code == 200
    assert c.get("/security/alerts").json()["open_count"] == 1
    # a dismissed alert is not raised again while the user stays unused
    assert sec.run_dormant_check(db, now=now + timedelta(days=16), send_email=False)["new"] == 0


def test_users_access_export(env):
    as_, _, _ = env
    from openpyxl import load_workbook
    c = as_("adm")
    r = c.post("/security/users-access/export", json={"usernames": None})
    assert r.status_code == 200
    ws = load_workbook(io.BytesIO(r.content)).active
    assert ws.max_row == 4 and ws["A1"].value == "Username"
    r = c.post("/security/users-access/export", json={"usernames": ["g1"]})
    assert load_workbook(io.BytesIO(r.content)).active.max_row == 2
    assert "g1_Access_" in r.headers["content-disposition"]
