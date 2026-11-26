# app/routers/inventory.py - Blinkit Inventory Portal API (26 Nov 2026).
#
# Roles: Bisleri Inventory Operator (enters stock for mapped warehouses +
# the stores of mapped Blinkit users), Blinkit Inventory Viewer (read-only,
# own Blinkit store, mapped warehouses), IT Admin (read-only, everything).
#
# Masters: item_master (SKU code = item_number, SKU name = product_name),
# blinkit_stores (store_code / store_name), location_master (warehouses —
# the warehouse name is copied onto each line when it is saved).
#
# Rules agreed with the business:
#   - lines are never edited or deleted; duplicates are separate lines
#   - date must be today or later (Asia/Kolkata); no past dates
#   - quantity = whole cases > 0; batch and mfg date optional, free format
#   - Excel upload: every valid row is accepted, invalid rows are reported
#   - one search covers at most 92 days (export up to 366 days)
#   - viewers never receive batch, mfg date, warehouse code, SKU code or entered-by
import io
import re
from datetime import date, datetime, timedelta
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import UsersMaster, LocationMaster, ItemMaster
from app.models.inventory import BlinkitStore, InventoryBatch, InventoryEntry
from app.services.inventory_access import user_scope
from app.utils.errors import internal_error

router = APIRouter(prefix="/inventory", tags=["Inventory Portal"])

IST = ZoneInfo("Asia/Kolkata")
MAX_SEARCH_DAYS = 92
MAX_EXPORT_DAYS = 366
MAX_UPLOAD_ROWS = 5000
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


def _today() -> date:
    return datetime.now(IST).date()


def _wh_names(db: Session, codes=None) -> dict:
    q = db.query(LocationMaster.warehouse_code, LocationMaster.warehouse_name)
    if codes is not None:
        q = q.filter(LocationMaster.warehouse_code.in_(list(codes) or [""]))
    return {c: n for (c, n) in q.all()}


def _store_names(db: Session, codes=None) -> dict:
    q = db.query(BlinkitStore.store_code, BlinkitStore.store_name)
    if codes is not None:
        q = q.filter(BlinkitStore.store_code.in_(list(codes) or [""]))
    return {c: n for (c, n) in q.all()}


def _store_options(db: Session, scope: dict) -> list:
    """Blinkit store dropdown (from blinkit_stores), limited to the user's scope.
    IT Admin sees every store, operators the stores of their Blinkit users."""
    names = _store_names(db, scope["stores"])
    return [{"code": c, "name": names[c] or "", "label": f"{c} — {names[c]}" if names[c] else c}
            for c in sorted(names)]


