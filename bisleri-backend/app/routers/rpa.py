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
from app.utils.roles import normalize_roles
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
    roles = normalize_roles(user.role)
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


def _csv(value):
    """'A,B , C' -> ['A', 'B', 'C'] (empty list when nothing given)."""
    return [v.strip() for v in (value or "").split(",") if v.strip()]


def _build_filters(status, payment_from, payment_to, email_from, email_to, search, payment_types=None):
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

    # Payment Type filter (26 Nov 2026) — multi-select, values come from the data
    types = _csv(payment_types)
    if types:
        clause += " AND payment_type = ANY(%s)"
        params.append(types)

    if search and search.strip():
        s = f"%{search.strip()}%"
        # Invoice number match (26 Nov 2026) is done per RECID, so the whole
        # payment still shows with ALL its invoices, not just the one matched.
        clause += """
            AND (
                vendor_name ILIKE %s
                OR vendor_code ILIKE %s
                OR CAST(recid AS TEXT) LIKE %s
                OR recid IN (SELECT recid FROM payment_details WHERE invoice_number ILIKE %s)
            )
        """
        params.extend([s, s, s, s])

    return clause, params


@router.get("/vpa/summary")
def vpa_summary(
    payment_from: str = Query(None),
    payment_to: str = Query(None),
    email_from: str = Query(None),
    email_to: str = Query(None),
    search: str = Query(None),
    payment_types: str = Query(None, max_length=2000),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Distinct-recid counts per status, respecting active filters."""
    _require_itadmin(current_user)

    clause, params = _build_filters(None, payment_from, payment_to, email_from, email_to, search, payment_types)
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
    payment_types: str = Query(None, max_length=2000),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Payment records grouped by recid — 1:1 port of the Streamlit query."""
    _require_itadmin(current_user)

    clause, params = _build_filters(status, payment_from, payment_to, email_from, email_to, search, payment_types)
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
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT NULLIF(invoice_number, '')), NULL) AS invoice_numbers,
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
                "invoice_numbers": list(row["invoice_numbers"] or []),
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


VPA_EXPORT_MAX = 100000


