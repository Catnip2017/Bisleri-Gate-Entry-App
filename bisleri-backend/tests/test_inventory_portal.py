# tests/test_inventory_portal.py - Blinkit Inventory Portal API (26 Nov 2026).
# In-memory SQLite, auth overridden per test (same approach as conftest.py).
import io
from datetime import timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.database import Base, get_db
from app.models import UsersMaster, LocationMaster, ItemMaster
from app.routers import inventory as inv
from app.services.inventory_access import set_access
from tests.conftest import engine, TestingSession


@pytest.fixture()
def env():
    Base.metadata.create_all(bind=engine)
    db = TestingSession()
    db.add_all([
        LocationMaster(warehouse_code="WH1", warehouse_name="Mumbai DC"),
        LocationMaster(warehouse_code="WH2", warehouse_name="Pune DC"),
        LocationMaster(warehouse_code="WH3", warehouse_name="Delhi DC"),
        ItemMaster(Item_number="SKU1", Product_name="Bisleri 1L x 12"),
        ItemMaster(Item_number="SKU2", Product_name="Bisleri 500ml x 24"),
        UsersMaster(username="op1", first_name="Op", last_name="One", role="Bisleri Inventory Operator"),
        UsersMaster(username="bk1", first_name="Blink", last_name="One", role="Blinkit Inventory Viewer"),
        UsersMaster(username="bk2", first_name="Blink", last_name="Two", role="Blinkit Inventory Viewer"),
        UsersMaster(username="adm", first_name="Admin", last_name="X", role="IT Admin"),
        UsersMaster(username="sg", first_name="Guard", last_name="X", role="Security Guard"),
    ])
    db.flush()
    set_access(db, "bk1", "blinkitinventoryviewer", ["WH1", "WH2"], [], "c100")
    set_access(db, "bk2", "blinkitinventoryviewer", ["WH3"], [], "C200")
    set_access(db, "op1", "bisleriinventoryoperator", ["WH1", "WH2"], ["bk1"], None)
    db.commit()

    app = FastAPI()
    app.include_router(inv.router)

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

    def as_(username):
        state["user"] = db.query(UsersMaster).get(username)
        return client
    yield as_, db
    db.close()
    Base.metadata.drop_all(bind=engine)


def line(**kw):
    d = {"inv_date": inv._today().isoformat(), "customer_code": "C100", "warehouse_code": "WH1",
         "sku_code": "SKU1", "quantity": 5}
    d.update(kw)
    return d


def test_set_access_rules(env):
    as_, db = env
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        set_access(db, "op1", "bisleriinventoryoperator", ["WH1"], [], None)          # no viewer
    with pytest.raises(HTTPException):
        set_access(db, "op1", "bisleriinventoryoperator", ["WH1"], ["sg"], None)      # not a viewer
    with pytest.raises(HTTPException):
        set_access(db, "bk1", "blinkitinventoryviewer", ["WH1"], [], "")              # no customer
    with pytest.raises(HTTPException):
        set_access(db, "bk1", "blinkitinventoryviewer", ["NOPE"], [], "C1")           # unknown wh
    db.rollback()


def test_lookups_scope(env):
    as_, _ = env
    r = as_("op1").get("/inventory/lookups").json()
    assert r["kind"] == "operator"
    assert [w["code"] for w in r["warehouses"]] == ["WH1", "WH2"]
    assert [c["code"] for c in r["customers"]] == ["C100"]
    assert as_("sg").get("/inventory/lookups").status_code == 403
    assert as_("adm").get("/inventory/lookups").json()["kind"] == "admin"