# ── Lookups ───────────────────────────────────────────────────────────────────
@router.get("/lookups")
def lookups(db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    try:
        db.query(InventoryEntry.id).limit(1).all()
    except ProgrammingError:
        # Tables not created yet (migration c4e8a1f7d2b9 not applied) —
        # say so plainly instead of a generic server error.
        db.rollback()
        raise HTTPException(status_code=503, detail="The Inventory Portal is not set up on this database yet "
                            "(run 'alembic upgrade head' on the backend, then load the item and store masters).")
    scope = user_scope(db, current_user)
    names = _wh_names(db, scope["warehouses"])
    return {
        "kind": scope["kind"],
        "today": _today().isoformat(),
        "warehouses": [{"code": c, "name": names.get(c) or ""} for c in sorted(names)],
        "stores": _store_options(db, scope),
        "max_search_days": MAX_SEARCH_DAYS,
    }


@router.get("/stores")
def list_stores(db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    """Blinkit store master for the User Management store picker (IT Admin)."""
    from app.utils.roles import normalize_roles
    if "itadmin" not in normalize_roles(current_user.role):
        raise HTTPException(status_code=403, detail="Only IT Admins can list Blinkit stores")
    try:
        rows = db.query(BlinkitStore.store_code, BlinkitStore.store_name) \
            .filter(BlinkitStore.is_active.is_(True)).order_by(BlinkitStore.store_code).all()
    except ProgrammingError:
        db.rollback()
        raise HTTPException(status_code=503, detail="The Inventory Portal is not set up on this database yet.")
    return [{"code": c, "name": n or "", "label": f"{c} — {n}" if n else c} for (c, n) in rows]


@router.get("/skus")
def search_skus(
    q: str = Query("", max_length=100),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    user_scope(db, current_user)   # any portal user
    query = db.query(ItemMaster.Item_number, ItemMaster.Product_name)
    term = q.strip()
    if term:
        like = f"%{term}%"
        query = query.filter(or_(ItemMaster.Item_number.ilike(like), ItemMaster.Product_name.ilike(like)))
    rows = query.order_by(ItemMaster.Product_name).limit(limit).all()
    return [{"code": c, "name": n or ""} for (c, n) in rows]


# ── Dashboard (operator / IT Admin) ───────────────────────────────────────────
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    scope = user_scope(db, current_user)
    if scope["kind"] == "viewer":
        raise HTTPException(status_code=403, detail="Dashboard is not available for your role")
    q = db.query(InventoryEntry).filter(InventoryEntry.inv_date == _today())
    q = _apply_scope(q, scope)
    lines, cases, stores = q.with_entities(
        func.count(InventoryEntry.id),
        func.coalesce(func.sum(InventoryEntry.quantity), 0),
        func.count(func.distinct(InventoryEntry.store_code)),
    ).one()
    names = _wh_names(db, scope["warehouses"])
    return {
        "today": _today().isoformat(),
        "lines_today": int(lines or 0),
        "cases_today": int(cases or 0),
        "stores_today": int(stores or 0),
        "warehouses": [{"code": c, "name": names.get(c) or ""} for c in sorted(names)],
    }


# ── Validation shared by manual submit and Excel upload ───────────────────────
def _parse_date(v) -> Optional[date]:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"'{s}' is not a valid date (use DD/MM/YYYY)")


class _Checker:
    """Validates one line against the user's scope; caches master lookups."""

    def __init__(self, db: Session, scope: dict):
        self.db, self.scope, self.today = db, scope, _today()
        self.sku_cache, self.sku_name_cache = {}, {}
        self.store_names = _store_names(db, scope["stores"])
        self.wh_names = _wh_names(db, scope["warehouses"])

    def sku(self, code: Optional[str], name: Optional[str]):
        code = (code or "").strip()
        name = (name or "").strip()
        if code:
            if code not in self.sku_cache:
                row = self.db.query(ItemMaster.Item_number, ItemMaster.Product_name) \
                    .filter(ItemMaster.Item_number == code).first()
                self.sku_cache[code] = row
            row = self.sku_cache[code]
            if not row:
                raise ValueError(f"SKU code '{code}' not found in item master")
            return row[0], row[1]
        if name:
            key = name.lower()
            if key not in self.sku_name_cache:
                rows = self.db.query(ItemMaster.Item_number, ItemMaster.Product_name) \
                    .filter(func.lower(ItemMaster.Product_name) == key).limit(2).all()
                self.sku_name_cache[key] = rows
            rows = self.sku_name_cache[key]
            if not rows:
                raise ValueError(f"SKU '{name}' not found in item master")
            if len(rows) > 1:
                raise ValueError(f"SKU name '{name}' matches more than one item — use the SKU code")
            return rows[0][0], rows[0][1]
        raise ValueError("SKU is missing")

    def check(self, raw: dict) -> dict:
        d = _parse_date(raw.get("inv_date"))
        if not d:
            raise ValueError("Date is missing")
        if d < self.today:
            raise ValueError("Date is in the past — only today or a future date is allowed")
        store = (str(raw.get("store_code") or "")).strip().upper()
        if not store:
            raise ValueError("Store code is missing")
        if self.scope["stores"] is not None and store not in self.scope["stores"]:
            raise ValueError(f"Store '{store}' is not mapped to you")
        if store not in self.store_names:
            raise ValueError(f"Store '{store}' is not in the Blinkit store master")
        wh = (str(raw.get("warehouse_code") or "")).strip().upper()
        if not wh:
            raise ValueError("Warehouse code is missing")
        if self.scope["warehouses"] is not None and wh not in self.scope["warehouses"]:
            raise ValueError(f"Warehouse '{wh}' is not mapped to you")
        if wh not in self.wh_names:
            raise ValueError(f"Warehouse '{wh}' is not in the location master")
        sku_code, sku_name = self.sku(raw.get("sku_code"), raw.get("sku_name"))
        q = raw.get("quantity")
        try:
            qf = float(str(q).strip())
        except (TypeError, ValueError):
            raise ValueError("Quantity must be a whole number of cases")
        if qf != int(qf) or int(qf) < 1:
            raise ValueError("Quantity must be a whole number of cases (1 or more)")
        mfg = _parse_date(raw.get("mfg_date"))
        if mfg and mfg > d:
            raise ValueError("Manufacturing date is after the inventory date")
        batch = (str(raw.get("batch_no") or "")).strip() or None
        return {
            "inv_date": d.isoformat(), "store_code": store, "store_name": self.store_names.get(store) or "",
            "warehouse_code": wh, "warehouse_name": self.wh_names.get(wh) or "",
            "sku_code": sku_code, "sku_name": sku_name, "quantity": int(qf),
            "batch_no": batch[:100] if batch else None,
            "mfg_date": mfg.isoformat() if mfg else None,
        }


# ── Submit All ────────────────────────────────────────────────────────────────
class LineIn(BaseModel):
    inv_date: str
    store_code: str
    warehouse_code: str
    sku_code: Optional[str] = None
    sku_name: Optional[str] = None
    quantity: float
    batch_no: Optional[str] = None
    mfg_date: Optional[str] = None


class BatchIn(BaseModel):
    source: str = "manual"           # 'manual' | 'upload'
    file_name: Optional[str] = None
    lines: List[LineIn]


@router.post("/batches")
def submit_batch(payload: BatchIn, db: Session = Depends(get_db),
                 current_user: UsersMaster = Depends(get_current_user)):
    scope = user_scope(db, current_user)
    if scope["kind"] != "operator":
        raise HTTPException(status_code=403, detail="Only Bisleri Inventory Operators can enter inventory")
    if not payload.lines:
        raise HTTPException(status_code=400, detail="No lines to submit")
    if len(payload.lines) > MAX_UPLOAD_ROWS:
        raise HTTPException(status_code=400, detail=f"At most {MAX_UPLOAD_ROWS} lines per submission")
    checker = _Checker(db, scope)
    good, errors = [], []
    for i, ln in enumerate(payload.lines):
        try:
            good.append(checker.check(ln.model_dump()))
        except ValueError as e:
            errors.append({"index": i, "error": str(e)})
    if not good:
        raise HTTPException(status_code=400, detail={"message": "No valid lines to save", "errors": errors})
    try:
        batch = InventoryBatch(
            source="upload" if payload.source == "upload" else "manual",
            file_name=(payload.file_name or None) and payload.file_name[:255],
            line_count=len(good), created_by=current_user.username,
        )
        db.add(batch)
        db.flush()
        for g in good:
            db.add(InventoryEntry(
                batch_id=batch.id, inv_date=date.fromisoformat(g["inv_date"]),
                store_code=g["store_code"], warehouse_code=g["warehouse_code"],
                warehouse_name=g["warehouse_name"] or None,
                sku_code=g["sku_code"], sku_name=g["sku_name"], quantity=g["quantity"],
                batch_no=g["batch_no"],
                mfg_date=date.fromisoformat(g["mfg_date"]) if g["mfg_date"] else None,
                created_by=current_user.username,
            ))
        db.commit()
    except Exception as e:
        db.rollback()
        raise internal_error("Could not save inventory", e)
    return {"batch_id": batch.id, "saved": len(good), "errors": errors}


# ── Excel template + upload check ─────────────────────────────────────────────
TEMPLATE_HEADERS = ["Date (DD/MM/YYYY)", "Blinkit Store Code", "BIPL Warehouse Code", "SKU Code (Item number)",
                    "SKU Name", "Quantity (cases)", "Batch (optional)", "Manufacturing Date (optional)"]


@router.get("/template")
def download_template(db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.worksheet.datavalidation import DataValidation

    scope = user_scope(db, current_user)
    if scope["kind"] != "operator":
        raise HTTPException(status_code=403, detail="Only Bisleri Inventory Operators can upload inventory")
    wh = _wh_names(db, scope["warehouses"])
    stores = _store_names(db, scope["stores"])
    custs = sorted(stores)
    wb = Workbook()
    ws = wb.active
    ws.title = "Inventory"
    ws.append(TEMPLATE_HEADERS)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="0F6B46")
    for i, w in enumerate([18, 16, 20, 18, 34, 16, 18, 26], start=1):
        ws.column_dimensions[chr(64 + i)].width = w
    lists = wb.create_sheet("Lists")
    lists.append(["Your Blinkit store codes", "Your warehouses", "Warehouse name", "Store name"])
    codes = sorted(wh)
    for i in range(max(len(custs), len(wh))):
        lists.append([custs[i] if i < len(custs) else None,
                      codes[i] if i < len(codes) else None,
                      wh[codes[i]] if i < len(codes) else None,
                      stores[custs[i]] if i < len(custs) else None])
    if custs:
        dv = DataValidation(type="list", formula1=f"=Lists!$A$2:$A${len(custs) + 1}", allow_blank=False)
        ws.add_data_validation(dv); dv.add("B2:B5001")
    if wh:
        dv2 = DataValidation(type="list", formula1=f"=Lists!$B$2:$B${len(wh) + 1}", allow_blank=False)
        ws.add_data_validation(dv2); dv2.add("C2:C5001")
    notes = wb.create_sheet("How to fill")
    for line in [
        "One row per stock line. Required: Date, Blinkit Store Code, BIPL Warehouse Code, SKU Code (Item number, or exact SKU Name), Quantity.",
        "Date must be today or a future date (DD/MM/YYYY). Past dates are rejected.",
        "Quantity is in whole cases (1 or more). Batch and Manufacturing Date are optional.",
        "Only your mapped Blinkit stores and warehouses are accepted (see the Lists sheet). The warehouse name is filled in automatically.",
        f"Maximum {MAX_UPLOAD_ROWS} rows per file. Correct rows are accepted; rows with errors are listed back to you.",
    ]:
        notes.append([line])
    notes.column_dimensions["A"].width = 120
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="Inventory_Upload_Template.xlsx"'},
    )


def _norm_header(h) -> str:
    return re.sub(r"[^a-z]", "", str(h or "").lower())


@router.post("/upload/check")
async def upload_check(file: UploadFile = File(...), db: Session = Depends(get_db),
                       current_user: UsersMaster = Depends(get_current_user)):
    from openpyxl import load_workbook

    scope = user_scope(db, current_user)
    if scope["kind"] != "operator":
        raise HTTPException(status_code=403, detail="Only Bisleri Inventory Operators can upload inventory")
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Please upload the .xlsx template")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File is larger than 5 MB")
    try:
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read the file — is it a valid Excel (.xlsx)?")
    ws = wb["Inventory"] if "Inventory" in wb.sheetnames else wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = next(rows, None)
    if not header:
        raise HTTPException(status_code=400, detail="The file is empty")
    h = [_norm_header(x) for x in header]

    def col(*keys, exclude=()):
        for i, x in enumerate(h):
            if any(k in x for k in keys) and not any(e in x for e in exclude):
                return i
        return None

    idx = {
        "inv_date": col("date", exclude=("manufactur", "mfg")),
        "store_code": col("store", exclude=("name",)),
        "warehouse_code": col("warehouse", exclude=("name",)),
        "sku_code": col("skucode", "itemcode", "itemnumber"),
        "sku_name": col("skuname", "productname"),
        "quantity": col("quantity", "qty", "cases"),
        "batch_no": col("batch"),
        "mfg_date": col("manufactur", "mfg"),
    }
    missing = [k for k in ("inv_date", "store_code", "warehouse_code", "quantity") if idx[k] is None]
    if idx["sku_code"] is None and idx["sku_name"] is None:
        missing.append("sku_code")
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing column(s): {', '.join(missing)} — please use the template")

    checker = _Checker(db, scope)
    good, errors, total = [], [], 0
    for rnum, r in enumerate(rows, start=2):
        if r is None or all(v is None or str(v).strip() == "" for v in r):
            continue
        total += 1
        if total > MAX_UPLOAD_ROWS:
            errors.append({"row": rnum, "error": f"More than {MAX_UPLOAD_ROWS} rows — remaining rows ignored"})
            break
        raw = {k: (r[i] if i is not None and i < len(r) else None) for k, i in idx.items()}
        try:
            g = checker.check(raw)
            g["row"] = rnum
            good.append(g)
        except ValueError as e:
            errors.append({"row": rnum, "error": str(e)})
    return {"file_name": file.filename, "total_rows": total, "valid": good, "errors": errors}


