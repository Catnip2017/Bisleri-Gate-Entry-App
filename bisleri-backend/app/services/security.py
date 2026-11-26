# app/services/security.py - Audit trail, last-seen tracking, Security Settings
# and the nightly dormant-account check (26 Nov 2026).
#
# Everything here needs migration b9e4d2a7c1f5. Until that migration has
# been run, security_ready() is False and every helper quietly does nothing,
# so pulling this code onto a database that hasn't been upgraded yet does not
# break login or user management.
#
# Agreed rules (26 Nov 2026):
#   * inactive 90 days -> alert, warning from day 75; never used 30 days -> alert
#   * NO automatic disabling, ever — IT Admin disables / deletes by hand
#   * alerts in the app and (optionally) by email via Microsoft Graph
#   * exempt users (comma list in settings) never get alerts
import logging
import threading
import time
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.models.security import AuditLog, SecuritySetting, SecurityAlert

logger = logging.getLogger(__name__)

# ── Is the migration in? (cached; a "no" is re-checked every minute) ─────────
_ready = {"value": False, "checked": 0.0}
_ready_lock = threading.Lock()


def security_ready(db: Session) -> bool:
    if _ready["value"]:
        return True
    now = time.monotonic()
    if now - _ready["checked"] < 60:
        return False
    with _ready_lock:
        _ready["checked"] = now
        try:
            insp = inspect(db.get_bind())
            cols = {c["name"] for c in insp.get_columns("users_master")}
            _ready["value"] = insp.has_table("audit_log") and "last_seen_at" in cols
        except Exception:  # noqa: BLE001 — never break a request over this check
            _ready["value"] = False
    return _ready["value"]


def _reset_ready_cache():   # tests
    _ready.update(value=False, checked=0.0)


# ── Audit trail ──────────────────────────────────────────────────────────────
def audit(db: Session, actor: Optional[str], action: str, target_user: Optional[str] = None,
          details: Optional[dict] = None, reason: Optional[str] = None, ip: Optional[str] = None) -> None:
    """Add one audit row in the caller's transaction (the caller commits)."""
    if not security_ready(db):
        return
    db.add(AuditLog(actor=actor, action=action, target_user=target_user, details=details or None,
                    reason=(reason or "").strip()[:500] or None, ip=(ip or None)))


def audit_now(db: Session, actor, action, target_user=None, details=None, reason=None, ip=None) -> None:
    """Audit row in its own short transaction — for events where the main
    transaction is not committed (e.g. a failed login)."""
    if not security_ready(db):
        return
    try:
        audit(db, actor, action, target_user, details, reason, ip)
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("audit write failed (%s)", action)


def diff(before: dict, after: dict) -> dict:
    """Only the fields that changed: {"field": {"from": x, "to": y}}."""
    out = {}
    for k in sorted(set(before) | set(after)):
        a, b = before.get(k), after.get(k)
        if a != b:
            out[k] = {"from": a, "to": b}
    return out


def client_ip(request) -> Optional[str]:
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for") if hasattr(request, "headers") else None
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    return getattr(getattr(request, "client", None), "host", None)


# ── Last seen (at most one write per user every 5 minutes) ───────────────────
_SEEN_EVERY = 300
_seen_cache: dict = {}


def touch_last_seen(db: Session, username: str) -> None:
    now = time.monotonic()
    if now - _seen_cache.get(username, -1e9) < _SEEN_EVERY:
        return
    if not security_ready(db):
        return
    _seen_cache[username] = now
    try:
        db.execute(text("UPDATE users_master SET last_seen_at = :t WHERE username = :u"),
                   {"t": datetime.now(), "u": username})
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


# ── Settings ─────────────────────────────────────────────────────────────────
DEFAULTS = {
    "inactive_days": "90",
    "warning_days": "75",
    "never_used_days": "30",
    "alerts_enabled": "true",
    "alert_inapp": "true",
    "alert_email": "false",
    "alert_emails": "",
    "exempt_users": "",
}
LABELS = {
    "inactive_days": "Inactive account limit (days)",
    "warning_days": "Warning from (days inactive)",
    "never_used_days": "Never-used account limit (days)",
    "alerts_enabled": "Nightly alert check",
    "alert_inapp": "Show alerts in the app",
    "alert_email": "Send alert email",
    "alert_emails": "Alert email recipients",
    "exempt_users": "Exempt users",
}


def get_settings(db: Session) -> dict:
    vals = dict(DEFAULTS)
    if security_ready(db):
        for row in db.query(SecuritySetting).all():
            if row.key in vals and row.value is not None:
                vals[row.key] = row.value
    return vals


