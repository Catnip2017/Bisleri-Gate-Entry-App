# app/routers/gate_pass_reports.py — the "Reports" tab in the Gate Pass
# Menu (added 1 Oct 2026, revised 1 Oct 2026 for the filters/column rework).
# Two reports, role-scoped exactly like the existing list/guard-pending
# endpoints:
#   - Creator / IT Admin : FY Register (one row per gate pass, on screen —
#     line items nested per pass for the expandable row)
#   - Dispatcher / Security Guard : FY Item Reconciliation (one row per
#     gate pass on screen too — "clubbed", line items in the expandable
#     row — "what left the premises this financial year, what's come
#     back, what's still out")
#
# The on-screen JSON and the downloadable .xlsx are built from the exact
# same query + row-building helpers below, so the numbers on screen and in
# the download always agree. The .xlsx additionally flattens pass+lines to
# one row per line item (with a Register/Detail Table containing every
# line) because Excel Tables and AutoFilter both break on merged cells —
# see _flatten_creator_lines / _flatten_dispatcher_lines.
import logging
from collections import Counter
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func

from app.auth import get_current_user
from app.database import get_db
from app.models import UsersMaster
from app.models.gate_pass import (
    GatePassHeader, GatePassItem,
    GP_DISPATCHED, GP_PARTIAL, GP_CANCELLED,
    PASS_TYPE_RETURNABLE, PASS_TYPE_NON_RETURNABLE,
)
from app.routers.gate_pass import (
    _require_initiator, _require_guard, _roles,
    _user_gp_locations, _guard_location_filter, _current_fy_label,
)
from app.schemas.gate_pass_schemas import (
    FinancialYearsResponse, CreatorReportResponse, DispatcherReportResponse,
)
from app.reports.gate_pass_excel import build_creator_workbook, build_dispatcher_workbook

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gate-pass/reports", tags=["Gate Pass Reports"])


# ── Small helpers ────────────────────────────────────────────────────────
def _fy_bounds(fy_label: str):
    """'2026-27' -> (date(2026,4,1), date(2027,3,31))."""
    try:
        start_year = int(fy_label.split("-")[0])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid financial year label")
    return date(start_year, 4, 1), date(start_year + 1, 3, 31)


def _fy_label_for(d: date) -> str:
    return _current_fy_label(on=d)


def _generated_note(fy_label: str) -> str:
    return f"Generated {datetime.now().strftime('%d-%b-%Y %H:%M')} — Financial Year {fy_label}"


def _parse_csv(value: str | None) -> list[str] | None:
    """'Open,Dispatched' -> ['Open', 'Dispatched']; '' / None -> None (no filter).
    Same comma-separated convention already used for pass_types in the
    guard worklist (GatePassGuardTab.js), kept consistent here."""
    if not value:
        return None
    parsed = [v.strip() for v in value.split(",") if v.strip()]
    return parsed or None


def _filters_summary_line(date_label: str, date_from: date, date_to: date, fy_label: str,
                           status: list | None, pass_type: list | None,
                           department=False) -> str:
    # `department` is a sentinel: False (default) means "this report has no
    # department dimension" (Creator — every row is already the caller's
    # own department) and is omitted entirely; a list (possibly empty,
    # meaning "All") means "show it" (Dispatcher always passes one).
    parts = []
    if department is not False:
        parts.append(f"Department: {', '.join(department) if department else 'All'}")
    parts.append(f"Status: {', '.join(status) if status else 'All'}")
    parts.append(f"Pass Type: {', '.join(pass_type) if pass_type else 'All'}")
    is_default_range = date_from is None and date_to is None
    start, end = _fy_bounds(fy_label)
    d_from = date_from or start
    d_to = date_to or end
    range_desc = f"{d_from.strftime('%d-%b-%Y')} to {d_to.strftime('%d-%b-%Y')}"
    if is_default_range:
        range_desc += f" (FY {fy_label} default)"
    parts.append(f"{date_label}: {range_desc}")
    return "Filters applied for this export — " + "   ".join(parts)


def _item_code_lookup(db: Session, headers: list) -> dict:
    """Batch-resolve Item-line item_codes across every header's lines in one
    query (avoids N+1). Fixed Asset lines carry their code directly
    (l.asset_code) and don't need this lookup."""
    item_ids = {
        l.item_id for h in headers for l in h.lines
        if l.item_type == "Item" and l.item_id is not None
    }
    if not item_ids:
        return {}
    return dict(
        db.query(GatePassItem.item_id, GatePassItem.item_code)
        .filter(GatePassItem.item_id.in_(item_ids))
        .all()
    )


