# app/routers/rpa.py - Read-only endpoints for RPA process dashboards.
#
# Ported from the standalone Streamlit "Vendor Payment Advice Dashboard".
# The SQL (grouping by recid, MAX(payment_amount), email-sent-date logic,
# search across vendor_name/vendor_code/recid) is a 1:1 port so numbers
# match the Streamlit app exactly.
#
# Differences vs Streamlit, by design:
#  - No separate login/register/reset: the gate-entry app's JWT auth is
#    reused; endpoints are IT Admin only.
#  - Data comes from the separate RPA_Automation database, configured via
#    RPA_DB_* environment variables (.env).
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
import psycopg2
import psycopg2.extras

from app.auth import get_current_user
from app.models import UsersMaster
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rpa", tags=["RPA"])

# Read through the app's single settings mechanism (pydantic-settings reads
# .env directly — os.getenv would NOT see .env values).
RPA_DB = {
    "host": settings.RPA_DB_HOST,
    "port": settings.RPA_DB_PORT,
    "database": settings.RPA_DB_NAME,
    "user": settings.RPA_DB_USER,
    "password": settings.RPA_DB_PASSWORD,
}

MAX_ROWS = 5000


def _require_itadmin(user: UsersMaster):
    roles = [r.strip().lower().replace(" ", "") for r in (user.role or "").split(",") if r.strip()]
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail="Only IT Admins can view RPA dashboards")


def _conn():
    try:
        return psycopg2.connect(**RPA_DB)
    except Exception:
        logger.exception("RPA database connection failed")
        raise HTTPException(status_code=503, detail="RPA database is not reachable")


def _parse_date(value, field):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field} must be YYYY-MM-DD")


def _build_filters(status, payment_from, payment_to, email_from, email_to, search):
    """Shared WHERE-clause builder — identical semantics to the Streamlit app."""
    clause = " WHERE 1=1"
    params = []

    if status and status != "all":
        clause += " AND status = %s"
        params.append(status)

    p_from = _parse_date(payment_from, "payment_from")
    p_to = _parse_date(payment_to, "payment_to")
    e_from = _parse_date(email_from, "email_from")
    e_to = _parse_date(email_to, "email_to")

    if p_from:
        clause += " AND payment_date >= %s"
        params.append(p_from)
    if p_to:
        clause += " AND payment_date <= %s"
        params.append(p_to)

    # Email-sent-date filter applies to updated_at on completed records only
    # (for failed/undeliverable no email was sent, so they pass through).
    if e_from:
        clause += " AND (status != 'completed' OR updated_at >= %s)"
        params.append(datetime.combine(e_from, datetime.min.time()))
    if e_to:
        clause += " AND (status != 'completed' OR updated_at <= %s)"
        params.append(datetime.combine(e_to, datetime.max.time()))

    if search and search.strip():
        s = f"%{search.strip()}%"
        clause += """
            AND (
                vendor_name ILIKE %s
                OR vendor_code ILIKE %s
                OR CAST(recid AS TEXT) LIKE %s
            )
        """
        params.extend([s, s, s])

    return clause, params


@router.get("/vpa/summary")
def vpa_summary(
    payment_from: str = Query(None),
    payment_to: str = Query(None),
    email_from: str = Query(None),
    email_to: str = Query(None),
    search: str = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Distinct-recid counts per status, respecting active filters."""
    _require_itadmin(current_user)

    clause, params = _build_filters(None, payment_from, payment_to, email_from, email_to, search)
    query = f"""
        SELECT status, COUNT(DISTINCT recid) AS count
        FROM payment_details
        {clause}
        GROUP BY status
    """

    conn = None
    try:
        conn = _conn()
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
        counts = {"failed": 0, "undeliverable": 0, "completed": 0, "pending": 0}
        for status_value, count in rows:
            if status_value in counts:
                counts[status_value] = int(count)
        return counts
    except HTTPException:
        raise
    except Exception:
        logger.exception("vpa_summary query failed")
        raise HTTPException(status_code=500, detail="Failed to load VPA summary")
    finally:
        if conn:
            conn.close()


@router.get("/vpa/records")
def vpa_records(
    status: str = Query("all"),
    payment_from: str = Query(None),
    payment_to: str = Query(None),
    email_from: str = Query(None),
    email_to: str = Query(None),
    search: str = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Payment records grouped by recid — 1:1 port of the Streamlit query."""
    _require_itadmin(current_user)

    clause, params = _build_filters(status, payment_from, payment_to, email_from, email_to, search)
    query = f"""
        SELECT
            recid,
            vendor_name,
            vendor_code,
            vendor_email,
            site,
            status,
            MIN(payment_date)                          AS payment_date,
            MAX(payment_amount)                        AS payment_amount,
            payment_type,
            COUNT(DISTINCT NULLIF(invoice_number, '')) AS invoice_count,
            CASE
                WHEN MAX(status) = 'completed' THEN MAX(updated_at)
                ELSE NULL
            END                                        AS email_sent_date
        FROM payment_details
        {clause}
        GROUP BY recid, vendor_name, vendor_code, vendor_email,
                 site, status, payment_type
        ORDER BY payment_date DESC, recid DESC
        LIMIT {MAX_ROWS}
    """

    conn = None
    try:
        conn = _conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

        results = []
        for row in rows:
            results.append({
                "recid": int(row["recid"]) if row["recid"] is not None else None,
                "vendor_name": row["vendor_name"],
                "vendor_code": row["vendor_code"],
                "vendor_email": row["vendor_email"],
                "site": row["site"],
                "status": row["status"],
                "payment_date": row["payment_date"].isoformat() if row["payment_date"] else None,
                "payment_amount": float(row["payment_amount"]) if row["payment_amount"] is not None else None,
                "payment_type": row["payment_type"],
                "invoice_count": int(row["invoice_count"] or 0),
                "email_sent_date": row["email_sent_date"].isoformat() if row["email_sent_date"] else None,
            })

        return {"count": len(results), "results": results}
    except HTTPException:
        raise
    except Exception:
        logger.exception("vpa_records query failed")
        raise HTTPException(status_code=500, detail="Failed to load VPA records")
    finally:
        if conn:
            conn.close()
