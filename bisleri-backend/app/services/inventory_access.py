# app/services/inventory_access.py - Who may see / enter what in the Blinkit
# Inventory Portal (26 Nov 2026). Single place for the mapping rules, used by
# Register, the Assign Access mapping endpoint and every /inventory endpoint.
#
#   Bisleri Inventory Operator : >= 1 warehouse  + >= 1 Blinkit viewer
#   Blinkit Inventory Viewer   : exactly 1 customer code + >= 1 warehouse
#   IT Admin                   : sees everything (no mapping needed)
from typing import Iterable, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import UsersMaster, LocationMaster
from app.models.inventory import (
    InventoryUserWarehouse, InventoryOperatorViewer, InventoryViewerCustomer,
)
from app.utils.roles import normalize_roles, INVENTORY_OPERATOR, INVENTORY_VIEWER


def get_access(db: Session, username: str) -> dict:
    warehouses = [w for (w,) in db.query(InventoryUserWarehouse.warehouse_code)
                  .filter(InventoryUserWarehouse.username == username)
                  .order_by(InventoryUserWarehouse.warehouse_code).all()]
    viewers = [v for (v,) in db.query(InventoryOperatorViewer.viewer_username)
               .filter(InventoryOperatorViewer.operator_username == username)
               .order_by(InventoryOperatorViewer.viewer_username).all()]
    cust = db.query(InventoryViewerCustomer).filter(InventoryViewerCustomer.username == username).first()
    return {"warehouses": warehouses, "viewers": viewers,
            "customer_code": cust.customer_code if cust else None}


def set_access(db: Session, username: str, role_string: Optional[str],
               warehouses: Optional[Iterable[str]], viewers: Optional[Iterable[str]],
               customer_code: Optional[str]) -> None:
    """Validate and REPLACE a user's portal mapping (no commit here).
    Users without a portal role simply have their mapping cleared."""
    roles = set(normalize_roles(role_string))
    is_op, is_viewer = INVENTORY_OPERATOR in roles, INVENTORY_VIEWER in roles
    wh = sorted({(w or "").strip() for w in (warehouses or []) if (w or "").strip()})
    vw = sorted({(v or "").strip() for v in (viewers or []) if (v or "").strip()})
    cc = (customer_code or "").strip().upper() or None

    if is_op or is_viewer:
        if not wh:
            raise HTTPException(status_code=400, detail="Select at least one warehouse for the Inventory Portal.")
        known = {c for (c,) in db.query(LocationMaster.warehouse_code)
                 .filter(LocationMaster.warehouse_code.in_(wh)).all()}
        missing = [w for w in wh if w not in known]
        if missing:
            raise HTTPException(status_code=400, detail=f"Unknown warehouse: {', '.join(missing)}")
    if is_op:
        if not vw:
            raise HTTPException(status_code=400, detail="Select at least one Blinkit user for this operator.")
        rows = db.query(UsersMaster.username, UsersMaster.role).filter(UsersMaster.username.in_(vw)).all()
        ok = {u for (u, r) in rows if INVENTORY_VIEWER in normalize_roles(r)}
        bad = [v for v in vw if v not in ok]
        if bad:
            raise HTTPException(status_code=400, detail=f"Not a Blinkit Inventory Viewer: {', '.join(bad)}")
    if is_viewer and not cc:
        raise HTTPException(status_code=400, detail="Customer code is required for a Blinkit Inventory Viewer.")

    db.query(InventoryUserWarehouse).filter(InventoryUserWarehouse.username == username).delete()
    db.query(InventoryOperatorViewer).filter(InventoryOperatorViewer.operator_username == username).delete()
    db.query(InventoryViewerCustomer).filter(InventoryViewerCustomer.username == username).delete()
    if is_op or is_viewer:
        for w in wh:
            db.add(InventoryUserWarehouse(username=username, warehouse_code=w))
    if is_op:
        for v in vw:
            db.add(InventoryOperatorViewer(operator_username=username, viewer_username=v))
    if is_viewer:
        db.add(InventoryViewerCustomer(username=username, customer_code=cc))


def user_scope(db: Session, user: UsersMaster) -> dict:
    """What the signed-in user may see. warehouses/customers None = all."""
    roles = set(normalize_roles(user.role))
    if "itadmin" in roles:
        return {"kind": "admin", "warehouses": None, "customers": None}
    acc = get_access(db, user.username)
    if INVENTORY_OPERATOR in roles:
        codes = [c for (c,) in db.query(InventoryViewerCustomer.customer_code)
                 .filter(InventoryViewerCustomer.username.in_(acc["viewers"] or [""])).all()]
        return {"kind": "operator", "warehouses": set(acc["warehouses"]), "customers": set(codes)}
    if INVENTORY_VIEWER in roles:
        return {"kind": "viewer", "warehouses": set(acc["warehouses"]),
                "customers": {acc["customer_code"]} if acc["customer_code"] else set()}
    raise HTTPException(status_code=403, detail="You do not have access to the Inventory Portal")
