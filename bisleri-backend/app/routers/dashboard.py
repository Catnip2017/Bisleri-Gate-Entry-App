# app/routers/dashboard.py — Read-only endpoints for the Vehicle/Load
# analytics dashboard (Overview Analytics tab).
#
# Ported from the standalone Streamlit dashboard's
# Load_management/UI_components/enterprise_analytics.py — the SQL is a 1:1
# port (same GROUP BY / filter semantics) so numbers match the Streamlit app
# exactly, plus one new query (activity heatmap) approved during planning.
#
# Data comes from the separate Bisleri_dashboard database (HISTORICAL_DB_*
# env vars) — same pattern as app/routers/rpa.py's RPA_DB.
#
# Auth: reuses the gate-entry app's JWT (get_current_user); every endpoint is
# IT Admin only, matching the 'Dashboards' tile's visibility in the app.
import logging
from typing import List, Optional

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_current_user
from app.utils.roles import normalize_roles
from app.models import UsersMaster
from app.dashboard.etl.connections import HISTORICAL_DB
from app.dashboard.etl.constants import TABLES, RECORDS_PER_PAGE, LOAD_THRESHOLDS, LOAD_DATA_START_DATE

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard-api", tags=["Dashboard"])


def _require_itadmin(user: UsersMaster):
    roles = normalize_roles(user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail="Only IT Admins can view the dashboard")


def _conn():
    try:
        return psycopg2.connect(**HISTORICAL_DB)
    except Exception:
        logger.exception("Dashboard (Bisleri_dashboard) database connection failed")
        raise HTTPException(status_code=503, detail="Dashboard database is not reachable")


def _warehouse_filter_clause(selected_warehouses: List[str], column: str = "warehouse_name") -> tuple:
    """Same semantics as the Streamlit app's _warehouse_filter_clause, but
    parameterized (%s placeholders) instead of string-escaped."""
    if not selected_warehouses:
        return "", []
    placeholders = ", ".join(["%s"] * len(selected_warehouses))
    return f"AND {column} IN ({placeholders})", list(selected_warehouses)


def _date_range_clause(start_date: Optional[str], end_date: Optional[str], column: str = "date") -> tuple:
    """From/To date filter. Each side applies independently — picking only a
    'from' (or only a 'to') date still filters, instead of requiring both."""
    conditions = []
    params: list = []
    if start_date:
        conditions.append(f"{column} >= %s")
        params.append(start_date)
    if end_date:
        conditions.append(f"{column} < %s::date + INTERVAL '1 day'")
        params.append(end_date)
    if not conditions:
        return "", []
    return "AND " + " AND ".join(conditions), params


def _query(sql: str, params: list):
    conn = None
    try:
        conn = _conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        if conn:
            conn.close()


# ── Shared filters ───────────────────────────────────────────────────────────

@router.get("/filters/warehouses")
def list_warehouses(current_user: UsersMaster = Depends(get_current_user)):
    """Distinct warehouse names for the global filter bar."""
    _require_itadmin(current_user)
    try:
        rows = _query(f"""
            SELECT DISTINCT warehouse_name
            FROM {TABLES['insights']}
            WHERE warehouse_name IS NOT NULL
            ORDER BY warehouse_name
        """, [])
        return [r["warehouse_name"] for r in rows]
    except HTTPException:
        raise
    except Exception:
        logger.exception("list_warehouses failed")
        raise HTTPException(status_code=500, detail="Failed to load warehouse list")


# ── Overview Analytics ───────────────────────────────────────────────────────