# ── Creator / IT Admin — FY Register ─────────────────────────────────────
def _creator_scope(db: Session, current_user: UsersMaster):
    gpu_locations = _user_gp_locations(db, current_user)
    if not gpu_locations:
        raise HTTPException(status_code=403, detail="NO_GP_LOCATION")
    query = db.query(GatePassHeader).options(
        joinedload(GatePassHeader.lines), joinedload(GatePassHeader.cancel_reason)
    ).filter(GatePassHeader.location_code.in_(gpu_locations))
    if current_user.department:
        query = query.filter(GatePassHeader.department == current_user.department)
    return query


def _creator_row(h: GatePassHeader, today: date, item_code_by_id: dict) -> dict:
    total_qty = sum((l.quantity or 0) for l in h.lines)
    total_amount = float(sum((l.amount or 0) for l in h.lines))
    chargeable = any(l.chargeable == "Chargeable" for l in h.lines)

    days_outstanding = None
    if (
        h.pass_type == PASS_TYPE_RETURNABLE
        and h.status in (GP_DISPATCHED, GP_PARTIAL)
        and h.dispatched_at is not None
    ):
        days_outstanding = (today - h.dispatched_at.date()).days

    cancel_info = None
    if h.status == GP_CANCELLED:
        reason = h.cancel_reason.reason_text if h.cancel_reason else ""
        cancel_info = f"{h.cancelled_by or ''} — {reason}".strip(" —")

    lines = []
    for l in sorted(h.lines, key=lambda x: x.line_no):
        item_code = l.asset_code if l.item_type == "Fixed Asset" else item_code_by_id.get(l.item_id)
        lines.append({
            "line_no": l.line_no,
            "item_type": l.item_type,
            "item_code": item_code,
            "description": l.description,
            "serial_no": l.serial_no,
            "uom": l.uom,
            "quantity": l.quantity or 0,
            "amount": float(l.amount or 0),
            "chargeable": l.chargeable == "Chargeable",
        })

    return {
        "gate_pass_no": h.gate_pass_no,
        "pass_type": h.pass_type,
        "status": h.status,
        "location_code": h.location_code,
        "party_name": h.party_name,
        "created_by": h.created_by,
        "gate_pass_created_date": h.document_date,
        "dispatched_at": h.dispatched_at,
        # Blank for NR passes regardless of what's stored — a pass that's
        # never expected back shouldn't show a date here.
        "expected_return_date": h.expected_inward_date if h.pass_type == PASS_TYPE_RETURNABLE else None,
        "actual_return_date": h.completed_at,
        "days_outstanding": days_outstanding,
        "total_qty": total_qty,
        "total_amount": total_amount,
        "chargeable": chargeable,
        "cancel_info": cancel_info,
        "remarks": h.remarks,
        "lines": lines,
    }


def _flatten_creator_lines(rows: list) -> list:
    """One flat dict per line item, pass-level fields repeated — feeds the
    merged Register+Line Items sheet. 'is_first_line' drives both the
    hidden helper column (so the Excel Summary can count unique passes,
    not rows) and the alternating row-band shading."""
    flat = []
    for r in rows:
        pass_fields = {k: v for k, v in r.items() if k != "lines"}
        if not r["lines"]:
            flat.append({**pass_fields, "line_no": None, "item_type": "", "item_code": None,
                         "description": "", "serial_no": None, "uom": None, "quantity": None,
                         "line_amount": None, "line_chargeable": None, "is_first_line": True})
            continue
        for i, l in enumerate(r["lines"]):
            flat.append({
                **pass_fields,
                "line_no": l["line_no"], "item_type": l["item_type"], "item_code": l["item_code"],
                "description": l["description"], "serial_no": l["serial_no"], "uom": l["uom"],
                "quantity": l["quantity"], "line_amount": l["amount"],
                "line_chargeable": l["chargeable"], "is_first_line": i == 0,
            })
    return flat


