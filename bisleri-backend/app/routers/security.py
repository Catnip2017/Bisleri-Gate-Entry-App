# app/routers/security.py - IT Admin: Security Settings, dormant-account
# alerts, audit trail and the Users access Excel (26 Nov 2026).
#
# Settings / alerts / audit need migration b9e4d2a7c1f5; until it is applied
# those endpoints answer 503 with a plain message. The Users access Excel
# works on any database.
import io
from datetime import date, datetime, timedelta
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings as app_settings
from app.database import get_db
from app.models import UsersMaster
from app.models.gate_pass import UserGatePassLocation
from app.models.security import AuditLog, SecurityAlert
from app.services import security as sec
from app.utils.roles import normalize_roles, INVENTORY_OPERATOR, INVENTORY_VIEWER

router = APIRouter(prefix="/security", tags=["Security (IT Admin)"])
IST = ZoneInfo("Asia/Kolkata")
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

ACTION_LABELS = {
    "user_created": "User created",
    "access_changed": "Access changed",
    "user_deactivated": "User disabled",
    "user_activated": "User enabled",
    "user_deleted": "User deleted",
    "password_reset": "Password reset",
    "details_changed": "Details changed",
    "inventory_access_changed": "Inventory access changed",
    "login_failed": "Failed login",
    "settings_changed": "Security settings changed",
    "alert_dismissed": "Alert dismissed",
    "dormant_check": "Nightly alert check",
}


def _admin(user: UsersMaster):
    if "itadmin" not in normalize_roles(user.role):
        raise HTTPException(status_code=403, detail="Only IT Admins can open Security")


def _ready(db: Session):
    if not sec.security_ready(db):
        raise HTTPException(status_code=503, detail="Security features are not set up on this database yet "
                            "(run 'alembic upgrade b9e4d2a7c1f5' on the backend).")


def _ist(dt) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(IST).strftime("%d/%m/%Y %H:%M")


def _email_configured() -> bool:
    return all([app_settings.GRAPH_TENANT_ID, app_settings.GRAPH_CLIENT_ID,
                app_settings.GRAPH_CLIENT_SECRET, app_settings.ALERT_SENDER_MAILBOX])


# ── Settings ─────────────────────────────────────────────────────────────────
class SettingsIn(BaseModel):
    inactive_days: int
    warning_days: int
    never_used_days: int
    alerts_enabled: bool = True
    alert_inapp: bool = True
    alert_email: bool = False
    alert_emails: str = ""
    exempt_users: str = ""
    reason: Optional[str] = None