@router.get("/vpa/export")
def vpa_export(
    status: str = Query("all"),
    payment_from: str = Query(None),
    payment_to: str = Query(None),
    email_from: str = Query(None),
    email_to: str = Query(None),
    search: str = Query(None),
    payment_types: str = Query(None, max_length=2000),
    current_user: UsersMaster = Depends(get_current_user),
):
    """VPA Download Report (26 Nov 2026, replaces the old Download CSV):
    .xlsx of ALL payments matching the filters (not just the rows loaded on
    screen), one row per payment with every invoice number in it."""
    import io
    from fastapi.responses import StreamingResponse
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment

    _require_itadmin(current_user)
    clause, params = _build_filters(status, payment_from, payment_to, email_from, email_to, search, payment_types)
    try:
        total = _fetch(f"SELECT COUNT(DISTINCT recid) FROM payment_details {clause}", params)[0][0]
        if total > VPA_EXPORT_MAX:
            raise HTTPException(status_code=400, detail=f"{total:,} payments match — please narrow the filters "
                                                        f"(max {VPA_EXPORT_MAX:,} per download).")
        rows = _fetch(f"""
            SELECT recid, vendor_name, vendor_code, vendor_email, site, status,
                   MIN(payment_date) AS payment_date, MAX(payment_amount) AS payment_amount, payment_type,
                   COUNT(DISTINCT NULLIF(invoice_number, '')) AS invoice_count,
                   ARRAY_REMOVE(ARRAY_AGG(DISTINCT NULLIF(invoice_number, '')), NULL) AS invoice_numbers,
                   CASE WHEN MAX(status) = 'completed' THEN MAX(updated_at) ELSE NULL END AS email_sent_date
            FROM payment_details {clause}
            GROUP BY recid, vendor_name, vendor_code, vendor_email, site, status, payment_type
            ORDER BY payment_date DESC, recid DESC""", params, dict_rows=True)
        heads = ["RECID", "Vendor Name", "Vendor Code", "Vendor Email", "Site", "Payment Date", "Amount",
                 "Payment Type", "Status", "Email Sent", "No. of Invoices", "Invoice Numbers"]
        wb = Workbook(); ws = wb.active; ws.title = "Vendor Payment Advice"
        ws.append(heads)
        for c in ws[1]:
            c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="0F6B46")
        for r in rows:
            sent = r["email_sent_date"]
            ws.append([
                int(r["recid"]) if r["recid"] is not None else None, r["vendor_name"], r["vendor_code"],
                r["vendor_email"], r["site"], r["payment_date"],
                float(r["payment_amount"]) if r["payment_amount"] is not None else None,
                r["payment_type"], (r["status"] or "").capitalize(),
                sent.replace(tzinfo=None) if sent is not None and getattr(sent, "tzinfo", None) else sent,
                int(r["invoice_count"] or 0), ", ".join(sorted(r["invoice_numbers"] or [])),
            ])
        for row in ws.iter_rows(min_row=2):
            row[5].number_format = "DD/MM/YYYY"
            row[6].number_format = "#,##0.00"
            row[9].number_format = "DD/MM/YYYY HH:MM"
            row[11].alignment = Alignment(wrap_text=True, vertical="top")
        for i, w in enumerate([12, 36, 14, 30, 8, 13, 14, 14, 13, 17, 10, 60], start=1):
            ws.column_dimensions[chr(64 + i)].width = w
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
        buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    except HTTPException:
        raise
    except Exception:
        logger.exception("vpa_export failed")
        raise HTTPException(status_code=500, detail="Failed to build the Vendor Payment Advice report")
    fname = f"Vendor_Payment_Advice_{payment_from or 'all'}_to_{payment_to or 'all'}.xlsx"
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


def _fetch(query, params=None, dict_rows=False):
    """Run one read-only query on RPA_Automation and return all rows."""
    conn = None
    try:
        conn = _conn()
        factory = psycopg2.extras.RealDictCursor if dict_rows else None
        with conn.cursor(cursor_factory=factory) as cur:
            cur.execute(query, params or [])
            return cur.fetchall()
    finally:
        if conn:
            conn.close()


@router.get("/vpa/payment-types")
def vpa_payment_types(current_user: UsersMaster = Depends(get_current_user)):
    """Payment Type filter options — read from the data, so a new type shows
    up in the filter automatically (26 Nov 2026)."""
    _require_itadmin(current_user)
    try:
        rows = _fetch("""
            SELECT DISTINCT payment_type FROM payment_details
            WHERE payment_type IS NOT NULL AND payment_type <> ''
            ORDER BY payment_type
        """)
        return [r[0] for r in rows]
    except HTTPException:
        raise
    except Exception:
        logger.exception("vpa_payment_types query failed")
        raise HTTPException(status_code=500, detail="Failed to load payment types")


# ══════════════════════════════════════════════════════════════════════════════
# Monthly Sales Invoice (26 Nov 2026) — RPA_Automation.customer_invoice_journal
# status: PENDING | COMPLETED | ISSUE. created_at is never returned (not shown).
# Recommended indexes (created manually on the DB):
#   (invoice_date), (status, invoice_date), (site, invoice_date)
# ══════════════════════════════════════════════════════════════════════════════
MSI_STATUSES = ("COMPLETED", "PENDING", "ISSUE")
MSI_EXPORT_MAX = 100000