def _creator_summary(rows: list) -> dict:
    status_counts = dict(Counter(r["status"] for r in rows))
    returnable_count = sum(1 for r in rows if r["pass_type"] == PASS_TYPE_RETURNABLE)
    non_returnable_count = sum(1 for r in rows if r["pass_type"] == PASS_TYPE_NON_RETURNABLE)
    pending_return_count = sum(
        1 for r in rows
        if r["pass_type"] == PASS_TYPE_RETURNABLE and r["status"] in (GP_DISPATCHED, GP_PARTIAL)
    )
    overdue_count = sum(
        1 for r in rows
        if r["pass_type"] == PASS_TYPE_RETURNABLE
        and r["status"] in (GP_DISPATCHED, GP_PARTIAL)
        and r["expected_return_date"] is not None
        and r["expected_return_date"] < date.today()
    )
    total_chargeable_amount = sum(r["total_amount"] for r in rows if r["chargeable"])
    return {
        "total_passes": len(rows),
        "returnable_count": returnable_count,
        "non_returnable_count": non_returnable_count,
        "status_counts": status_counts,
        "pending_return_count": pending_return_count,
        "overdue_count": overdue_count,
        "total_chargeable_amount": total_chargeable_amount,
    }


def _build_creator_report(
    db: Session, current_user: UsersMaster, fy_label: str,
    status: list | None = None, pass_type: list | None = None,
    created_from: date | None = None, created_to: date | None = None,
):
    fy_start, fy_end = _fy_bounds(fy_label)
    start = created_from or fy_start
    end = created_to or fy_end
    query = _creator_scope(db, current_user).filter(
        GatePassHeader.document_date >= start, GatePassHeader.document_date <= end
    )
    if status:
        query = query.filter(GatePassHeader.status.in_(status))
    if pass_type:
        query = query.filter(GatePassHeader.pass_type.in_(pass_type))
    headers = query.order_by(GatePassHeader.document_date.asc(), GatePassHeader.gate_pass_no.asc()).all()

    item_code_by_id = _item_code_lookup(db, headers)
    today = date.today()
    rows = [_creator_row(h, today, item_code_by_id) for h in headers]
    summary = _creator_summary(rows)
    flat = _flatten_creator_lines(rows)
    return summary, rows, flat


@router.get("/creator", response_model=CreatorReportResponse)
def creator_report(
    fy: str | None = Query(None, description="Financial year label e.g. '2026-27' — defaults to current FY"),
    status: str | None = Query(None, description="Comma-separated status values"),
    pass_type: str | None = Query(None, description="Comma-separated: R,NR"),
    created_from: date | None = Query(None),
    created_to: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_initiator),
):
    fy_label = fy or _current_fy_label()
    summary, rows, _flat = _build_creator_report(
        db, current_user, fy_label, _parse_csv(status), _parse_csv(pass_type), created_from, created_to
    )
    return CreatorReportResponse(
        financial_year=fy_label, department=current_user.department, summary=summary, rows=rows
    )


@router.get("/creator/export")
def creator_report_export(
    fy: str | None = Query(None),
    status: str | None = Query(None),
    pass_type: str | None = Query(None),
    created_from: date | None = Query(None),
    created_to: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_initiator),
):
    fy_label = fy or _current_fy_label()
    status_list, pass_type_list = _parse_csv(status), _parse_csv(pass_type)
    summary, _rows, flat = _build_creator_report(
        db, current_user, fy_label, status_list, pass_type_list, created_from, created_to
    )
    filters_desc = _filters_summary_line(
        "Created Date", created_from, created_to, fy_label, status_list, pass_type_list
    )
    buf = build_creator_workbook(
        fy_label, current_user.department, summary, flat, _generated_note(fy_label), filters_desc
    )
    filename = f"Gate_Pass_Creator_FY_Register_{fy_label}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Dispatcher / Security Guard — FY Item Reconciliation ─────────────────
def _dispatcher_scope(db: Session, current_user: UsersMaster):
    query = db.query(GatePassHeader).options(joinedload(GatePassHeader.lines)).filter(
        GatePassHeader.dispatched_at.isnot(None)
    )
    return _guard_location_filter(db, query, current_user)