def _as_bool(v) -> bool:
    return str(v).strip().lower() in ("1", "true", "yes", "on")


def _as_int(v, default) -> int:
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return default


def typed_settings(db: Session) -> dict:
    v = get_settings(db)
    return {
        "inactive_days": _as_int(v["inactive_days"], 90),
        "warning_days": _as_int(v["warning_days"], 75),
        "never_used_days": _as_int(v["never_used_days"], 30),
        "alerts_enabled": _as_bool(v["alerts_enabled"]),
        "alert_inapp": _as_bool(v["alert_inapp"]),
        "alert_email": _as_bool(v["alert_email"]),
        "alert_emails": [e.strip() for e in v["alert_emails"].replace(";", ",").split(",") if e.strip()],
        "exempt_users": [u.strip() for u in v["exempt_users"].split(",") if u.strip()],
    }


def validate_settings(new: dict) -> Optional[str]:
    inactive = _as_int(new.get("inactive_days"), -1)
    warn = _as_int(new.get("warning_days"), -1)
    never = _as_int(new.get("never_used_days"), -1)
    if not (7 <= inactive <= 3650):
        return "Inactive account limit must be between 7 and 3650 days."
    if not (1 <= warn < inactive):
        return "Warning must start after day 1 and before the inactive limit."
    if not (1 <= never <= 3650):
        return "Never-used account limit must be between 1 and 3650 days."
    for e in [x.strip() for x in str(new.get("alert_emails") or "").replace(";", ",").split(",") if x.strip()]:
        if "@" not in e or " " in e or len(e) > 254:
            return f"'{e}' is not a valid email address."
    return None


def save_settings(db: Session, new: dict, actor: str, reason: Optional[str] = None, ip=None) -> dict:
    """Replace the editable settings; one audit row with the before/after."""
    before = get_settings(db)
    after = dict(before)
    for k in DEFAULTS:
        if k in new and new[k] is not None:
            v = new[k]
            if isinstance(v, bool):
                v = "true" if v else "false"
            elif isinstance(v, (list, tuple)):
                v = ", ".join(str(x).strip() for x in v if str(x).strip())
            after[k] = str(v).strip()
    changes = diff(before, after)
    if not changes:
        return after
    for k, ch in changes.items():
        row = db.query(SecuritySetting).filter(SecuritySetting.key == k).first()
        if row is None:
            row = SecuritySetting(key=k)
            db.add(row)
        row.value = ch["to"]
        row.updated_by = actor
        row.updated_at = datetime.now()
    audit(db, actor, "settings_changed", None, {"changes": changes}, reason, ip)
    db.commit()
    return after


# ── Nightly dormant-account check ────────────────────────────────────────────
def _days(since: Optional[datetime], now: datetime) -> Optional[int]:
    if since is None:
        return None
    if since.tzinfo is not None:
        since = since.replace(tzinfo=None)
    return (now - since).days


def find_dormant(db: Session, now: Optional[datetime] = None) -> list:
    """Accounts that need attention right now (active accounts only):
    kind = inactive | inactive_warning | never_used."""
    from app.models import UsersMaster
    now = now or datetime.now()
    s = typed_settings(db)
    exempt = {u.lower() for u in s["exempt_users"]}
    rows = db.query(UsersMaster.username, UsersMaster.first_name, UsersMaster.last_name, UsersMaster.role,
                    UsersMaster.last_login, UsersMaster.last_seen_at, UsersMaster.created_at,
                    UsersMaster.is_active).all()
    out = []
    for r in rows:
        if r.is_active is False or (r.username or "").lower() in exempt:
            continue
        last = max([d.replace(tzinfo=None) if d.tzinfo else d for d in (r.last_login, r.last_seen_at)
                    if d is not None], default=None)
        name = f"{r.first_name or ''} {r.last_name or ''}".strip()
        if last is None:
            age = _days(r.created_at, now)
            if age is not None and age >= s["never_used_days"]:
                out.append({"username": r.username, "name": name, "role": r.role, "kind": "never_used", "days": age,
                            "last": None,
                            "message": f"Never used the app since the account was created {age} days ago."})
            continue
        idle = _days(last, now)
        if idle >= s["inactive_days"]:
            out.append({"username": r.username, "name": name, "role": r.role, "kind": "inactive", "days": idle,
                        "last": last,
                        "message": f"Not used for {idle} days (limit {s['inactive_days']}). Disable or delete manually if no longer needed."})
        elif idle >= s["warning_days"]:
            out.append({"username": r.username, "name": name, "role": r.role, "kind": "inactive_warning", "days": idle,
                        "last": last,
                        "message": f"Not used for {idle} days — reaches the {s['inactive_days']}-day limit in {s['inactive_days'] - idle} days."})
    return out