def test_submit_partial_and_rules(env):
    as_, _ = env
    c = as_("op1")
    past = (inv._today() - timedelta(days=1)).isoformat()
    r = c.post("/inventory/batches", json={"lines": [
        line(),                                   # ok
        line(inv_date=past),                      # past date
        line(customer_code="C200"),               # not mapped customer
        line(warehouse_code="WH3"),               # not mapped warehouse
        line(sku_code="XXX"),                     # unknown sku
        line(quantity=2.5),                       # fractional
        line(quantity=0),                         # zero
        line(sku_code=None, sku_name="bisleri 500ml x 24", quantity=3, batch_no="B1"),  # by name
        line(),                                   # duplicate allowed
    ]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["saved"] == 3
    assert [e["index"] for e in body["errors"]] == [1, 2, 3, 4, 5, 6]
    # viewers / admin may not submit
    assert as_("bk1").post("/inventory/batches", json={"lines": [line()]}).status_code == 403
    assert as_("adm").post("/inventory/batches", json={"lines": [line()]}).status_code == 403
    # nothing valid -> 400
    assert as_("op1").post("/inventory/batches", json={"lines": [line(quantity=-1)]}).status_code == 400


def test_view_projection_and_range(env):
    as_, _ = env
    as_("op1").post("/inventory/batches", json={"lines": [line(batch_no="B9"), line(warehouse_code="WH2")]})
    t = inv._today().isoformat()
    op = as_("op1").get(f"/inventory/entries?date_from={t}&date_to={t}").json()
    assert op["total"] == 2 and op["total_cases"] == 10
    assert "batch_no" in op["results"][0] and "created_by" in op["results"][0]
    vw = as_("bk1").get(f"/inventory/entries?date_from={t}&date_to={t}").json()
    assert vw["total"] == 2
    for k in ("batch_no", "mfg_date", "warehouse_code", "created_by", "sku_code"):
        assert k not in vw["results"][0]
    assert as_("bk2").get(f"/inventory/entries?date_from={t}&date_to={t}").json()["total"] == 0
    assert as_("bk1").get(f"/inventory/entries?date_from={t}&date_to={t}&warehouses=WH2").json()["total"] == 1
    far = (inv._today() + timedelta(days=100)).isoformat()
    assert as_("bk1").get(f"/inventory/entries?date_from={t}&date_to={far}").status_code == 400
    assert as_("adm").get(f"/inventory/entries?date_from={t}&date_to={t}").json()["total"] == 2
    ex = as_("bk1").get(f"/inventory/export?date_from={t}&date_to={t}")
    assert ex.status_code == 200
    from openpyxl import load_workbook
    ws = load_workbook(io.BytesIO(ex.content)).active
    assert [c.value for c in ws[1]][:3] == ["Date", "Customer Code", "BIPL Warehouse Name"]
    assert ws.max_row == 3
    assert as_("bk1").get("/inventory/dashboard").status_code == 403
    d = as_("op1").get("/inventory/dashboard").json()
    assert d["lines_today"] == 2 and d["cases_today"] == 10


def test_template_and_upload(env):
    as_, _ = env
    c = as_("op1")
    t = c.get("/inventory/template")
    assert t.status_code == 200
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(t.content))
    ws = wb["Inventory"]
    today = inv._today().strftime("%d/%m/%Y")
    ws.append([today, "C100", "WH1", "SKU1", None, 4, "B1", None])
    ws.append([today, "C100", "WH9", "SKU1", None, 4, None, None])      # bad wh
    ws.append([None, None, None, None, None, None, None, None])         # blank -> skipped
    ws.append([today, "C100", "WH2", None, "Bisleri 1L x 12", "x", None, None])  # bad qty
    buf = io.BytesIO(); wb.save(buf)
    r = c.post("/inventory/upload/check",
               files={"file": ("inv.xlsx", buf.getvalue(),
                               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["total_rows"] == 3 and len(b["valid"]) == 1
    assert [e["row"] for e in b["errors"]] == [3, 5]
    assert b["valid"][0]["warehouse_name"] == "Mumbai DC"
    bad = c.post("/inventory/upload/check", files={"file": ("x.csv", b"a,b", "text/csv")})
    assert bad.status_code == 400