def _dispatcher_row(h: GatePassHeader, today: date, item_code_by_id: dict) -> dict:
    lines = []
    qty_sent_total = 0
    for l in h.lines:
        item_code = l.asset_code if l.item_type == "Fixed Asset" else item_code_by_id.get(l.item_id)
        qty_sent_total += l.quantity or 0

        if h.pass_type == PASS_TYPE_NON_RETURNABLE:
            recon_status = "Not Applicable"
        elif not l.received_qty:
            recon_status = "Pending"
        elif l.received_qty >= (l.quantity or 0):
            recon_status = "Fully Returned"
        else:
            recon_status = "Partially Returned"

        lines.append({
            "item_code": item_code,
            "description": l.description,
            "qty_sent": l.quantity or 0,
            "unit": l.uom,
            "qty_returned": l.received_qty or 0,
            "reconciliation_status": recon_status,
            "serial_no": l.serial_no,
        })

    # Pass-level Days Outstanding reflects ANY line still out — a pass with
    # 2 of 3 items back still shows outstanding days for the straggler.
    any_pending = any(l["reconciliation_status"] in ("Pending", "Partially Returned") for l in lines)
    days_outstanding = None
    if h.pass_type == PASS_TYPE_RETURNABLE and any_pending and h.dispatched_at is not None:
        days_outstanding = (today - h.dispatched_at.date()).days

    # The pass only carries one meaningful "last receipt" timestamp in the
    # data model (no per-line receipt times) — completed_at once every line
    # is back, last_inward_at if some but not all are.
    if lines and all(l["reconciliation_status"] == "Fully Returned" for l in lines):
        actual_return_date = h.completed_at
    elif any(l["reconciliation_status"] in ("Fully Returned", "Partially Returned") for l in lines):
        actual_return_date = h.last_inward_at
    else:
        actual_return_date = None

    return {
        "department": h.department,
        "pass_type": h.pass_type,
        "gate_pass_no": h.gate_pass_no,
        "status": h.status,
        "party_name": h.party_name,
        "dispatch_date": h.dispatched_at,
        "expected_return_date": h.expected_inward_date if h.pass_type == PASS_TYPE_RETURNABLE else None,
        "actual_return_date": actual_return_date,
        "total_qty_sent": qty_sent_total,
        "days_outstanding": days_outstanding,
        "remarks": h.dispatch_remarks,
        "lines": lines,
    }


def _flatten_dispatcher_lines(rows: list) -> list:
    """One flat dict per line item, pass-level fields repeated — feeds the
    merged Detail+Line Items sheet. Mirrors _flatten_creator_lines."""
    flat = []
    for r in rows:
        pass_fields = {k: v for k, v in r.items() if k != "lines"}
        if not r["lines"]:
            flat.append({**pass_fields, "item_code": None, "description": "", "qty_sent": 0,
                         "unit": None, "qty_returned": 0, "reconciliation_status": "Not Applicable",
                         "serial_no": None, "is_first_line": True})
            continue
        for i, l in enumerate(r["lines"]):
            flat.append({**pass_fields, **l, "is_first_line": i == 0})
    return flat


def _dispatcher_summary(flat_rows: list) -> dict:
    departments = {r["department"] for r in flat_rows}
    pending_lines = sum(1 for r in flat_rows if r["reconciliation_status"] == "Pending")
    overdue_lines = sum(
        1 for r in flat_rows
        if r["reconciliation_status"] == "Pending"
        and r["pass_type"] == PASS_TYPE_RETURNABLE
        and r["expected_return_date"] is not None
        and r["expected_return_date"] < date.today()
    )
    return {
        "total_passes": sum(1 for r in flat_rows if r.get("is_first_line")),
        "total_lines": len(flat_rows),
        "total_qty_sent": sum(r["qty_sent"] for r in flat_rows),
        "departments": len(departments),
        "pending_lines": pending_lines,
        "overdue_lines": overdue_lines,
    }


def _dept_summary(flat_rows: list) -> list:
    depts = []
    seen = set()
    for r in flat_rows:
        if r["department"] not in seen:
            seen.add(r["department"])
            depts.append(r["department"])

    today = date.today()
    out = []
    for dept in depts:
        dept_rows = [r for r in flat_rows if r["department"] == dept]
        pending_days = [r["days_outstanding"] for r in dept_rows
                         if r["reconciliation_status"] == "Pending" and r["days_outstanding"] is not None]
        out.append({
            "department": dept,
            "total_lines": len(dept_rows),
            "total_qty_sent": sum(r["qty_sent"] for r in dept_rows),
            "lines_fully_returned": sum(1 for r in dept_rows if r["reconciliation_status"] == "Fully Returned"),
            "lines_partially_returned": sum(1 for r in dept_rows if r["reconciliation_status"] == "Partially Returned"),
            "lines_pending": sum(1 for r in dept_rows if r["reconciliation_status"] == "Pending"),
            "nr_lines": sum(1 for r in dept_rows if r["reconciliation_status"] == "Not Applicable"),
            "oldest_pending_days": max(pending_days) if pending_days else None,
            "overdue_lines": sum(
                1 for r in dept_rows
                if r["reconciliation_status"] == "Pending"
                and r["pass_type"] == PASS_TYPE_RETURNABLE
                and r["expected_return_date"] is not None
                and r["expected_return_date"] < today
            ),
        })
    return out