def _msi_filters(status, date_from, date_to, sites, routes, challan, search):
    clause = " WHERE 1=1"
    params = []
    if status and status.lower() != "all":
        clause += " AND UPPER(TRIM(status)) = %s"
        params.append(status.strip().upper())
    d_from = _parse_date(date_from, "date_from")
    d_to = _parse_date(date_to, "date_to")
    if d_from:
        clause += " AND invoice_date >= %s"
        params.append(d_from)
    if d_to:
        clause += " AND invoice_date <= %s"
        params.append(d_to)
    site_list = _csv(sites)
    if site_list:
        clause += " AND site = ANY(%s)"
        params.append(site_list)
    route_list = _csv(routes)
    if route_list:
        clause += " AND route_code = ANY(%s)"
        params.append(route_list)
    if challan in ("yes", "no"):
        clause += " AND COALESCE(delivery_challan, false) = %s"
        params.append(challan == "yes")
    if search and search.strip():
        s = f"%{search.strip()}%"
        clause += """
            AND (
                invoice_number ILIKE %s
                OR invoice_account ILIKE %s
                OR customer_name ILIKE %s
                OR irn_number ILIKE %s
                OR voucher ILIKE %s
            )
        """
        params.extend([s, s, s, s, s])
    return clause, params


MSI_COLUMNS = """
    invoice_number, invoice_account, customer_name, invoice_date, voucher,
    currency, delivery_challan, irn_number, site, UPPER(TRIM(status)) AS status, route_code
"""


def _msi_row(r):
    return {
        "invoice_number": r["invoice_number"],
        "invoice_account": r["invoice_account"],
        "customer_name": r["customer_name"],
        "invoice_date": r["invoice_date"].isoformat() if r["invoice_date"] else None,
        "voucher": r["voucher"],
        "currency": r["currency"],
        "delivery_challan": r["delivery_challan"],
        "irn_number": r["irn_number"],
        "site": r["site"],
        "status": r["status"],
        "route_code": r["route_code"],
    }