@router.get("/overview/stats")
def overview_stats(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Enterprise-level KPI numbers — 1:1 port of get_enterprise_stats."""
    _require_itadmin(current_user)
    wf, params = _warehouse_filter_clause(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        rows = _query(f"""
            SELECT
                COUNT(DISTINCT gate_entry_no) as total_trips,
                COUNT(DISTINCT vehicle_no) as total_vehicles,
                COUNT(DISTINCT gate_entry_no) as total_gate_entries,
                COUNT(DISTINCT CASE WHEN movement_type = 'Gate-In' THEN gate_entry_no END) as gate_in_count,
                COUNT(DISTINCT CASE WHEN movement_type = 'Gate-Out' THEN gate_entry_no END) as gate_out_count,
                COUNT(DISTINCT warehouse_name) as total_warehouses,
                MAX(date) as last_updated
            FROM {TABLES['insights']}
            WHERE 1=1 {wf} {df}
        """, params + dparams)
        return rows[0] if rows else None
    except HTTPException:
        raise
    except Exception:
        logger.exception("overview_stats failed")
        raise HTTPException(status_code=500, detail="Failed to load overview stats")


@router.get("/overview/document-types")
def overview_document_types(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_enterprise_document_type_stats."""
    _require_itadmin(current_user)
    wf, params = _warehouse_filter_clause(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        return _query(f"""
            SELECT
                COALESCE(document_type, 'Unknown') as document_type,
                COUNT(DISTINCT gate_entry_no) as trip_count
            FROM {TABLES['insights']}
            WHERE 1=1 {wf} {df}
            GROUP BY document_type
            ORDER BY trip_count DESC
        """, params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("overview_document_types failed")
        raise HTTPException(status_code=500, detail="Failed to load document type stats")


@router.get("/overview/vehicle-ownership")
def overview_vehicle_ownership(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_enterprise_vehicle_ownership."""
    _require_itadmin(current_user)
    wf, params = _warehouse_filter_clause(warehouses or [], column="i.warehouse_name")
    df, dparams = _date_range_clause(start_date, end_date, column="i.date")
    try:
        return _query(f"""
            SELECT
                CASE
                    WHEN vm.vehicle_classification = 'Company Owned' THEN 'Company Owned'
                    ELSE 'Hired'
                END as ownership_type,
                COUNT(DISTINCT i.vehicle_no) as vehicle_count
            FROM {TABLES['insights']} i
            LEFT JOIN {TABLES['vehicle_master']} vm
                ON TRIM(UPPER(i.vehicle_no)) = TRIM(UPPER(vm.registration_no))
            WHERE 1=1 {wf} {df}
            GROUP BY ownership_type
            ORDER BY vehicle_count DESC
        """, params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("overview_vehicle_ownership failed")
        raise HTTPException(status_code=500, detail="Failed to load vehicle ownership stats")


@router.get("/overview/movement-stats")
def overview_movement_stats(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_enterprise_movement_stats."""
    _require_itadmin(current_user)
    wf, params = _warehouse_filter_clause(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        return _query(f"""
            SELECT
                movement_type,
                COUNT(DISTINCT gate_entry_no) as trip_count
            FROM {TABLES['insights']}
            WHERE movement_type IS NOT NULL {wf} {df}
            GROUP BY movement_type
            ORDER BY trip_count DESC
        """, params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("overview_movement_stats failed")
        raise HTTPException(status_code=500, detail="Failed to load movement stats")


@router.get("/overview/trend")
def overview_trend(
    granularity: str = Query("daily", pattern="^(daily|monthly)$"),
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_enterprise_daily_trend / get_enterprise_monthly_trend."""
    _require_itadmin(current_user)
    wf, params = _warehouse_filter_clause(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        if granularity == "monthly":
            return _query(f"""
                SELECT
                    DATE_TRUNC('month', date) as trip_month,
                    COUNT(DISTINCT gate_entry_no) as trip_count
                FROM {TABLES['insights']}
                WHERE 1=1 {wf} {df}
                GROUP BY DATE_TRUNC('month', date)
                ORDER BY DATE_TRUNC('month', date)
            """, params + dparams)
        return _query(f"""
            SELECT
                DATE(date) as trip_date,
                COUNT(DISTINCT gate_entry_no) as trip_count,
                COUNT(DISTINCT CASE WHEN movement_type = 'Gate-In' THEN gate_entry_no END) as gate_in,
                COUNT(DISTINCT CASE WHEN movement_type = 'Gate-Out' THEN gate_entry_no END) as gate_out
            FROM {TABLES['insights']}
            WHERE 1=1 {wf} {df}
            GROUP BY DATE(date)
            ORDER BY DATE(date)
        """, params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("overview_trend failed")
        raise HTTPException(status_code=500, detail="Failed to load trend data")


@router.get("/overview/warehouse-distribution")
def overview_warehouse_distribution(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_enterprise_warehouse_distribution (also used for the
    top-warehouses ranking — already sorted trip_count DESC)."""
    _require_itadmin(current_user)
    wf, params = _warehouse_filter_clause(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        return _query(f"""
            SELECT
                warehouse_name,
                COUNT(DISTINCT gate_entry_no) as trip_count,
                COUNT(DISTINCT CASE WHEN movement_type = 'Gate-In' THEN gate_entry_no END) as gate_in,
                COUNT(DISTINCT CASE WHEN movement_type = 'Gate-Out' THEN gate_entry_no END) as gate_out
            FROM {TABLES['insights']}
            WHERE warehouse_name IS NOT NULL {wf} {df}
            GROUP BY warehouse_name
            ORDER BY trip_count DESC
        """, params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("overview_warehouse_distribution failed")
        raise HTTPException(status_code=500, detail="Failed to load warehouse distribution")


@router.get("/overview/activity-heatmap")
def overview_activity_heatmap(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): gate-in/gate-out volume by day-of-week
    x hour-of-day, to spot congestion patterns."""
    _require_itadmin(current_user)
    wf, params = _warehouse_filter_clause(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        return _query(f"""
            SELECT
                EXTRACT(DOW FROM date)::int as day_of_week,
                EXTRACT(HOUR FROM time)::int as hour_of_day,
                COUNT(DISTINCT gate_entry_no) as trip_count
            FROM {TABLES['insights']}
            WHERE date IS NOT NULL AND time IS NOT NULL {wf} {df}
            GROUP BY day_of_week, hour_of_day
            ORDER BY day_of_week, hour_of_day
        """, params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("overview_activity_heatmap failed")
        raise HTTPException(status_code=500, detail="Failed to load activity heatmap")


# ── Turn Around Time ─────────────────────────────────────────────────────────
# Ported from Load_management/UI_components/TAT.py — reads pre-computed
# summary tables (document_tat_summary, vehicle_loading_time_summary), not
# raw insights data. Warehouse + date range now come from the shared global
# filter bar (an upgrade from the original per-tab warehouse filters); site,
# vehicle no, document no, document type stay local to this tab, same as the
# Streamlit app.

def _doc_tat_filters(
    site: Optional[str],
    warehouses: List[str],
    vehicle_no: Optional[str],
    document_no: Optional[str],
    document_types: List[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> tuple:
    conditions = []
    params: list = []

    if site:
        conditions.append("site_code = %s")
        params.append(site)

    if warehouses:
        placeholders = ", ".join(["%s"] * len(warehouses))
        conditions.append(f"warehouse_name IN ({placeholders})")
        params.extend(warehouses)

    if vehicle_no:
        conditions.append("UPPER(vehicle_no) = UPPER(%s)")
        params.append(vehicle_no.strip())

    if document_no:
        conditions.append("UPPER(document_no) = UPPER(%s)")
        params.append(document_no.strip())

    if document_types:
        placeholders = ", ".join(["%s"] * len(document_types))
        conditions.append(f"document_type IN ({placeholders})")
        params.extend(document_types)

    if start_date:
        conditions.append("DATE(gate_entry_datetime) >= %s")
        params.append(start_date)
    if end_date:
        conditions.append("DATE(gate_entry_datetime) <= %s")
        params.append(end_date)

    return (" AND ".join(conditions) if conditions else "1=1"), params


def _veh_tat_filters(
    warehouses: List[str],
    vehicle_no: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> tuple:
    conditions = []
    params: list = []

    if warehouses:
        placeholders = ", ".join(["%s"] * len(warehouses))
        conditions.append(f"warehouse_name IN ({placeholders})")
        params.extend(warehouses)

    if vehicle_no:
        conditions.append("UPPER(vehicle_no) = UPPER(%s)")
        params.append(vehicle_no.strip())

    if start_date:
        conditions.append("entry_date >= %s")
        params.append(start_date)
    if end_date:
        conditions.append("entry_date <= %s")
        params.append(end_date)

    return (" AND ".join(conditions) if conditions else "1=1"), params


@router.get("/tat/filters/sites")
def tat_sites(current_user: UsersMaster = Depends(get_current_user)):
    _require_itadmin(current_user)
    try:
        rows = _query(f"""
            SELECT DISTINCT site_code FROM {TABLES['document_tat_summary']}
            WHERE site_code IS NOT NULL ORDER BY site_code
        """, [])
        return [r["site_code"] for r in rows]
    except Exception:
        logger.exception("tat_sites failed")
        raise HTTPException(status_code=500, detail="Failed to load site list")


@router.get("/tat/filters/document-types")
def tat_document_types(current_user: UsersMaster = Depends(get_current_user)):
    _require_itadmin(current_user)
    try:
        rows = _query(f"""
            SELECT DISTINCT document_type FROM {TABLES['document_tat_summary']}
            WHERE document_type IS NOT NULL ORDER BY document_type
        """, [])
        return [r["document_type"] for r in rows]
    except Exception:
        logger.exception("tat_document_types failed")
        raise HTTPException(status_code=500, detail="Failed to load document type list")


@router.get("/tat/document/date-range")
def tat_document_date_range(current_user: UsersMaster = Depends(get_current_user)):
    _require_itadmin(current_user)
    try:
        rows = _query(f"""
            SELECT MIN(DATE(gate_entry_datetime)) as min_date, MAX(DATE(gate_entry_datetime)) as max_date
            FROM {TABLES['document_tat_summary']}
        """, [])
        return rows[0] if rows else {"min_date": None, "max_date": None}
    except Exception:
        logger.exception("tat_document_date_range failed")
        raise HTTPException(status_code=500, detail="Failed to load date range")


@router.get("/tat/vehicle/date-range")
def tat_vehicle_date_range(current_user: UsersMaster = Depends(get_current_user)):
    _require_itadmin(current_user)
    try:
        rows = _query(f"""
            SELECT MIN(entry_date) as min_date, MAX(entry_date) as max_date
            FROM {TABLES['vehicle_loading_time_summary']}
        """, [])
        return rows[0] if rows else {"min_date": None, "max_date": None}
    except Exception:
        logger.exception("tat_vehicle_date_range failed")
        raise HTTPException(status_code=500, detail="Failed to load date range")


@router.get("/tat/document")
def tat_document(
    page: int = Query(1, ge=1),
    site: Optional[str] = Query(None),
    warehouses: Optional[List[str]] = Query(None),
    vehicle_no: Optional[str] = Query(None),
    document_no: Optional[str] = Query(None),
    document_types: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_document_tat — paginated."""
    _require_itadmin(current_user)
    where, params = _doc_tat_filters(
        site, warehouses or [], vehicle_no, document_no, document_types or [], start_date, end_date
    )
    offset = (page - 1) * RECORDS_PER_PAGE
    try:
        rows = _query(f"""
            SELECT
                gate_entry_no, gate_entry_datetime, document_no, document_type,
                document_entry_datetime, vehicle_no, driver_name, warehouse_name,
                site_code, tat_minutes, tat_formatted as avg_turn,
                COUNT(*) OVER() as total_count
            FROM {TABLES['document_tat_summary']}
            WHERE {where}
            ORDER BY gate_entry_datetime DESC
            LIMIT %s OFFSET %s
        """, params + [RECORDS_PER_PAGE, offset])
        total_count = rows[0]["total_count"] if rows else 0
        for r in rows:
            r.pop("total_count", None)
        return {"data": rows, "total_count": total_count}
    except HTTPException:
        raise
    except Exception:
        logger.exception("tat_document failed")
        raise HTTPException(status_code=500, detail="Failed to load document TAT")


@router.get("/tat/document/average")
def tat_document_average(
    site: Optional[str] = Query(None),
    warehouses: Optional[List[str]] = Query(None),
    vehicle_no: Optional[str] = Query(None),
    document_no: Optional[str] = Query(None),
    document_types: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_document_tat_overall_average — not paginated."""
    _require_itadmin(current_user)
    where, params = _doc_tat_filters(
        site, warehouses or [], vehicle_no, document_no, document_types or [], start_date, end_date
    )
    try:
        rows = _query(f"""
            SELECT AVG(tat_minutes) as avg_minutes
            FROM {TABLES['document_tat_summary']}
            WHERE {where}
        """, params)
        avg = rows[0]["avg_minutes"] if rows else None
        return {"avg_minutes": float(avg) if avg is not None else 0.0}
    except HTTPException:
        raise
    except Exception:
        logger.exception("tat_document_average failed")
        raise HTTPException(status_code=500, detail="Failed to load document TAT average")


@router.get("/tat/document/boxplot")
def tat_document_boxplot(
    site: Optional[str] = Query(None),
    warehouses: Optional[List[str]] = Query(None),
    vehicle_no: Optional[str] = Query(None),
    document_no: Optional[str] = Query(None),
    document_types: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): TAT distribution per warehouse —
    averages hide overload/delay clusters that a spread shows."""
    _require_itadmin(current_user)
    where, params = _doc_tat_filters(
        site, warehouses or [], vehicle_no, document_no, document_types or [], start_date, end_date
    )
    try:
        return _query(f"""
            SELECT
                warehouse_name,
                MIN(tat_minutes) as min,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY tat_minutes) as q1,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY tat_minutes) as median,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY tat_minutes) as q3,
                MAX(tat_minutes) as max
            FROM {TABLES['document_tat_summary']}
            WHERE {where} AND tat_minutes IS NOT NULL AND warehouse_name IS NOT NULL
            GROUP BY warehouse_name
            ORDER BY warehouse_name
        """, params)
    except HTTPException:
        raise
    except Exception:
        logger.exception("tat_document_boxplot failed")
        raise HTTPException(status_code=500, detail="Failed to load TAT distribution")


@router.get("/tat/document/trend")
def tat_document_trend(
    site: Optional[str] = Query(None),
    warehouses: Optional[List[str]] = Query(None),
    vehicle_no: Optional[str] = Query(None),
    document_no: Optional[str] = Query(None),
    document_types: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): daily average TAT trend."""
    _require_itadmin(current_user)
    where, params = _doc_tat_filters(
        site, warehouses or [], vehicle_no, document_no, document_types or [], start_date, end_date
    )
    try:
        return _query(f"""
            SELECT
                DATE(gate_entry_datetime) as entry_date,
                AVG(tat_minutes) as avg_minutes,
                COUNT(*) as record_count
            FROM {TABLES['document_tat_summary']}
            WHERE {where}
            GROUP BY DATE(gate_entry_datetime)
            ORDER BY DATE(gate_entry_datetime)
        """, params)
    except HTTPException:
        raise
    except Exception:
        logger.exception("tat_document_trend failed")
        raise HTTPException(status_code=500, detail="Failed to load TAT trend")


@router.get("/tat/document/sla-breach")
def tat_document_sla_breach(
    threshold_minutes: float = Query(120),
    site: Optional[str] = Query(None),
    warehouses: Optional[List[str]] = Query(None),
    vehicle_no: Optional[str] = Query(None),
    document_no: Optional[str] = Query(None),
    document_types: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): % of trips exceeding a TAT threshold."""
    _require_itadmin(current_user)
    where, params = _doc_tat_filters(
        site, warehouses or [], vehicle_no, document_no, document_types or [], start_date, end_date
    )
    try:
        rows = _query(f"""
            SELECT
                COUNT(*) FILTER (WHERE tat_minutes > %s) as breach_count,
                COUNT(*) as total_count
            FROM {TABLES['document_tat_summary']}
            WHERE {where}
        """, [threshold_minutes] + params)
        r = rows[0] if rows else {"breach_count": 0, "total_count": 0}
        total = r["total_count"] or 0
        breach = r["breach_count"] or 0
        return {
            "threshold_minutes": threshold_minutes,
            "breach_count": breach,
            "total_count": total,
            "breach_pct": round(breach / total * 100, 1) if total else 0.0,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("tat_document_sla_breach failed")
        raise HTTPException(status_code=500, detail="Failed to load SLA breach stats")


@router.get("/tat/vehicle")
def tat_vehicle(
    page: int = Query(1, ge=1),
    warehouses: Optional[List[str]] = Query(None),
    vehicle_no: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_vehicle_loading_time — paginated."""
    _require_itadmin(current_user)
    where, params = _veh_tat_filters(warehouses or [], vehicle_no, start_date, end_date)
    offset = (page - 1) * RECORDS_PER_PAGE
    try:
        rows = _query(f"""
            SELECT
                warehouse_code, warehouse_name, vehicle_no, entry_gate_no,
                entry_datetime, exit_gate_no, exit_datetime, loading_time_minutes,
                loading_time_formatted as total_time, documents_in_entry,
                documents_in_exit, is_still_inside,
                COUNT(*) OVER() as total_count
            FROM {TABLES['vehicle_loading_time_summary']}
            WHERE {where}
            ORDER BY entry_datetime DESC
            LIMIT %s OFFSET %s
        """, params + [RECORDS_PER_PAGE, offset])
        total_count = rows[0]["total_count"] if rows else 0
        for r in rows:
            r.pop("total_count", None)
        return {"data": rows, "total_count": total_count}
    except HTTPException:
        raise
    except Exception:
        logger.exception("tat_vehicle failed")
        raise HTTPException(status_code=500, detail="Failed to load vehicle TAT")


@router.get("/tat/vehicle/average")
def tat_vehicle_average(
    warehouses: Optional[List[str]] = Query(None),
    vehicle_no: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_vehicle_loading_time_overall_average — not paginated."""
    _require_itadmin(current_user)
    where, params = _veh_tat_filters(warehouses or [], vehicle_no, start_date, end_date)
    try:
        rows = _query(f"""
            SELECT AVG(loading_time_minutes) as avg_minutes
            FROM {TABLES['vehicle_loading_time_summary']}
            WHERE {where}
        """, params)
        avg = rows[0]["avg_minutes"] if rows else None
        return {"avg_minutes": float(avg) if avg is not None else 0.0}
    except HTTPException:
        raise
    except Exception:
        logger.exception("tat_vehicle_average failed")
        raise HTTPException(status_code=500, detail="Failed to load vehicle TAT average")


@router.get("/tat/vehicle/boxplot")
def tat_vehicle_boxplot(
    warehouses: Optional[List[str]] = Query(None),
    vehicle_no: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): loading-time distribution per warehouse."""
    _require_itadmin(current_user)
    where, params = _veh_tat_filters(warehouses or [], vehicle_no, start_date, end_date)
    try:
        return _query(f"""
            SELECT
                warehouse_name,
                MIN(loading_time_minutes) as min,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY loading_time_minutes) as q1,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY loading_time_minutes) as median,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY loading_time_minutes) as q3,
                MAX(loading_time_minutes) as max
            FROM {TABLES['vehicle_loading_time_summary']}
            WHERE {where} AND loading_time_minutes IS NOT NULL AND warehouse_name IS NOT NULL
            GROUP BY warehouse_name
            ORDER BY warehouse_name
        """, params)
    except HTTPException:
        raise
    except Exception:
        logger.exception("tat_vehicle_boxplot failed")
        raise HTTPException(status_code=500, detail="Failed to load loading-time distribution")


@router.get("/tat/vehicle/trend")
def tat_vehicle_trend(
    warehouses: Optional[List[str]] = Query(None),
    vehicle_no: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): daily average loading-time trend."""
    _require_itadmin(current_user)
    where, params = _veh_tat_filters(warehouses or [], vehicle_no, start_date, end_date)
    try:
        return _query(f"""
            SELECT
                entry_date,
                AVG(loading_time_minutes) as avg_minutes,
                COUNT(*) as record_count
            FROM {TABLES['vehicle_loading_time_summary']}
            WHERE {where}
            GROUP BY entry_date
            ORDER BY entry_date
        """, params)
    except HTTPException:
        raise
    except Exception:
        logger.exception("tat_vehicle_trend failed")
        raise HTTPException(status_code=500, detail="Failed to load loading-time trend")


@router.get("/tat/vehicle/sla-breach")
def tat_vehicle_sla_breach(
    threshold_minutes: float = Query(120),
    warehouses: Optional[List[str]] = Query(None),
    vehicle_no: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): % of vehicles exceeding a loading-time threshold."""
    _require_itadmin(current_user)
    where, params = _veh_tat_filters(warehouses or [], vehicle_no, start_date, end_date)
    try:
        rows = _query(f"""
            SELECT
                COUNT(*) FILTER (WHERE loading_time_minutes > %s) as breach_count,
                COUNT(*) as total_count
            FROM {TABLES['vehicle_loading_time_summary']}
            WHERE {where}
        """, [threshold_minutes] + params)
        r = rows[0] if rows else {"breach_count": 0, "total_count": 0}
        total = r["total_count"] or 0
        breach = r["breach_count"] or 0
        return {
            "threshold_minutes": threshold_minutes,
            "breach_count": breach,
            "total_count": total,
            "breach_pct": round(breach / total * 100, 1) if total else 0.0,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("tat_vehicle_sla_breach failed")
        raise HTTPException(status_code=500, detail="Failed to load SLA breach stats")


# ── Load Management ──────────────────────────────────────────────────────────
# Ported from Load_management/UI_components/load_management.py — reads
# vehicle_load_summary (only trips with a computed weight/load_percentage,
# i.e. "loaded trips"), always scoped to date >= LOAD_DATA_START_DATE exactly
# as the original hardcoded. Warehouse + date range come from the shared
# global filter bar; vehicle no / single-warehouse drill-down stay local.

def _load_warehouse_filter(warehouses: List[str], alias: str = "") -> tuple:
    if not warehouses:
        return "", []
    col = f"{alias}.warehouse_name" if alias else "warehouse_name"
    placeholders = ", ".join(["%s"] * len(warehouses))
    return f"AND {col} IN ({placeholders})", list(warehouses)


@router.get("/load/filters/warehouses")
def load_warehouses(current_user: UsersMaster = Depends(get_current_user)):
    """1:1 port of get_analytics_warehouse_list / get_warehouse_list — scoped
    to vehicle_load_summary (only warehouses with computed load data), unlike
    the broader Overview warehouse list."""
    _require_itadmin(current_user)
    try:
        rows = _query(f"""
            SELECT DISTINCT warehouse_name
            FROM {TABLES['consolidated']}
            WHERE warehouse_name IS NOT NULL AND date >= %s
            ORDER BY warehouse_name
        """, [LOAD_DATA_START_DATE])
        return [r["warehouse_name"] for r in rows]
    except Exception:
        logger.exception("load_warehouses failed")
        raise HTTPException(status_code=500, detail="Failed to load warehouse list")


@router.get("/load/analytics/stats")
def load_analytics_stats(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_load_summary_stats."""
    _require_itadmin(current_user)
    wf, params = _load_warehouse_filter(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        rows = _query(f"""
            SELECT
                COUNT(*) as total_trips,
                COUNT(DISTINCT vehicle_no) as total_vehicles,
                AVG(load_percentage) as avg_load,
                COUNT(CASE WHEN load_percentage > {LOAD_THRESHOLDS['overloaded']} THEN 1 END) as overloaded_count,
                SUM(total_weight_kg) as total_weight_moved,
                AVG(total_weight_kg) as avg_weight_per_trip,
                COUNT(CASE WHEN movement_type = 'Gate-In' THEN 1 END) as gate_in_count,
                COUNT(CASE WHEN movement_type = 'Gate-Out' THEN 1 END) as gate_out_count,
                COUNT(CASE WHEN total_weight_kg = 0 OR maximum_load_kg = 0 THEN 1 END) as zero_weight_trips,
                MAX(date) as last_updated
            FROM {TABLES['consolidated']}
            WHERE date >= %s {wf} {df}
        """, [LOAD_DATA_START_DATE] + params + dparams)
        return rows[0] if rows else None
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_analytics_stats failed")
        raise HTTPException(status_code=500, detail="Failed to load stats")


@router.get("/load/analytics/document-types")
def load_analytics_document_types(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_load_document_type_stats."""
    _require_itadmin(current_user)
    wf, params = _load_warehouse_filter(warehouses or [], alias="v")
    df, dparams = _date_range_clause(start_date, end_date, column="v.date")
    try:
        return _query(f"""
            SELECT
                i.document_type,
                COUNT(DISTINCT v.gate_entry_no) as trip_count
            FROM {TABLES['consolidated']} v
            JOIN {TABLES['insights']} i ON v.gate_entry_no = i.gate_entry_no
            WHERE v.date >= %s AND i.document_type IS NOT NULL {wf} {df}
            GROUP BY i.document_type
            ORDER BY trip_count DESC
        """, [LOAD_DATA_START_DATE] + params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_analytics_document_types failed")
        raise HTTPException(status_code=500, detail="Failed to load document type stats")


@router.get("/load/analytics/vehicle-ownership")
def load_analytics_vehicle_ownership(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_load_vehicle_ownership."""
    _require_itadmin(current_user)
    wf, params = _load_warehouse_filter(warehouses or [], alias="vls")
    df, dparams = _date_range_clause(start_date, end_date, column="vls.date")
    try:
        return _query(f"""
            SELECT
                CASE
                    WHEN vm.vehicle_classification = 'Company Owned' THEN 'Company Owned'
                    ELSE 'Hired'
                END as ownership_type,
                COUNT(DISTINCT vls.vehicle_no) as vehicle_count
            FROM {TABLES['consolidated']} vls
            LEFT JOIN {TABLES['vehicle_master']} vm
                ON TRIM(UPPER(vls.vehicle_no)) = TRIM(UPPER(vm.registration_no))
            WHERE vls.date >= %s {wf} {df}
            GROUP BY ownership_type
            ORDER BY vehicle_count DESC
        """, [LOAD_DATA_START_DATE] + params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_analytics_vehicle_ownership failed")
        raise HTTPException(status_code=500, detail="Failed to load vehicle ownership stats")


@router.get("/load/analytics/movement-stats")
def load_analytics_movement_stats(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_load_movement_stats."""
    _require_itadmin(current_user)
    wf, params = _load_warehouse_filter(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        return _query(f"""
            SELECT
                movement_type,
                COUNT(*) as trip_count,
                AVG(load_percentage) as avg_load
            FROM {TABLES['consolidated']}
            WHERE date >= %s AND movement_type IS NOT NULL {wf} {df}
            GROUP BY movement_type
            ORDER BY trip_count DESC
        """, [LOAD_DATA_START_DATE] + params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_analytics_movement_stats failed")
        raise HTTPException(status_code=500, detail="Failed to load movement stats")


@router.get("/load/analytics/trend")
def load_analytics_trend(
    granularity: str = Query("daily", pattern="^(daily|monthly)$"),
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_load_daily_trend / get_load_monthly_trend."""
    _require_itadmin(current_user)
    wf, params = _load_warehouse_filter(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        if granularity == "monthly":
            return _query(f"""
                SELECT
                    DATE_TRUNC('month', date) as trip_month,
                    COUNT(*) as trip_count,
                    AVG(load_percentage) as avg_load
                FROM {TABLES['consolidated']}
                WHERE date >= %s {wf} {df}
                GROUP BY DATE_TRUNC('month', date)
                ORDER BY DATE_TRUNC('month', date)
            """, [LOAD_DATA_START_DATE] + params + dparams)
        return _query(f"""
            SELECT
                DATE(date) as trip_date,
                COUNT(*) as trip_count,
                COUNT(CASE WHEN movement_type = 'Gate-In' THEN 1 END) as gate_in,
                COUNT(CASE WHEN movement_type = 'Gate-Out' THEN 1 END) as gate_out,
                AVG(load_percentage) as avg_load
            FROM {TABLES['consolidated']}
            WHERE date >= %s {wf} {df}
            GROUP BY DATE(date)
            ORDER BY DATE(date)
        """, [LOAD_DATA_START_DATE] + params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_analytics_trend failed")
        raise HTTPException(status_code=500, detail="Failed to load trend data")


@router.get("/load/analytics/boxplot")
def load_analytics_boxplot(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): load % distribution per warehouse —
    averages hide overload clusters that a spread shows.

    Restricted to genuinely "loaded" trips (total_weight_kg > 0 AND
    maximum_load_kg > 0) — most warehouses have 60-100% zero-weight trips
    (documents/items the ETL couldn't match to a weight), which otherwise
    pins min/Q1/median/Q3 to 0 and makes the box invisible. Those trips are
    already surfaced separately via the "Zero Weight Trips" KPI."""
    _require_itadmin(current_user)
    wf, params = _load_warehouse_filter(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        return _query(f"""
            SELECT
                warehouse_name,
                MIN(load_percentage) as min,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY load_percentage) as q1,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY load_percentage) as median,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY load_percentage) as q3,
                MAX(load_percentage) as max
            FROM {TABLES['consolidated']}
            WHERE date >= %s AND warehouse_name IS NOT NULL
              AND total_weight_kg > 0 AND maximum_load_kg > 0 {wf} {df}
            GROUP BY warehouse_name
            ORDER BY warehouse_name
        """, [LOAD_DATA_START_DATE] + params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_analytics_boxplot failed")
        raise HTTPException(status_code=500, detail="Failed to load load-% distribution")


@router.get("/load/analytics/scatter")
def load_analytics_scatter(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): weight-vs-capacity per vehicle, to
    flag chronically over/under-loaded vehicles. Capped to the 1000 busiest
    vehicles (by trip count) so the payload/chart stay usable."""
    _require_itadmin(current_user)
    wf, params = _load_warehouse_filter(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        return _query(f"""
            SELECT
                vehicle_no,
                MAX(maximum_load_kg) as capacity_kg,
                AVG(total_weight_kg) as avg_weight_kg,
                COUNT(*) as trip_count,
                COUNT(CASE WHEN load_percentage > {LOAD_THRESHOLDS['overloaded']} THEN 1 END) as overloaded_count
            FROM {TABLES['consolidated']}
            WHERE date >= %s AND maximum_load_kg > 0 {wf} {df}
            GROUP BY vehicle_no
            ORDER BY trip_count DESC
            LIMIT 1000
        """, [LOAD_DATA_START_DATE] + params + dparams)
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_analytics_scatter failed")
        raise HTTPException(status_code=500, detail="Failed to load weight-vs-capacity data")


@router.get("/load/analytics/repeat-offenders")
def load_analytics_repeat_offenders(
    warehouses: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): vehicles most frequently overloaded."""
    _require_itadmin(current_user)
    wf, params = _load_warehouse_filter(warehouses or [])
    df, dparams = _date_range_clause(start_date, end_date)
    try:
        return _query(f"""
            SELECT
                vehicle_no,
                COUNT(*) as total_trips,
                COUNT(CASE WHEN load_percentage > {LOAD_THRESHOLDS['overloaded']} THEN 1 END) as overloaded_count,
                AVG(load_percentage) as avg_load
            FROM {TABLES['consolidated']}
            WHERE date >= %s {wf} {df}
            GROUP BY vehicle_no
            HAVING COUNT(CASE WHEN load_percentage > {LOAD_THRESHOLDS['overloaded']} THEN 1 END) > 0
            ORDER BY overloaded_count DESC
            LIMIT %s
        """, [LOAD_DATA_START_DATE] + params + dparams + [limit])
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_analytics_repeat_offenders failed")
        raise HTTPException(status_code=500, detail="Failed to load repeat-offenders list")


@router.get("/load/warehouse/analytics")
def load_warehouse_analytics(
    warehouse_name: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_warehouse_analytics (Warehouse View drill-down)."""
    _require_itadmin(current_user)
    params = [warehouse_name, LOAD_DATA_START_DATE]
    date_filter, dparams = _date_range_clause(start_date, end_date)
    params.extend(dparams)
    try:
        rows = _query(f"""
            SELECT
                COUNT(*) as total_trips,
                COUNT(DISTINCT vehicle_no) as unique_vehicles,
                AVG(load_percentage) as avg_load_percent,
                SUM(total_weight_kg) as total_weight_moved,
                AVG(total_weight_kg) as avg_weight_per_trip,
                COUNT(CASE WHEN load_percentage > {LOAD_THRESHOLDS['overloaded']} THEN 1 END) as overloaded_trips,
                COUNT(CASE WHEN movement_type = 'Gate-In' THEN 1 END) as inward_count,
                COUNT(CASE WHEN movement_type = 'Gate-Out' THEN 1 END) as outward_count,
                COUNT(CASE WHEN total_weight_kg = 0 OR maximum_load_kg = 0 THEN 1 END) as zero_weight_trips
            FROM {TABLES['consolidated']}
            WHERE warehouse_name = %s AND date >= %s {date_filter}
        """, params)
        return rows[0] if rows else None
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_warehouse_analytics failed")
        raise HTTPException(status_code=500, detail="Failed to load warehouse analytics")


@router.get("/load/warehouse/trend")
def load_warehouse_trend(
    warehouse_name: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_warehouse_daily_trend."""
    _require_itadmin(current_user)
    params = [warehouse_name, LOAD_DATA_START_DATE]
    date_filter, dparams = _date_range_clause(start_date, end_date)
    params.extend(dparams)
    try:
        return _query(f"""
            SELECT
                DATE(date) as trip_date,
                COUNT(*) as trip_count,
                COUNT(CASE WHEN movement_type = 'Gate-In' THEN 1 END) as inward,
                COUNT(CASE WHEN movement_type = 'Gate-Out' THEN 1 END) as outward,
                AVG(load_percentage) as avg_load
            FROM {TABLES['consolidated']}
            WHERE warehouse_name = %s AND date >= %s {date_filter}
            GROUP BY DATE(date)
            ORDER BY DATE(date)
        """, params)
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_warehouse_trend failed")
        raise HTTPException(status_code=500, detail="Failed to load warehouse trend")


@router.get("/load/vehicle/stats")
def load_vehicle_stats(
    vehicle_no: str = Query(...),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_vehicle_stats."""
    _require_itadmin(current_user)
    try:
        rows = _query(f"""
            SELECT
                COUNT(*) as total_trips,
                AVG(load_percentage) as avg_load,
                MAX(load_percentage) as max_load,
                MIN(load_percentage) as min_load,
                AVG(total_weight_kg) as avg_weight,
                MAX(total_weight_kg) as max_weight,
                MAX(maximum_load_kg) as vehicle_capacity,
                COUNT(CASE WHEN load_percentage > {LOAD_THRESHOLDS['overloaded']} THEN 1 END) as overloaded_count
            FROM {TABLES['consolidated']}
            WHERE vehicle_no = %s AND date >= %s
        """, [vehicle_no, LOAD_DATA_START_DATE])
        return rows[0] if rows else None
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_vehicle_stats failed")
        raise HTTPException(status_code=500, detail="Failed to load vehicle stats")


@router.get("/load/trips")
def load_trips(
    page: int = Query(1, ge=1),
    vehicle_no: Optional[str] = Query(None),
    warehouse_name: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_paginated_data (shared trip table for Vehicles View
    and Warehouse View)."""
    _require_itadmin(current_user)
    conditions = ["date >= %s"]
    params: list = [LOAD_DATA_START_DATE]

    if vehicle_no:
        conditions.append("vehicle_no = %s")
        params.append(vehicle_no)
    if warehouse_name:
        conditions.append("warehouse_name = %s")
        params.append(warehouse_name)
    if start_date:
        conditions.append("date >= %s")
        params.append(start_date)
    if end_date:
        conditions.append("date < %s::date + INTERVAL '1 day'")
        params.append(end_date)

    where = " AND ".join(conditions)
    offset = (page - 1) * RECORDS_PER_PAGE
    try:
        rows = _query(f"""
            SELECT
                id, vehicle_no, gate_entry_no, date, time,
                warehouse_name, total_weight_kg, maximum_load_kg,
                load_percentage, movement_type,
                COUNT(*) OVER() as total_count
            FROM {TABLES['consolidated']}
            WHERE {where}
            ORDER BY date DESC, time DESC
            LIMIT %s OFFSET %s
        """, params + [RECORDS_PER_PAGE, offset])
        total_count = rows[0]["total_count"] if rows else 0
        for r in rows:
            r.pop("total_count", None)
        return {"data": rows, "total_count": total_count}
    except HTTPException:
        raise
    except Exception:
        logger.exception("load_trips failed")
        raise HTTPException(status_code=500, detail="Failed to load trips")


# ── Loader Details ───────────────────────────────────────────────────────────
# Ported from Load_management/UI_components/loader_details.py — reads
# loader_details_summary. Site is local to this tab (mutually exclusive with
# the shared global warehouse filter, exactly as the original app enforced);
# movement type, vehicle type, gate entry no, document type stay local too.
# Date range comes from the shared global filter bar.

def _loader_filters(
    sites: List[str],
    warehouses: List[str],
    movement_type: Optional[str],
    vehicle_type: Optional[str],
    document_types: List[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> tuple:
    conditions = []
    params: list = []

    if start_date:
        conditions.append("entry_date >= %s")
        params.append(start_date)
    if end_date:
        conditions.append("entry_date <= %s")
        params.append(end_date)

    if sites:
        placeholders = ", ".join(["%s"] * len(sites))
        conditions.append(f"site_code IN ({placeholders})")
        params.extend(sites)

    if warehouses:
        placeholders = ", ".join(["%s"] * len(warehouses))
        conditions.append(f"warehouse_name IN ({placeholders})")
        params.extend(warehouses)

    if movement_type:
        conditions.append("movement_type = %s")
        params.append(movement_type)

    if vehicle_type:
        conditions.append("vehicle_type = %s")
        params.append(vehicle_type)

    if document_types:
        doc_conditions = " OR ".join(["document_types ILIKE %s" for _ in document_types])
        conditions.append(f"({doc_conditions})")
        params.extend([f"%{dt}%" for dt in document_types])

    return (" AND ".join(conditions) if conditions else "1=1"), params


@router.get("/loader/filters/sites")
def loader_sites(current_user: UsersMaster = Depends(get_current_user)):
    _require_itadmin(current_user)
    try:
        rows = _query(f"""
            SELECT DISTINCT site_code FROM {TABLES['loader_details_summary']}
            WHERE site_code IS NOT NULL ORDER BY site_code
        """, [])
        return [r["site_code"] for r in rows]
    except Exception:
        logger.exception("loader_sites failed")
        raise HTTPException(status_code=500, detail="Failed to load site list")


@router.get("/loader/filters/document-types")
def loader_document_types(current_user: UsersMaster = Depends(get_current_user)):
    _require_itadmin(current_user)
    try:
        rows = _query(f"""
            SELECT DISTINCT UNNEST(STRING_TO_ARRAY(document_types, ', ')) as doc_type
            FROM {TABLES['loader_details_summary']}
            WHERE document_types IS NOT NULL
            ORDER BY doc_type
        """, [])
        return [r["doc_type"] for r in rows]
    except Exception:
        logger.exception("loader_document_types failed")
        raise HTTPException(status_code=500, detail="Failed to load document type list")


@router.get("/loader/date-range")
def loader_date_range(current_user: UsersMaster = Depends(get_current_user)):
    _require_itadmin(current_user)
    try:
        rows = _query(f"""
            SELECT MIN(entry_date) as min_date, MAX(entry_date) as max_date
            FROM {TABLES['loader_details_summary']}
        """, [])
        return rows[0] if rows else {"min_date": None, "max_date": None}
    except Exception:
        logger.exception("loader_date_range failed")
        raise HTTPException(status_code=500, detail="Failed to load date range")


@router.get("/loader/stats")
def loader_stats(
    sites: Optional[List[str]] = Query(None),
    warehouses: Optional[List[str]] = Query(None),
    movement_type: Optional[str] = Query(None),
    vehicle_type: Optional[str] = Query(None),
    document_types: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_summary_stats."""
    _require_itadmin(current_user)
    where, params = _loader_filters(
        sites or [], warehouses or [], movement_type, vehicle_type, document_types or [], start_date, end_date
    )
    try:
        rows = _query(f"""
            SELECT
                COUNT(*) as total_entries,
                COUNT(DISTINCT vehicle_no) as unique_vehicles,
                SUM(loader_count) as total_loaders,
                AVG(loader_count) as avg_loaders_per_entry,
                COUNT(CASE WHEN vehicle_type = 'Company Owned' THEN 1 END) as company_owned_count,
                COUNT(CASE WHEN vehicle_type = 'Hired' THEN 1 END) as hired_count
            FROM {TABLES['loader_details_summary']}
            WHERE {where}
        """, params)
        return rows[0] if rows else None
    except HTTPException:
        raise
    except Exception:
        logger.exception("loader_stats failed")
        raise HTTPException(status_code=500, detail="Failed to load stats")


@router.get("/loader/details")
def loader_details(
    page: int = Query(1, ge=1),
    sites: Optional[List[str]] = Query(None),
    warehouses: Optional[List[str]] = Query(None),
    movement_type: Optional[str] = Query(None),
    vehicle_type: Optional[str] = Query(None),
    gate_entry_no: Optional[str] = Query(None),
    document_types: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """1:1 port of get_loader_details — paginated."""
    _require_itadmin(current_user)
    where, params = _loader_filters(
        sites or [], warehouses or [], movement_type, vehicle_type, document_types or [], start_date, end_date
    )
    if gate_entry_no:
        where += " AND UPPER(gate_entry_no) = UPPER(%s)"
        params.append(gate_entry_no.strip())

    offset = (page - 1) * RECORDS_PER_PAGE
    try:
        rows = _query(f"""
            SELECT
                gate_entry_no, gate_entry_datetime, vehicle_no, vehicle_type,
                security_name, driver_name, loader_names, loader_count,
                document_types, movement_type, warehouse_name, site_code,
                COUNT(*) OVER() as total_count
            FROM {TABLES['loader_details_summary']}
            WHERE {where}
            ORDER BY gate_entry_datetime DESC
            LIMIT %s OFFSET %s
        """, params + [RECORDS_PER_PAGE, offset])
        total_count = rows[0]["total_count"] if rows else 0
        for r in rows:
            r.pop("total_count", None)
        return {"data": rows, "total_count": total_count}
    except HTTPException:
        raise
    except Exception:
        logger.exception("loader_details failed")
        raise HTTPException(status_code=500, detail="Failed to load loader details")


@router.get("/loader/loaders-per-warehouse")
def loader_loaders_per_warehouse(
    sites: Optional[List[str]] = Query(None),
    warehouses: Optional[List[str]] = Query(None),
    movement_type: Optional[str] = Query(None),
    vehicle_type: Optional[str] = Query(None),
    document_types: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): staffing efficiency comparison —
    average loaders assigned per gate entry, by warehouse."""
    _require_itadmin(current_user)
    where, params = _loader_filters(
        sites or [], warehouses or [], movement_type, vehicle_type, document_types or [], start_date, end_date
    )
    try:
        return _query(f"""
            SELECT
                warehouse_name,
                AVG(loader_count) as avg_loaders,
                COUNT(*) as entry_count
            FROM {TABLES['loader_details_summary']}
            WHERE {where} AND warehouse_name IS NOT NULL
            GROUP BY warehouse_name
            ORDER BY avg_loaders DESC
        """, params)
    except HTTPException:
        raise
    except Exception:
        logger.exception("loader_loaders_per_warehouse failed")
        raise HTTPException(status_code=500, detail="Failed to load loaders-per-warehouse stats")


@router.get("/loader/ownership-trend")
def loader_ownership_trend(
    sites: Optional[List[str]] = Query(None),
    warehouses: Optional[List[str]] = Query(None),
    movement_type: Optional[str] = Query(None),
    vehicle_type: Optional[str] = Query(None),
    document_types: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: UsersMaster = Depends(get_current_user),
):
    """New (approved during planning): Company-Owned vs Hired mix over time."""
    _require_itadmin(current_user)
    where, params = _loader_filters(
        sites or [], warehouses or [], movement_type, vehicle_type, document_types or [], start_date, end_date
    )
    try:
        return _query(f"""
            SELECT
                entry_date,
                COUNT(CASE WHEN vehicle_type = 'Company Owned' THEN 1 END) as company_owned_count,
                COUNT(CASE WHEN vehicle_type = 'Hired' THEN 1 END) as hired_count
            FROM {TABLES['loader_details_summary']}
            WHERE {where}
            GROUP BY entry_date
            ORDER BY entry_date
        """, params)
    except HTTPException:
        raise
    except Exception:
        logger.exception("loader_ownership_trend failed")
        raise HTTPException(status_code=500, detail="Failed to load ownership trend")
