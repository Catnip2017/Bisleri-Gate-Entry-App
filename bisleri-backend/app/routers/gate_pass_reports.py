# app/routers/gate_pass_reports.py — the "Reports" tab in the Gate Pass
# Menu (added 1 Oct 2026). Two reports, role-scoped exactly like the
# existing list/guard-pending endpoints:
#   - Creator / IT Admin : FY Register (one row per gate pass)
#   - Dispatcher / Security Guard : FY Item Reconciliation (one row per
#     item/asset line, across all dispatched passes — "what left the
#     premises this financial year, what's come back, what's still out")
#
# The on-screen JSON and the downloadable .xlsx are built from the exact
# same query + aggregation helpers below, so the numbers on screen and in
# the download always agree.
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


# ── FY helpers ────────────────────────────────────────────────────────────
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


def _creator_row(h: GatePassHeader, today: date) -> dict:
    line_count = len(h.lines)
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

    return {
        "gate_pass_no": h.gate_pass_no,
        "pass_type": h.pass_type,
        "status": h.status,
        "location_code": h.location_code,
        "department": h.department,
        "party_name": h.party_name,
        "created_by": h.created_by,
        "document_date": h.document_date,
        "released_at": h.released_at,
        "dispatched_at": h.dispatched_at,
        "expected_inward_date": h.expected_inward_date,
        "actual_inward_date": h.completed_at,
        "days_outstanding": days_outstanding,
        "line_count": line_count,
        "total_qty": total_qty,
        "total_amount": total_amount,
        "chargeable": chargeable,
        "cancel_info": cancel_info,
        "remarks": h.remarks,
    }


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
        and r["expected_inward_date"] is not None
        and r["expected_inward_date"] < date.today()
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


def _build_creator_report(db: Session, current_user: UsersMaster, fy_label: str):
    start, end = _fy_bounds(fy_label)
    query = _creator_scope(db, current_user).filter(
        GatePassHeader.document_date >= start, GatePassHeader.document_date <= end
    )
    headers = query.order_by(GatePassHeader.document_date.asc(), GatePassHeader.gate_pass_no.asc()).all()
    today = date.today()
    rows = [_creator_row(h, today) for h in headers]
    summary = _creator_summary(rows)
    return summary, rows


@router.get("/creator", response_model=CreatorReportResponse)
def creator_report(
    fy: str | None = Query(None, description="Financial year label e.g. '2026-27' — defaults to current FY"),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_initiator),
):
    fy_label = fy or _current_fy_label()
    summary, rows = _build_creator_report(db, current_user, fy_label)
    return CreatorReportResponse(financial_year=fy_label, summary=summary, rows=rows)


@router.get("/creator/export")
def creator_report_export(
    fy: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_initiator),
):
    fy_label = fy or _current_fy_label()
    summary, rows = _build_creator_report(db, current_user, fy_label)
    buf = build_creator_workbook(fy_label, summary, rows, _generated_note(fy_label))
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


def _dispatcher_summary(rows: list) -> dict:
    departments = {r["department"] for r in rows}
    pending_lines = sum(1 for r in rows if r["reconciliation_status"] == "Pending")
    overdue_lines = sum(
        1 for r in rows
        if r["reconciliation_status"] == "Pending"
        and r["pass_type"] == PASS_TYPE_RETURNABLE
        and r["expected_return_date"] is not None
        and r["expected_return_date"] < date.today()
    )
    return {
        "total_lines": len(rows),
        "total_qty_sent": sum(r["qty_sent"] for r in rows),
        "departments": len(departments),
        "pending_lines": pending_lines,
        "overdue_lines": overdue_lines,
    }


def _dept_summary(rows: list) -> list:
    depts = []
    seen = set()
    for r in rows:
        if r["department"] not in seen:
            seen.add(r["department"])
            depts.append(r["department"])

    today = date.today()
    out = []
    for dept in depts:
        dept_rows = [r for r in rows if r["department"] == dept]
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


def _build_dispatcher_report(db: Session, current_user: UsersMaster, fy_label: str):
    start, end = _fy_bounds(fy_label)
    query = _dispatcher_scope(db, current_user).filter(
        func.date(GatePassHeader.dispatched_at) >= start,
        func.date(GatePassHeader.dispatched_at) <= end,
    )
    headers = query.order_by(GatePassHeader.dispatched_at.asc()).all()

    # Resolve Item-line item_codes in one query (avoid N+1).
    item_ids = {
        l.item_id for h in headers for l in h.lines
        if l.item_type == "Item" and l.item_id is not None
    }
    item_code_by_id = {}
    if item_ids:
        for item_id, item_code in (
            db.query(GatePassItem.item_id, GatePassItem.item_code)
            .filter(GatePassItem.item_id.in_(item_ids))
            .all()
        ):
            item_code_by_id[item_id] = item_code

    today = date.today()
    rows = []
    for h in headers:
        for l in h.lines:
            item_code = l.asset_code if l.item_type == "Fixed Asset" else item_code_by_id.get(l.item_id)

            if h.pass_type == PASS_TYPE_NON_RETURNABLE:
                recon_status = "Not Applicable"
            elif not l.received_qty:
                recon_status = "Pending"
            elif l.received_qty >= (l.quantity or 0):
                recon_status = "Fully Returned"
            else:
                recon_status = "Partially Returned"

            days_outstanding = None
            if (
                h.pass_type == PASS_TYPE_RETURNABLE
                and recon_status in ("Pending", "Partially Returned")
                and h.dispatched_at is not None
            ):
                days_outstanding = (today - h.dispatched_at.date()).days

            actual_return_date = None
            if recon_status == "Fully Returned":
                actual_return_date = h.completed_at
            elif recon_status == "Partially Returned":
                actual_return_date = h.last_inward_at

            rows.append({
                "department": h.department,
                "gate_pass_no": h.gate_pass_no,
                "pass_type": h.pass_type,
                "line_type": l.item_type,
                "item_code": item_code,
                "description": l.description,
                "qty_sent": l.quantity or 0,
                "unit": l.uom,
                "dispatch_date": h.dispatched_at,
                "expected_return_date": h.expected_inward_date,
                "qty_returned": l.received_qty or 0,
                "actual_return_date": actual_return_date,
                "reconciliation_status": recon_status,
                "days_outstanding": days_outstanding,
                "party_name": h.party_name,
                "remarks": None,
            })

    summary = _dispatcher_summary(rows)
    dept_summary = _dept_summary(rows)
    return summary, rows, dept_summary


@router.get("/dispatcher", response_model=DispatcherReportResponse)
def dispatcher_report(
    fy: str | None = Query(None, description="Financial year label e.g. '2026-27' — defaults to current FY"),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_guard),
):
    fy_label = fy or _current_fy_label()
    summary, rows, dept_summary = _build_dispatcher_report(db, current_user, fy_label)
    return DispatcherReportResponse(
        financial_year=fy_label, summary=summary, rows=rows, department_summary=dept_summary
    )


@router.get("/dispatcher/export")
def dispatcher_report_export(
    fy: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_guard),
):
    fy_label = fy or _current_fy_label()
    summary, rows, dept_summary = _build_dispatcher_report(db, current_user, fy_label)
    buf = build_dispatcher_workbook(fy_label, summary, rows, dept_summary, _generated_note(fy_label))
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
    dropdown is never empty for a brand-new location."""
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