@router.get("/msi/filters")
def msi_filter_options(current_user: UsersMaster = Depends(get_current_user)):
    """Site and route options from the data itself — a new site or route
    appears in the filters as soon as the bot writes its first invoice."""
    _require_itadmin(current_user)
    try:
        sites = _fetch("""SELECT DISTINCT site FROM customer_invoice_journal
                          WHERE site IS NOT NULL AND site <> '' ORDER BY site""")
        routes = _fetch("""SELECT DISTINCT route_code FROM customer_invoice_journal
                           WHERE route_code IS NOT NULL AND route_code <> '' ORDER BY route_code""")
        # Date span of the whole journal — the screen uses it to say where the
        # data is when the chosen dates return nothing.
        span = _fetch("SELECT MIN(invoice_date), MAX(invoice_date), COUNT(*) FROM customer_invoice_journal")[0]
        return {
            "sites": [r[0] for r in sites], "routes": [r[0] for r in routes],
            "first_invoice_date": span[0].isoformat() if span[0] else None,
            "latest_invoice_date": span[1].isoformat() if span[1] else None,
            "total_in_journal": int(span[2] or 0),
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("msi_filter_options query failed")
        raise HTTPException(status_code=500, detail="Failed to load Monthly Sales Invoice filters")


@router.get("/msi/summary")
def msi_summary(
    date_from: str = Query(None), date_to: str = Query(None),
    sites: str = Query(None, max_length=2000), routes: str = Query(None, max_length=4000),
    challan: str = Query("all"), search: str = Query(None, max_length=200),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Counts per status for ALL invoices matching the filters (not one page)."""
    _require_itadmin(current_user)
    clause, params = _msi_filters(None, date_from, date_to, sites, routes, challan, search)
    try:
        rows = _fetch(f"SELECT UPPER(TRIM(status)), COUNT(*) FROM customer_invoice_journal {clause} GROUP BY 1", params)
        counts = {"total": 0, "completed": 0, "pending": 0, "issue": 0}
        for st, n in rows:
            counts["total"] += int(n)
            key = (st or "").lower()
            if key in counts:
                counts[key] = int(n)
        return counts
    except HTTPException:
        raise
    except Exception:
        logger.exception("msi_summary query failed")
        raise HTTPException(status_code=500, detail="Failed to load Monthly Sales Invoice summary")


@router.get("/msi/records")
def msi_records(
    status: str = Query("all"),
    date_from: str = Query(None), date_to: str = Query(None),
    sites: str = Query(None, max_length=2000), routes: str = Query(None, max_length=4000),
    challan: str = Query("all"), search: str = Query(None, max_length=200),
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    current_user: UsersMaster = Depends(get_current_user),
):
    """One page of invoices (server-side paging) + the total row count."""
    _require_itadmin(current_user)
    clause, params = _msi_filters(status, date_from, date_to, sites, routes, challan, search)
    try:
        total = _fetch(f"SELECT COUNT(*) FROM customer_invoice_journal {clause}", params)[0][0]
        rows = _fetch(
            f"""SELECT {MSI_COLUMNS} FROM customer_invoice_journal {clause}
                ORDER BY invoice_date DESC NULLS LAST, invoice_number DESC
                LIMIT %s OFFSET %s""",
            params + [page_size, (page - 1) * page_size], dict_rows=True,
        )
        return {"total": int(total), "page": page, "page_size": page_size,
                "results": [_msi_row(r) for r in rows]}
    except HTTPException:
        raise
    except Exception:
        logger.exception("msi_records query failed")
        raise HTTPException(status_code=500, detail="Failed to load Monthly Sales Invoice records")


@router.get("/msi/export")
def msi_export(
    status: str = Query("all"),
    date_from: str = Query(None), date_to: str = Query(None),
    sites: str = Query(None, max_length=2000), routes: str = Query(None, max_length=4000),
    challan: str = Query("all"), search: str = Query(None, max_length=200),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Excel of ALL invoices matching the filters (same as the screen)."""
    import io
    from fastapi.responses import StreamingResponse
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    _require_itadmin(current_user)
    clause, params = _msi_filters(status, date_from, date_to, sites, routes, challan, search)
    try:
        total = _fetch(f"SELECT COUNT(*) FROM customer_invoice_journal {clause}", params)[0][0]
        if total > MSI_EXPORT_MAX:
            raise HTTPException(status_code=400, detail=f"{total:,} invoices match — please narrow the filters "
                                                        f"(max {MSI_EXPORT_MAX:,} per download).")
        rows = _fetch(
            f"""SELECT {MSI_COLUMNS} FROM customer_invoice_journal {clause}
                ORDER BY invoice_date DESC NULLS LAST, invoice_number DESC""",
            params, dict_rows=True,
        )
        heads = ["Invoice Number", "Invoice Date", "Customer Name", "Invoice Account", "Site", "Route Code",
                 "Voucher", "Currency", "Delivery Challan", "IRN Number", "Status"]
        wb = Workbook(); ws = wb.active; ws.title = "Monthly Sales Invoice"
        ws.append(heads)
        for c in ws[1]:
            c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="0F6B46")
        for r in rows:
            ws.append([r["invoice_number"], r["invoice_date"], r["customer_name"], r["invoice_account"],
                       r["site"], r["route_code"], r["voucher"], r["currency"],
                       None if r["delivery_challan"] is None else ("Yes" if r["delivery_challan"] else "No"),
                       r["irn_number"], r["status"]])
        for row in ws.iter_rows(min_row=2, min_col=2, max_col=2):
            for c in row:
                c.number_format = "DD/MM/YYYY"
        widths = [20, 13, 40, 18, 8, 12, 18, 9, 16, 70, 12]
        for i, w in enumerate(widths, start=1):
            ws.column_dimensions[chr(64 + i)].width = w
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
        buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    except HTTPException:
        raise
    except Exception:
        logger.exception("msi_export failed")
        raise HTTPException(status_code=500, detail="Failed to build the Monthly Sales Invoice report")
    fname = f"Monthly_Sales_Invoice_{date_from or 'all'}_to_{date_to or 'all'}.xlsx"
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