# ── View / History / Export ───────────────────────────────────────────────────
def _apply_scope(q, scope):
    if scope["warehouses"] is not None:
        q = q.filter(InventoryEntry.warehouse_code.in_(list(scope["warehouses"]) or [""]))
    if scope["stores"] is not None:
        q = q.filter(InventoryEntry.store_code.in_(list(scope["stores"]) or [""]))
    return q


def _filtered(db, scope, date_from: date, date_to: date, warehouses: Optional[str], stores: Optional[str], max_days: int):
    if date_to < date_from:
        raise HTTPException(status_code=400, detail="'To' date is before 'From' date")
    if (date_to - date_from).days + 1 > max_days:
        raise HTTPException(status_code=400, detail=f"Please choose a range of at most {max_days} days")
    q = db.query(InventoryEntry).filter(InventoryEntry.inv_date >= date_from, InventoryEntry.inv_date <= date_to)
    q = _apply_scope(q, scope)
    wl = [w.strip().upper() for w in (warehouses or "").split(",") if w.strip()]
    if wl:
        q = q.filter(InventoryEntry.warehouse_code.in_(wl))
    sl = [c.strip().upper() for c in (stores or "").split(",") if c.strip()]
    if sl:
        q = q.filter(InventoryEntry.store_code.in_(sl))
    return q