def _build_dispatcher_report(
    db: Session, current_user: UsersMaster, fy_label: str,
    status: list | None = None, pass_type: list | None = None, department: list | None = None,
    dispatch_from: date | None = None, dispatch_to: date | None = None,
):
    fy_start, fy_end = _fy_bounds(fy_label)
    start = dispatch_from or fy_start
    end = dispatch_to or fy_end
    query = _dispatcher_scope(db, current_user).filter(
        func.date(GatePassHeader.dispatched_at) >= start,
        func.date(GatePassHeader.dispatched_at) <= end,
    )
    if status:
        query = query.filter(GatePassHeader.status.in_(status))
    if pass_type:
        query = query.filter(GatePassHeader.pass_type.in_(pass_type))
    if department:
        query = query.filter(GatePassHeader.department.in_(department))
    headers = query.order_by(GatePassHeader.dispatched_at.asc()).all()

    item_code_by_id = _item_code_lookup(db, headers)
    today = date.today()
    rows = [_dispatcher_row(h, today, item_code_by_id) for h in headers]
    flat = _flatten_dispatcher_lines(rows)
    summary = _dispatcher_summary(flat)
    dept_summary = _dept_summary(flat)
    return summary, rows, dept_summary, flat


@router.get("/dispatcher", response_model=DispatcherReportResponse)
def dispatcher_report(
    fy: str | None = Query(None, description="Financial year label e.g. '2026-27' — defaults to current FY"),
    status: str | None = Query(None, description="Comma-separated status values"),
    pass_type: str | None = Query(None, description="Comma-separated: R,NR"),
    department: str | None = Query(None, description="Comma-separated department names"),
    dispatch_from: date | None = Query(None),
    dispatch_to: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_guard),
):
    fy_label = fy or _current_fy_label()
    summary, rows, dept_summary, _flat = _build_dispatcher_report(
        db, current_user, fy_label, _parse_csv(status), _parse_csv(pass_type),
        _parse_csv(department), dispatch_from, dispatch_to,
    )
    return DispatcherReportResponse(
        financial_year=fy_label, summary=summary, rows=rows, department_summary=dept_summary
    )


@router.get("/dispatcher/export")
def dispatcher_report_export(
    fy: str | None = Query(None),
    status: str | None = Query(None),
    pass_type: str | None = Query(None),
    department: str | None = Query(None),
    dispatch_from: date | None = Query(None),
    dispatch_to: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_guard),
):
    fy_label = fy or _current_fy_label()
    status_list, pass_type_list = _parse_csv(status), _parse_csv(pass_type)
    department_list = _parse_csv(department)
    summary, _rows, dept_summary, flat = _build_dispatcher_report(
        db, current_user, fy_label, status_list, pass_type_list, department_list,
        dispatch_from, dispatch_to,
    )
    filters_desc = _filters_summary_line(
        "Dispatch Date", dispatch_from, dispatch_to, fy_label, status_list, pass_type_list,
        department_list or []
    )
    buf = build_dispatcher_workbook(
        fy_label, summary, flat, dept_summary, _generated_note(fy_label), filters_desc
    )
    filename = f"Gate_Pass_Dispatcher_FY_Item_Reconciliation_{fy_label}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Financial year picker ─────────────────────────────────────────────────
@router.get("/financial-years", response_model=FinancialYearsResponse)
def financial_years(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    """FYs with at least one gate pass in the caller's scope, newest first —
    always includes the current FY even if it has no passes yet, so the
    dropdown is never empty for a brand-new location. Unaffected by the
    on-screen status/type/date filters — it's just picking which FY to look
    at in the first place."""
    roles = _roles(current_user)
    dates = []
    if "gatepasscreator" in roles:
        query = _creator_scope(db, current_user)
        dates = [d for (d,) in query.with_entities(GatePassHeader.document_date).all()]
    elif "gatepassdispatcher" in roles:
        query = _dispatcher_scope(db, current_user)
        dates = [
            dt.date() for (dt,) in query.with_entities(GatePassHeader.dispatched_at).all()
            if dt is not None
        ]
    else:
        raise HTTPException(status_code=403, detail="No access to gate pass reports")

    current = _current_fy_label()
    labels = {_fy_label_for(d) for d in dates}
    labels.add(current)
    ordered = sorted(labels, reverse=True)
    return FinancialYearsResponse(financial_years=ordered, current=current)
