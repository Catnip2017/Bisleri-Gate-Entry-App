# app/services/inventory_access.py - Who may see / enter what in the Blinkit
# Inventory Portal (26 Nov 2026). Single place for the mapping rules, used by
# Register, the Assign Access mapping endpoint and every /inventory endpoint.
#
#   Bisleri Inventory Operator : >= 1 warehouse  + >= 1 Blinkit store (27 Nov 2026)
#   Blinkit Inventory Viewer   : exactly 1 Blinkit store + >= 1 warehouse
#   IT Admin                   : sees everything (no mapping needed)
from typing import Iterable, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import UsersMaster, LocationMaster
from app.models.inventory import (
    BlinkitStore, InventoryUserWarehouse, InventoryOperatorStore, InventoryViewerStore,
)
from app.utils.roles import normalize_roles, INVENTORY_OPERATOR, INVENTORY_VIEWER


def get_access(db: Session, username: str) -> dict:
    warehouses = [w for (w,) in db.query(InventoryUserWarehouse.warehouse_code)
                  .filter(InventoryUserWarehouse.username == username)
                  .order_by(InventoryUserWarehouse.warehouse_code).all()]
    stores = [c for (c,) in db.query(InventoryOperatorStore.store_code)
              .filter(InventoryOperatorStore.operator_username == username)
              .order_by(InventoryOperatorStore.store_code).all()]
    st = db.query(InventoryViewerStore).filter(InventoryViewerStore.username == username).first()
    return {"warehouses": warehouses, "stores": stores,
            "store_code": st.store_code if st else None}


def set_access(db: Session, username: str, role_string: Optional[str],
               warehouses: Optional[Iterable[str]], stores: Optional[Iterable[str]],
               store_code: Optional[str]) -> None:
    """Validate and REPLACE a user's portal mapping (no commit here).
    Users without a portal role simply have their mapping cleared."""
    roles = set(normalize_roles(role_string))
    is_op, is_viewer = INVENTORY_OPERATOR in roles, INVENTORY_VIEWER in roles
    wh = sorted({(w or "").strip() for w in (warehouses or []) if (w or "").strip()})
    st = sorted({(v or "").strip().upper() for v in (stores or []) if (v or "").strip()})
    sc = (store_code or "").strip().upper() or None

    if is_op or is_viewer:
        if not wh:
            raise HTTPException(status_code=400, detail="Select at least one warehouse for the Inventory Portal.")
        known = {c for (c,) in db.query(LocationMaster.warehouse_code)
                 .filter(LocationMaster.warehouse_code.in_(wh)).all()}
        missing = [w for w in wh if w not in known]
        if missing:
            raise HTTPException(status_code=400, detail=f"Unknown warehouse: {', '.join(missing)}")
    if is_op:
        if not st:
            raise HTTPException(status_code=400, detail="Select at least one Blinkit store for this operator.")
        known = {c for (c,) in db.query(BlinkitStore.store_code).filter(BlinkitStore.store_code.in_(st)).all()}
        bad = [c for c in st if c not in known]
        if bad:
            raise HTTPException(status_code=400, detail=f"Unknown Blinkit store: {', '.join(bad)}")
    if is_viewer:
        if not sc:
            raise HTTPException(status_code=400, detail="Blinkit store is required for a Blinkit Inventory Viewer.")
        store = db.query(BlinkitStore).filter(BlinkitStore.store_code == sc).first()
        if not store:
            raise HTTPException(status_code=400, detail=f"Unknown Blinkit store: {sc}")

    db.query(InventoryUserWarehouse).filter(InventoryUserWarehouse.username == username).delete()
    db.query(InventoryOperatorStore).filter(InventoryOperatorStore.operator_username == username).delete()
    db.query(InventoryViewerStore).filter(InventoryViewerStore.username == username).delete()
    if is_op or is_viewer:
        for w in wh:
            db.add(InventoryUserWarehouse(username=username, warehouse_code=w))
    if is_op:
        for c in st:
            db.add(InventoryOperatorStore(operator_username=username, store_code=c))
    if is_viewer:
        db.add(InventoryViewerStore(username=username, store_code=sc))


def user_scope(db: Session, user: UsersMaster) -> dict:
    """What the signed-in user may see. warehouses/stores None = all."""
    roles = set(normalize_roles(user.role))
    if "itadmin" in roles:
        return {"kind": "admin", "warehouses": None, "stores": None}
    acc = get_access(db, user.username)
    if INVENTORY_OPERATOR in roles:
        return {"kind": "operator", "warehouses": set(acc["warehouses"]), "stores": set(acc["stores"])}
    if INVENTORY_VIEWER in roles:
        return {"kind": "viewer", "warehouses": set(acc["warehouses"]),
                "stores": {acc["store_code"]} if acc["store_code"] else set()}
    raise HTTPException(status_code=403, detail="You do not have access to the Inventory Portal")