@router.get("/settings")
def get_security_settings(db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    _admin(current_user)
    _ready(db)
    hist = db.query(AuditLog).filter(AuditLog.action == "settings_changed") \
        .order_by(AuditLog.created_at.desc()).limit(20).all()
    return {
        "values": sec.typed_settings(db),
        "labels": sec.LABELS,
        "email_configured": _email_configured(),
        "sender": app_settings.ALERT_SENDER_MAILBOX or None,
        "history": [{"at": h.created_at.isoformat() if h.created_at else None, "by": h.actor,
                     "changes": (h.details or {}).get("changes", {}), "reason": h.reason} for h in hist],
    }


@router.put("/settings")
def put_security_settings(payload: SettingsIn, request: Request, db: Session = Depends(get_db),
                          current_user: UsersMaster = Depends(get_current_user)):
    _admin(current_user)
    _ready(db)
    data = payload.model_dump()
    err = sec.validate_settings(data)
    if err:
        raise HTTPException(status_code=400, detail=err)
    known = {u for (u,) in db.query(UsersMaster.username).all()}
    exempt = [u.strip() for u in payload.exempt_users.split(",") if u.strip()]
    unknown = [u for u in exempt if u not in known]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown user(s) in exemptions: {', '.join(unknown)}")
    if payload.alert_email and not [e for e in payload.alert_emails.split(",") if e.strip()]:
        raise HTTPException(status_code=400, detail="Add at least one recipient to send alert emails.")
    sec.save_settings(db, data, current_user.username, payload.reason, sec.client_ip(request))
    return get_security_settings(db, current_user)


# ── Alerts ───────────────────────────────────────────────────────────────────
def _alert_row(a: SecurityAlert, names: dict) -> dict:
    u = names.get(a.username) or {}
    return {"id": a.id, "username": a.username, "name": u.get("name", ""), "role": u.get("role"),
            "is_active": u.get("is_active", True), "exists": a.username in names,
            "kind": a.kind, "days": a.days, "message": a.message, "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "handled_by": a.handled_by, "handled_at": a.handled_at.isoformat() if a.handled_at else None,
            "emailed": a.emailed_at is not None}


def _user_names(db: Session, usernames) -> dict:
    rows = db.query(UsersMaster.username, UsersMaster.first_name, UsersMaster.last_name, UsersMaster.role,
                    UsersMaster.is_active).filter(UsersMaster.username.in_(list(usernames) or [""])).all()
    return {u: {"name": f"{f or ''} {l or ''}".strip(), "role": r, "is_active": a is not False}
            for (u, f, l, r, a) in rows}


@router.get("/alerts")
def list_alerts(status: str = Query("open", pattern="^(open|dismissed|resolved|all)$"),
                db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    _admin(current_user)
    if not sec.security_ready(db):
        return {"ready": False, "alerts": [], "open_count": 0}
    q = db.query(SecurityAlert)
    if status != "all":
        q = q.filter(SecurityAlert.status == status)
    rows = q.order_by(SecurityAlert.created_at.desc()).limit(500).all()
    names = _user_names(db, {a.username for a in rows})
    open_count = db.query(SecurityAlert).filter(SecurityAlert.status == "open").count()
    inapp = sec.typed_settings(db)["alert_inapp"]
    return {"ready": True, "inapp": inapp, "open_count": open_count, "alerts": [_alert_row(a, names) for a in rows]}


class DismissIn(BaseModel):
    reason: Optional[str] = None


@router.post("/alerts/{alert_id}/dismiss")
def dismiss_alert(alert_id: int, payload: DismissIn, request: Request, db: Session = Depends(get_db),
                  current_user: UsersMaster = Depends(get_current_user)):
    _admin(current_user)
    _ready(db)
    a = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    if a.status != "open":
        raise HTTPException(status_code=400, detail="This alert is already closed")
    a.status, a.handled_by, a.handled_at = "dismissed", current_user.username, datetime.now(IST)
    sec.audit(db, current_user.username, "alert_dismissed", a.username, {"kind": a.kind, "days": a.days},
              payload.reason, sec.client_ip(request))
    db.commit()
    return {"ok": True}


@router.post("/alerts/run-now")
def run_check_now(db: Session = Depends(get_db), current_user: UsersMaster = Depends(get_current_user)):
    """Same as the nightly job (no email from a manual run). Never disables anyone."""
    _admin(current_user)
    _ready(db)
    return sec.run_dormant_check(db, send_email=False)


# ── Audit trail ──────────────────────────────────────────────────────────────
def _audit_query(db, username, action, date_from, date_to, q):
    query = db.query(AuditLog)
    if username:
        query = query.filter(or_(AuditLog.target_user == username, AuditLog.actor == username))
    if action:
        query = query.filter(AuditLog.action.in_([a.strip() for a in action.split(",") if a.strip()]))
    if date_from:
        query = query.filter(AuditLog.created_at >= datetime.combine(date_from, datetime.min.time(), IST))
    if date_to:
        query = query.filter(AuditLog.created_at < datetime.combine(date_to + timedelta(days=1),
                                                                    datetime.min.time(), IST))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(AuditLog.target_user.ilike(like), AuditLog.actor.ilike(like),
                                 AuditLog.reason.ilike(like)))
    return query


def _describe(a: AuditLog) -> str:
    d = a.details or {}
    if a.action in ("access_changed", "details_changed", "inventory_access_changed", "settings_changed"):
        parts = []
        for k, ch in (d.get("changes") or {}).items():
            fr, to = ch.get("from"), ch.get("to")
            fr = ", ".join(fr) if isinstance(fr, list) else fr
            to = ", ".join(to) if isinstance(to, list) else to
            parts.append(f"{k.replace('_', ' ')}: {fr if fr not in (None, '') else '—'} → {to if to not in (None, '') else '—'}")
        return "; ".join(parts)
    if a.action == "user_created":
        af = d.get("after") or {}
        return f"role: {af.get('role')}" + (f"; warehouse: {af['warehouse_code']}" if af.get("warehouse_code") else "")
    if a.action == "user_deleted":
        bf = d.get("before") or {}
        return f"{bf.get('name') or ''} ({bf.get('role')})".strip()
    if a.action == "login_failed":
        return d.get("why", "") + (f" ('{d['username_tried']}')" if d.get("username_tried") else "")
    if a.action == "dormant_check":
        return f"{d.get('new', 0)} new, {d.get('open', 0)} open, {d.get('resolved', 0)} resolved" + \
            (", emailed" if d.get("emailed") else "")
    if a.action == "alert_dismissed":
        return f"{(d.get('kind') or '').replace('_', ' ')} ({d.get('days')} days)"
    return ""


def _audit_row(a: AuditLog) -> dict:
    return {"id": a.id, "at": a.created_at.isoformat() if a.created_at else None, "actor": a.actor or "system",
            "action": a.action, "action_label": ACTION_LABELS.get(a.action, a.action),
            "target_user": a.target_user, "detail": _describe(a), "reason": a.reason, "ip": a.ip}


@router.get("/audit")
def list_audit(
    username: Optional[str] = Query(None, max_length=50),
    action: Optional[str] = Query(None, max_length=300),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    q: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    _admin(current_user)
    if not sec.security_ready(db):
        return {"ready": False, "total": 0, "results": [], "actions": ACTION_LABELS}
    query = _audit_query(db, username, action, date_from, date_to, q)
    total = query.count()
    rows = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    return {"ready": True, "total": total, "page": page, "page_size": page_size,
            "results": [_audit_row(a) for a in rows], "actions": ACTION_LABELS}


@router.get("/audit/export")
def export_audit(
    username: Optional[str] = Query(None, max_length=50),
    action: Optional[str] = Query(None, max_length=300),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    q: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    _admin(current_user)
    _ready(db)
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    query = _audit_query(db, username, action, date_from, date_to, q) \
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(100000)
    wb = Workbook(); ws = wb.active; ws.title = "Audit trail"
    heads = ["Date & Time (IST)", "Done by", "Action", "User", "What changed", "Reason", "IP address"]
    ws.append(heads)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="0F6B46")
    for a in query.yield_per(2000):
        r = _audit_row(a)
        ws.append([_ist(a.created_at), r["actor"], r["action_label"], r["target_user"], r["detail"], r["reason"], r["ip"]])
    for col, w in zip("ABCDEFG", [18, 16, 24, 18, 80, 30, 16]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"; ws.auto_filter.ref = ws.dimensions
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    name = f"Audit_Trail{('_' + username) if username else ''}_{date.today().isoformat()}.xlsx"
    return StreamingResponse(buf, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ── Users access Excel (replaces access-review campaigns) ────────────────────
class UsersExportIn(BaseModel):
    usernames: Optional[List[str]] = None     # None = every user; else just these (the filtered list)


def _inventory_maps(db: Session):
    """Inventory portal mapping per user, if those tables exist."""
    try:
        from app.models.inventory import InventoryUserWarehouse, InventoryOperatorViewer, InventoryViewerStore
        wh, vw, st = {}, {}, {}
        for u, w in db.query(InventoryUserWarehouse.username, InventoryUserWarehouse.warehouse_code).all():
            wh.setdefault(u, []).append(w)
        for o, v in db.query(InventoryOperatorViewer.operator_username, InventoryOperatorViewer.viewer_username).all():
            vw.setdefault(o, []).append(v)
        for u, s in db.query(InventoryViewerStore.username, InventoryViewerStore.store_code).all():
            st[u] = s
        return wh, vw, st
    except Exception:  # noqa: BLE001 — tables not created yet
        db.rollback()
        return {}, {}, {}


@router.post("/users-access/export")
def export_users_access(payload: UsersExportIn, db: Session = Depends(get_db),
                        current_user: UsersMaster = Depends(get_current_user)):
    _admin(current_user)
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    q = db.query(UsersMaster)
    if payload.usernames is not None:
        q = q.filter(UsersMaster.username.in_(payload.usernames or [""]))
    users = q.order_by(UsersMaster.first_name, UsersMaster.last_name, UsersMaster.username).all()
    gp = {}
    for u, c, d in db.query(UserGatePassLocation.username, UserGatePassLocation.location_code,
                            UserGatePassLocation.is_default).all():
        gp.setdefault(u, []).append(f"{c}{' (default)' if d else ''}")
    inv_wh, inv_vw, inv_st = ({}, {}, {})
    if any({INVENTORY_OPERATOR, INVENTORY_VIEWER} & set(normalize_roles(u.role)) for u in users):
        inv_wh, inv_vw, inv_st = _inventory_maps(db)
    seen = {}
    if sec.security_ready(db):
        for u, c, s in db.query(UsersMaster.username, UsersMaster.created_at, UsersMaster.last_seen_at).all():
            seen[u] = (c, s)

    wb = Workbook(); ws = wb.active; ws.title = "Users and access"
    heads = ["Username", "First name", "Last name", "Role(s)", "Status", "Warehouse", "Site", "Department",
             "Gate Pass locations", "Co Packer location", "Inventory warehouses", "Inventory Blinkit users",
             "Inventory store", "Email", "Mobile", "Last login", "Last seen", "Created"]
    ws.append(heads)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="0F6B46")

    def fmt(d):
        return d.strftime("%d/%m/%Y %H:%M") if d else None

    for u in users:
        c, s = seen.get(u.username, (None, None))
        ws.append([
            u.username, u.first_name, u.last_name, u.role,
            "Disabled" if u.is_active is False else "Active",
            f"{u.warehouse_code} · {u.warehouse_name}" if u.warehouse_code else None, u.site_code, u.department,
            ", ".join(sorted(gp.get(u.username, []))) or (u.gate_pass_location or None), u.copacker_location,
            ", ".join(sorted(inv_wh.get(u.username, []))) or None,
            ", ".join(sorted(inv_vw.get(u.username, []))) or None, inv_st.get(u.username),
            u.email, u.phone_number, fmt(u.last_login), fmt(s), fmt(c),
        ])
    widths = [16, 14, 14, 30, 10, 28, 8, 14, 28, 18, 22, 22, 14, 26, 12, 16, 16, 16]
    for i, w in enumerate(widths, start=1):
        from openpyxl.utils import get_column_letter
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "B2"; ws.auto_filter.ref = ws.dimensions
    info = wb.create_sheet("About")
    info.append([f"Downloaded by {current_user.username} on {datetime.now(IST).strftime('%d/%m/%Y %H:%M')} IST"])
    info.append([f"{len(users)} user(s)" + (" — filtered list" if payload.usernames is not None else " — all users")])
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    tag = users[0].username if payload.usernames is not None and len(users) == 1 else "Users"
    name = f"{tag}_Access_{date.today().isoformat()}.xlsx"
    return StreamingResponse(buf, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{name}"'})