def _row(e: InventoryEntry, wh_names: dict, store_names: dict, viewer: bool) -> dict:
    base = {
        "id": e.id,
        "inv_date": e.inv_date.isoformat(),
        "store_code": e.store_code,
        "store_name": store_names.get(e.store_code) or "",
        "warehouse_name": e.warehouse_name or wh_names.get(e.warehouse_code, ""),
        "sku_name": e.sku_name,
        "quantity": e.quantity,
        "updated_at": e.created_at.isoformat() if e.created_at else None,
    }
    if not viewer:
        base.update({
            "warehouse_code": e.warehouse_code,
            "sku_code": e.sku_code,
            "batch_no": e.batch_no,
            "mfg_date": e.mfg_date.isoformat() if e.mfg_date else None,
            "created_by": e.created_by,
        })
    return base


@router.get("/entries")
def list_entries(
    date_from: date = Query(...),
    date_to: date = Query(...),
    warehouses: Optional[str] = Query(None, max_length=2000),
    stores: Optional[str] = Query(None, max_length=2000),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    scope = user_scope(db, current_user)
    q = _filtered(db, scope, date_from, date_to, warehouses, stores, MAX_SEARCH_DAYS)
    total, cases = q.with_entities(func.count(InventoryEntry.id),
                                   func.coalesce(func.sum(InventoryEntry.quantity), 0)).one()
    rows = q.order_by(InventoryEntry.inv_date.desc(), InventoryEntry.created_at.desc(), InventoryEntry.id.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    names = _wh_names(db, {r.warehouse_code for r in rows if not r.warehouse_name})
    snames = _store_names(db, {r.store_code for r in rows})
    viewer = scope["kind"] == "viewer"
    return {
        "total": int(total or 0), "total_cases": int(cases or 0),
        "page": page, "page_size": page_size,
        "results": [_row(r, names, snames, viewer) for r in rows],
    }


@router.get("/export")
def export_entries(
    date_from: date = Query(...),
    date_to: date = Query(...),
    warehouses: Optional[str] = Query(None, max_length=2000),
    stores: Optional[str] = Query(None, max_length=2000),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    scope = user_scope(db, current_user)
    q = _filtered(db, scope, date_from, date_to, warehouses, stores, MAX_EXPORT_DAYS)
    viewer = scope["kind"] == "viewer"
    names = _wh_names(db)
    snames = _store_names(db)
    if viewer:
        heads = ["Date", "Store Code", "Store Name", "BIPL Warehouse Name", "SKU Name", "Quantity (cases)",
                 "Updated Date & Time"]
    else:
        heads = ["Date", "Store Code", "Store Name", "BIPL Warehouse Code", "BIPL Warehouse Name", "SKU Code",
                 "SKU Name", "Quantity (cases)", "Batch", "Mfg. Date", "Entered By", "Updated Date & Time"]
    try:
        wb = Workbook(); ws = wb.active; ws.title = "Inventory"
        ws.append(heads)
        for c in ws[1]:
            c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="0F6B46")
        q = q.order_by(InventoryEntry.inv_date.desc(), InventoryEntry.created_at.desc())
        for e in q.yield_per(2000):
            ca = e.created_at
            if ca is not None and ca.tzinfo is None:
                ca = ca.replace(tzinfo=ZoneInfo("UTC"))
            upd = ca.astimezone(IST).strftime("%d/%m/%Y %H:%M") if ca else None
            d = e.inv_date.strftime("%d/%m/%Y")
            whn = e.warehouse_name or names.get(e.warehouse_code, "")
            sn = snames.get(e.store_code) or ""
            if viewer:
                ws.append([d, e.store_code, sn, whn, e.sku_name, e.quantity, upd])
            else:
                ws.append([d, e.store_code, sn, e.warehouse_code, whn, e.sku_code,
                           e.sku_name, e.quantity, e.batch_no,
                           e.mfg_date.strftime("%d/%m/%Y") if e.mfg_date else None, e.created_by, upd])
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
        for i in range(1, len(heads) + 1):
            ws.column_dimensions[chr(64 + i)].width = 20
        buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    except Exception as e:
        raise internal_error("Export error", e)
    fname = f"Inventory_{date_from.isoformat()}_to_{date_to.isoformat()}.xlsx"
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
