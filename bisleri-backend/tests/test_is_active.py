# tests/test_is_active.py
"""Deactivate-don't-delete (12 Jul 2026). Uses the REAL get_current_user
(no override) with real JWTs so the per-request kill switch is exercised."""
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth import create_access_token, get_current_user, get_password_hash
from app.database import Base, get_db
from app.models import UsersMaster
from app.routers import admin as admin_module
from app.routers import auth as auth_module
from tests.conftest import TestingSession, engine, make_user


def _user(username, active=True):
    return UsersMaster(
        username=username, first_name=username, last_name="T",
        role="Security Guard", password=get_password_hash("secret123"),
        warehouse_code=None, is_active=active,
    )


@pytest.fixture()
def aclient():
    Base.metadata.create_all(engine)
    db = TestingSession()
    db.add_all([_user("alice", active=True), _user("bob", active=False)])
    db.commit()
    db.close()

    app = FastAPI()
    app.include_router(auth_module.router)

    @app.get("/whoami")
    def whoami(current_user: UsersMaster = Depends(get_current_user)):
        return {"username": current_user.username}

    def override_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    yield TestClient(app)
    Base.metadata.drop_all(engine)


def _auth(username):
    return {"Authorization": f"Bearer {create_access_token({'sub': username})}"}


# ═══ per-request kill switch (the important one) ═════════════════════════════
def test_active_user_token_works(aclient):
    r = aclient.get("/whoami", headers=_auth("alice"))
    assert r.status_code == 200 and r.json()["username"] == "alice"


def test_deactivated_user_token_dies_mid_session(aclient):
    """Bob's token is cryptographically valid (8h) — but is_active is checked
    on EVERY request, so deactivation bites immediately."""
    r = aclient.get("/whoami", headers=_auth("bob"))
    assert r.status_code == 401
    assert "deactivated" in r.json()["detail"].lower()


def test_null_is_active_counts_as_active(aclient):
    """Pre-migration rows (is_active NULL) must not be locked out."""
    db = TestingSession()
    legacy = _user("legacy")
    legacy.is_active = None
    db.add(legacy); db.commit(); db.close()
    assert aclient.get("/whoami", headers=_auth("legacy")).status_code == 200


# ═══ login door ══════════════════════════════════════════════════════════════
def test_deactivated_user_cannot_login(aclient):
    r = aclient.post("/login", json={"username": "bob", "password": "secret123"})
    assert r.status_code == 403
    assert "deactivated" in r.json()["detail"].lower()


def test_active_user_login_unchanged(aclient):
    r = aclient.post("/login", json={"username": "alice", "password": "secret123"})
    assert r.status_code == 200 and "access_token" in r.json()


# ═══ self-deactivation guard ═════════════════════════════════════════════════
@pytest.fixture()
def admin_client():
    Base.metadata.create_all(engine)
    db = TestingSession()
    db.add(UsersMaster(username="admin1", first_name="A", last_name="D",
                       role="IT Admin", password="x", is_active=True))
    db.add(UsersMaster(username="guard1", first_name="G", last_name="One",
                       role="Security Guard", password="x", is_active=True))
    db.commit(); db.close()

    app = FastAPI()
    app.include_router(admin_module.router)
    current = {"user": make_user("admin1", "IT Admin")}

    def override_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current["user"]
    yield TestClient(app)
    Base.metadata.drop_all(engine)


def test_admin_can_deactivate_and_reactivate_others(admin_client):
    r = admin_client.put("/modify-user/guard1", json={"is_active": False})
    assert r.status_code == 200
    db = TestingSession()
    assert db.query(UsersMaster).get("guard1").is_active is False
    db.close()
    assert admin_client.put("/modify-user/guard1", json={"is_active": True}).status_code == 200


def test_admin_cannot_deactivate_self(admin_client):
    r = admin_client.put("/modify-user/admin1", json={"is_active": False})
    assert r.status_code == 400
    assert "your own account" in r.json()["detail"]