def run_dormant_check(db: Session, now: Optional[datetime] = None, send_email: bool = True) -> dict:
    """Raise one open alert per user + kind (no duplicates while it is open),
    resolve alerts that no longer apply, optionally email the new ones.
    NEVER disables or deletes an account."""
    if not security_ready(db):
        return {"skipped": "migration b9e4d2a7c1f5 not applied"}
    s = typed_settings(db)
    if not s["alerts_enabled"]:
        return {"skipped": "alerts switched off in Security Settings"}
    now = now or datetime.now()
    found = find_dormant(db, now)
    current = {(f["username"], f["kind"]) for f in found}
    open_alerts = db.query(SecurityAlert).filter(SecurityAlert.status == "open").all()
    have = {(a.username, a.kind): a for a in open_alerts}
    # A dismissed alert stays dismissed until the user uses the app again
    # (then a new period of inactivity can raise a new alert).
    dismissed = {}
    for a in db.query(SecurityAlert).filter(SecurityAlert.status == "dismissed").all():
        h = a.handled_at.replace(tzinfo=None) if a.handled_at and a.handled_at.tzinfo else a.handled_at
        key = (a.username, a.kind)
        if h and (key not in dismissed or h > dismissed[key]):
            dismissed[key] = h
    new = []
    for f in found:
        key = (f["username"], f["kind"])
        a = have.get(key)
        if a:
            a.days, a.message = f["days"], f["message"]
            continue
        if key in dismissed and (f["last"] is None or f["last"] <= dismissed[key]):
            continue
        a = SecurityAlert(username=f["username"], kind=f["kind"], days=f["days"], message=f["message"], status="open")
        db.add(a)
        new.append(a)
    resolved = 0
    for key, a in have.items():
        if key not in current:
            a.status, a.handled_by, a.handled_at = "resolved", "system", now
            resolved += 1
    db.flush()
    emailed = False
    if send_email and s["alert_email"] and s["alert_emails"] and new:
        emailed = send_alert_email(s["alert_emails"], new)
        if emailed:
            for a in new:
                a.emailed_at = now
    audit(db, None, "dormant_check", None, {"new": len(new), "open": len(found), "resolved": resolved,
                                            "emailed": emailed})
    db.commit()
    return {"new": len(new), "open": len(found), "resolved": resolved, "emailed": emailed}


# ── Email through Microsoft Graph (client-credentials app registration) ──────
def send_alert_email(recipients: list, alerts: list) -> bool:
    """Needs GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET and
    ALERT_SENDER_MAILBOX in the backend .env (the secret is never stored in
    the database or shown in the app). Returns False (and logs) if not set."""
    from app.config import settings
    tenant, cid, secret, sender = (settings.GRAPH_TENANT_ID, settings.GRAPH_CLIENT_ID,
                                   settings.GRAPH_CLIENT_SECRET, settings.ALERT_SENDER_MAILBOX)
    if not all([tenant, cid, secret, sender]):
        logger.info("Alert email skipped: GRAPH_* / ALERT_SENDER_MAILBOX not set in .env")
        return False
    import httpx
    rows = "".join(
        f"<tr><td>{a.username}</td><td>{a.kind.replace('_', ' ')}</td><td>{a.days}</td><td>{a.message}</td></tr>"
        for a in alerts)
    body = ("<p>The nightly check found accounts that need a decision. Nothing has been disabled — "
            "please review them in Bisleri Ops Hub → User Management → Security.</p>"
            "<table border='1' cellpadding='4' cellspacing='0'><tr><th>User</th><th>Alert</th><th>Days</th>"
            f"<th>Detail</th></tr>{rows}</table>")
    try:
        tok = httpx.post(f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token", data={
            "client_id": cid, "client_secret": secret, "grant_type": "client_credentials",
            "scope": "https://graph.microsoft.com/.default"}, timeout=20)
        tok.raise_for_status()
        r = httpx.post(f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail",
                       headers={"Authorization": f"Bearer {tok.json()['access_token']}"},
                       json={"message": {
                           "subject": f"Bisleri Ops Hub: {len(alerts)} account alert(s)",
                           "body": {"contentType": "HTML", "content": body},
                           "toRecipients": [{"emailAddress": {"address": e}} for e in recipients]},
                           "saveToSentItems": False}, timeout=20)
        r.raise_for_status()
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Alert email failed")
        return False
