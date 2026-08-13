# app/routers/gate_pass.py — Returnable / Non-Returnable Gate Pass module.
#
# State machine (server-enforced, atomic via row locks):
#   NR: Open → Released → Dispatched (terminal)
#   R:  Open → Released → Dispatched → [Partially Received →] Inward Received
#   Cancel: from Open or Released only (mandatory reason). Never after Dispatch.
#   Force close: admin only, from Dispatched/Partially Received, reason mandatory.
#   NO EDIT of any pass, ever — cancel and recreate is the only correction path.
#
# ROLE SWAP NOTE (temporary): the "initiator" role is stood in by IT Admin until
# the dedicated Gate Pass User role is added. All role gates are centralised in
# _require_initiator / _require_guard below — swapping the real role later is a
# one-line change in each.
import json
import logging
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.utils.roles import normalize_roles
from app.database import get_db
from app.models import UsersMaster
from app.models.gate_pass import (
    UserGatePassLocation,
    GatePassLocation, GatePassParty, GatePassItem, GatePassCancelReason,
    GatePassDepartment,
    GatePassSequence, GatePassHeader, GatePassLine, GatePassEvent,
    GP_OPEN, GP_RELEASED, GP_DISPATCHED, GP_PARTIAL, GP_RECEIVED,
    GP_CANCELLED, GP_CLOSED, PASS_TYPE_RETURNABLE, PASS_TYPE_NON_RETURNABLE,
)
from app.schemas.gate_pass_schemas import (
    GatePassLocationResponse, PartyResponse, ItemResponse, CancelReasonResponse,
    GatePassCreate, GatePassCancelRequest, GatePassDispatchRequest,
    GatePassInwardRequest, GatePassForceCloseRequest,
    GatePassListItem, GatePassDetailResponse, GatePassListResponse,
    GatePassLineResponse, GatePassEventResponse,
    DueNotificationItem, DueNotificationsResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gate-pass", tags=["Gate Pass"])


# ── Role helpers (centralised — see ROLE SWAP NOTE above) ────────────────────
def _roles(user: UsersMaster):
    return normalize_roles(user.role)


# Role model redesign (LOCKED 14 Jul 2026 — CONTEXT_SUMMARY §11):
# gatepasscreator (GPC) originates passes; gatepassdispatcher (GPD, guards
# only) confirms movements at the gate. ITA alone has NO gate pass access —
# an admin who needs to create passes holds ITA+GPC and is scoped exactly
# like any other creator. Nobody sees all locations (SUPERADMIN parked).
INITIATOR_ROLES = ("gatepasscreator",)


def _require_initiator(current_user: UsersMaster = Depends(get_current_user)) -> UsersMaster:
    """Who may create/release/cancel passes and see the initiator views:
    Gate Pass Creators only (including ITA+GPC combos — same scoping)."""
    if not any(r in INITIATOR_ROLES for r in _roles(current_user)):
        raise HTTPException(status_code=403, detail="You do not have access to create gate passes")
    return current_user


def _require_guard(current_user: UsersMaster = Depends(get_current_user)) -> UsersMaster:
    """Who may dispatch and mark inward: Gate Pass Dispatchers (SG+GPD)."""
    if "gatepassdispatcher" not in _roles(current_user):
        raise HTTPException(
            status_code=403,
            detail="NO_GPD_ROLE: gate pass processing requires the Gate Pass Dispatcher role",
        )
    return current_user


def _is_itadmin(user: UsersMaster) -> bool:
    return "itadmin" in _roles(user)


def _user_gp_locations(db: Session, user: UsersMaster) -> list:
    """All gate pass locations assigned to a user. Junction table
    (user_gate_pass_locations) is the source of truth; falls back to the
    legacy users_master.gate_pass_location column when no junction rows."""
    rows = (
        db.query(UserGatePassLocation.location_code)
        .filter(UserGatePassLocation.username == user.username)
        .all()
    )
    if rows:
        return [r.location_code for r in rows]
    return [user.gate_pass_location] if user.gate_pass_location else []


def _check_pass_view_access(db: Session, gp, user: UsersMaster):
    """Who may open (and print) one specific pass — mirrors list scoping.
    Creator: own location(s) + department. Dispatcher: own location(s),
    from Released onward. Nobody sees everything (SUPERADMIN parked)."""
    roles = _roles(user)
    if "gatepasscreator" in roles:
        gpu_locations = _user_gp_locations(db, user)
        if gpu_locations and gp.location_code not in gpu_locations:
            raise HTTPException(status_code=403, detail="This pass belongs to another location")
        if user.department and gp.department != user.department:
            raise HTTPException(status_code=403, detail="This pass belongs to another department")
        return
    if "gatepassdispatcher" in roles:
        if gp.status == GP_OPEN:
            raise HTTPException(status_code=403, detail="No access to this gate pass")
        guard_locations = _user_gp_locations(db, user)
        if not guard_locations:
            raise HTTPException(status_code=403, detail="NO_GP_LOCATION")
        if gp.location_code not in guard_locations:
            raise HTTPException(status_code=403, detail="This pass belongs to another location's gate")
        return
    raise HTTPException(status_code=403, detail="No access to this gate pass")


def _guard_location_filter(db: Session, query, user: UsersMaster):
    """Guards see only passes for their assigned gate_pass_location.
    IT Admin bypasses the filter entirely.
    Raises 403 (sentinel: NO_GP_LOCATION) if the guard profile has no
    gate_pass_location — admin must assign one before the guard can operate."""
    locations = _user_gp_locations(db, user)
    if not locations:
        raise HTTPException(
            status_code=403,
            detail="NO_GP_LOCATION",
        )
    return query.filter(GatePassHeader.location_code.in_(locations))


# ── Numbering (atomic, incremental, never reused) ───────────────────────────
def _next_pass_number(db: Session, location_code: str, pass_type: str) -> str:
    """Increment the (location, type) series under a row lock. The number is
    consumed at creation and never recycled — cancelled passes keep theirs."""
    seq = (
        db.query(GatePassSequence)
        .filter(
            GatePassSequence.location_code == location_code,
            GatePassSequence.pass_type == pass_type,
        )
        .with_for_update()
        .first()
    )
    if seq is None:
        seq = GatePassSequence(location_code=location_code, pass_type=pass_type, last_number=0)
        db.add(seq)
        db.flush()
        seq = (
            db.query(GatePassSequence)
            .filter(GatePassSequence.id == seq.id)
            .with_for_update()
            .first()
        )
    seq.last_number += 1
    return f"{pass_type}{location_code}{seq.last_number}"


def _locked_pass(db: Session, pass_id: int) -> GatePassHeader:
    """Fetch a pass under a row lock so concurrent transitions serialise
    (e.g. Cancel racing Dispatch — first write wins, second gets 409)."""
    gp = (
        db.query(GatePassHeader)
        .filter(GatePassHeader.id == pass_id)
        .with_for_update()
        .first()
    )
    if gp is None:
        raise HTTPException(status_code=404, detail="Gate pass not found")
    return gp


def _log_event(db, gp, event_type, user, remarks=None, details=None):
    db.add(GatePassEvent(
        gate_pass_id=gp.id,
        event_type=event_type,
        event_by=user.username,
        remarks=remarks,
        details_json=json.dumps(details) if details else None,
    ))


def _to_list_item(gp: GatePassHeader, today: date) -> GatePassListItem:
    return GatePassListItem(
        id=gp.id,
        gate_pass_no=gp.gate_pass_no,
        pass_type=gp.pass_type,
        status=gp.status,
        location_code=gp.location_code,
        document_date=gp.document_date,
        document_time=gp.document_time,
        party_code=gp.party_code,
        party_name=gp.party_name,
        department=gp.department,
        mode_of_transport=gp.mode_of_transport,
        vehicle_no=gp.vehicle_no,
        expected_inward_date=gp.expected_inward_date,
        created_by=gp.created_by,
        created_at=gp.created_at,
        released_at=gp.released_at,
        dispatched_at=gp.dispatched_at,
        line_count=len(gp.lines),
        total_quantity=sum(l.quantity or 0 for l in gp.lines),
        outstanding_quantity=gp.total_outstanding(),
        is_overdue=gp.is_overdue(today),
        cancel_reason_text=gp.cancel_reason.reason_text if gp.cancel_reason else None,
        replacement_pass_no=gp.replacement_pass_no,
    )


# ═════════════════════════════ Lookups ═══════════════════════════════════════
@router.get("/locations", response_model=list[GatePassLocationResponse])
def list_locations(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    return (
        db.query(GatePassLocation)
        .filter(GatePassLocation.is_active.is_(True))
        .order_by(GatePassLocation.location_code)
        .all()
    )


@router.get("/my-locations")
def my_gate_pass_locations(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    """The caller's assigned gate pass locations with the starred default
    first. Junction table first; legacy single-column fallback (marked as
    default). IT Admins with no assignment get all active locations."""
    rows = (
        db.query(UserGatePassLocation)
        .filter(UserGatePassLocation.username == current_user.username)
        .order_by(UserGatePassLocation.is_default.desc(), UserGatePassLocation.location_code)
        .all()
    )
    if rows:
        return {"locations": [
            {"location_code": r.location_code, "is_default": r.is_default} for r in rows
        ]}
    if current_user.gate_pass_location:
        return {"locations": [
            {"location_code": current_user.gate_pass_location, "is_default": True}
        ]}
    return {"locations": []}


@router.get("/departments")
def list_departments(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    # Sourced from gate_pass_departments (replaces the old hardcoded list,
    # 3 Aug 2026). Response shape unchanged (plain list of names) so the
    # existing frontend dropdown keeps working with no changes on that side.
    rows = (
        db.query(GatePassDepartment)
        .filter(GatePassDepartment.is_active.is_(True))
        .order_by(GatePassDepartment.sort_order, GatePassDepartment.department_name)
        .all()
    )
    return {"departments": [r.department_name for r in rows]}


@router.get("/cancel-reasons", response_model=list[CancelReasonResponse])
def list_cancel_reasons(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    return (
        db.query(GatePassCancelReason)
        .filter(GatePassCancelReason.is_active.is_(True))
        .order_by(GatePassCancelReason.sort_order)
        .all()
    )


@router.get("/parties", response_model=list[PartyResponse])
def search_parties(
    q: str = Query("", max_length=100),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_initiator),
):
    """Bidirectional lookup: matches code OR name (Fabric-fed master later)."""
    query = db.query(GatePassParty).filter(GatePassParty.is_active.is_(True))
    if q:
        like = f"%{q}%"
        query = query.filter(
            (GatePassParty.party_code.ilike(like)) | (GatePassParty.party_name.ilike(like))
        )
    return query.order_by(GatePassParty.party_name).limit(20).all()


@router.get("/items", response_model=list[ItemResponse])
def search_items(
    q: str = Query("", max_length=100),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_initiator),
):
    query = db.query(GatePassItem).filter(GatePassItem.is_active.is_(True))
    if q:
        like = f"%{q}%"
        query = query.filter(
            (GatePassItem.item_code.ilike(like)) | (GatePassItem.item_name.ilike(like))
        )
    return query.order_by(GatePassItem.item_code).limit(20).all()


# ═════════════════════════════ Create ════════════════════════════════════════
@router.post("", status_code=201)
def create_gate_pass(
    payload: GatePassCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_initiator),
):
    # Location must exist and be active (server never trusts the dropdown)
    loc = (
        db.query(GatePassLocation)
        .filter(
            GatePassLocation.location_code == payload.location_code,
            GatePassLocation.is_active.is_(True),
        )
        .first()
    )
    if loc is None:
        raise HTTPException(status_code=400, detail="Invalid location")

    # Department must exist and be active in the master (server never trusts
    # the dropdown) — same pattern as the location check above.
    dept = (
        db.query(GatePassDepartment)
        .filter(
            GatePassDepartment.department_name == payload.department,
            GatePassDepartment.is_active.is_(True),
        )
        .first()
    )
    if dept is None:
        raise HTTPException(status_code=400, detail="Invalid department")

    # Passes are ALWAYS filed under the creator's own fixed department and
    # at one of their assigned locations — profile is the source of truth,
    # not the payload. Applies to EVERY creator, ITA+GPC included (no bypass).
    if not current_user.department:
        raise HTTPException(
            status_code=400,
            detail="Your profile has no department assigned — ask an IT Admin to set it in Assign Access",
        )
    if payload.department != current_user.department:
        raise HTTPException(
            status_code=400,
            detail=f"Department must be your own ({current_user.department})",
        )
    allowed_locations = _user_gp_locations(db, current_user)
    if not allowed_locations:
        raise HTTPException(status_code=403, detail="NO_GP_LOCATION")
    if payload.location_code not in allowed_locations:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to this gate pass location",
        )

    # Party must exist in the master; name is filled server-side from the code
    party = (
        db.query(GatePassParty)
        .filter(GatePassParty.party_code == payload.party_code, GatePassParty.is_active.is_(True))
        .first()
    )
    if party is None:
        raise HTTPException(status_code=400, detail="Invalid party code")

    # Expected inward date: required for R, forbidden for NR
    if payload.pass_type == PASS_TYPE_RETURNABLE:
        if payload.expected_inward_date is None:
            raise HTTPException(status_code=400, detail="Expected inward date is required for a returnable pass")
        if payload.expected_inward_date < date.today():
            raise HTTPException(status_code=400, detail="Expected inward date cannot be in the past")
    elif payload.expected_inward_date is not None:
        raise HTTPException(status_code=400, detail="Expected inward date is not applicable for a non-returnable pass")

    if payload.mode_of_transport == "Vehicle" and not (payload.vehicle_no or "").strip():
        raise HTTPException(status_code=400, detail="Vehicle number is required when mode of transport is Vehicle")

    try:
        now = datetime.now()
        gate_pass_no = _next_pass_number(db, payload.location_code, payload.pass_type)

        gp = GatePassHeader(
            gate_pass_no=gate_pass_no,
            pass_type=payload.pass_type,
            status=GP_OPEN,
            location_code=payload.location_code,
            warehouse_code=loc.warehouse_code,
            document_date=now.date(),
            document_time=now.strftime("%H:%M:%S"),
            party_code=party.party_code,
            party_name=party.party_name,
            department=payload.department,
            mode_of_transport=payload.mode_of_transport,
            vehicle_no=(payload.vehicle_no or "").strip().upper() or None,
            sender_name=payload.sender_name,
            approver_name=payload.approver_name,
            expected_inward_date=payload.expected_inward_date,
            remarks=payload.remarks,
            created_by=current_user.username,
        )
        db.add(gp)
        db.flush()

        for idx, line in enumerate(payload.lines, start=1):
            # Fixed Asset lines come from the asset master (pipeline-fed):
            # code must exist + be active; description is the master's name
            # (read-only on the form); FA class is snapshotted at creation.
            # Item lines are free text: no code, description as typed.
            fa_class = None
            description = line.description.strip()
            if line.item_type == "Fixed Asset":
                if not line.item_code:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Line {idx}: Fixed Asset lines must reference an Asset No. from the master",
                    )
                master = (
                    db.query(GatePassItem)
                    .filter(GatePassItem.item_code == line.item_code,
                            GatePassItem.is_active.is_(True))
                    .first()
                )
                if master is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Line {idx}: unknown or inactive Asset No. '{line.item_code}'",
                    )
                fa_class = master.fa_class_code
                # Description pre-fills from the master on the form but stays
                # editable (decision 14 Jul 2026) - keep the user's text,
                # fall back to the master name only if somehow blank.
                if not description:
                    description = master.item_name
            elif line.item_code:
                raise HTTPException(
                    status_code=400,
                    detail=f"Line {idx}: only Fixed Asset lines may carry an item code — Item lines are free text",
                )
            db.add(GatePassLine(
                gate_pass_id=gp.id,
                line_no=idx,
                item_code=line.item_code,
                item_type=line.item_type,
                fa_class_code=fa_class,
                description=description,
                serial_no=line.serial_no,
                uom=line.uom,
                quantity=line.quantity,
                amount=line.amount,
                chargeable=line.chargeable,
            ))

        _log_event(db, gp, "CREATE", current_user)
        db.commit()
        db.refresh(gp)
        return {"message": "Gate pass created", "gate_pass_no": gp.gate_pass_no, "id": gp.id, "status": gp.status}
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("create_gate_pass failed")
        raise HTTPException(status_code=500, detail="Failed to create gate pass. See server logs.")


# ═════════════════════════════ Lists ═════════════════════════════════════════
@router.get("", response_model=GatePassListResponse)
def list_gate_passes(
    status_filter: str | None = Query(None, alias="status"),
    pass_type: str | None = Query(None),
    location_code: str | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    q: str | None = Query(None, max_length=100),
    overdue_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_initiator),
):
    """Initiator list. Own cancelled passes are always visible — no status is
    ever hidden from the department that owns the pass."""
    query = db.query(GatePassHeader).options(
        joinedload(GatePassHeader.lines), joinedload(GatePassHeader.cancel_reason)
    )
    # Scoping (LOCKED 14 Jul 2026): EVERY creator — ITA+GPC included — sees
    # only passes at their assigned location(s) and own department. Nobody
    # sees all locations (SUPERADMIN parked, not built).
    gpu_locations = _user_gp_locations(db, current_user)
    if not gpu_locations:
        raise HTTPException(status_code=403, detail="NO_GP_LOCATION")
    query = query.filter(GatePassHeader.location_code.in_(gpu_locations))
    if current_user.department:
        query = query.filter(GatePassHeader.department == current_user.department)
    if status_filter:
        query = query.filter(GatePassHeader.status == status_filter)
    if pass_type:
        query = query.filter(GatePassHeader.pass_type == pass_type)
    if location_code:
        query = query.filter(GatePassHeader.location_code == location_code)
    if from_date:
        query = query.filter(GatePassHeader.document_date >= from_date)
    if to_date:
        query = query.filter(GatePassHeader.document_date <= to_date)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (GatePassHeader.gate_pass_no.ilike(like))
            | (GatePassHeader.party_name.ilike(like))
            | (GatePassHeader.vehicle_no.ilike(like))
        )

    today = date.today()
    if overdue_only:
        query = query.filter(
            GatePassHeader.pass_type == PASS_TYPE_RETURNABLE,
            GatePassHeader.status.in_([GP_DISPATCHED, GP_PARTIAL]),
            GatePassHeader.expected_inward_date <= today,
        )

    total = query.count()
    rows = (
        query.order_by(GatePassHeader.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    return GatePassListResponse(total_count=total, items=[_to_list_item(r, today) for r in rows])


@router.get("/guard/pending", response_model=GatePassListResponse)
def guard_pending(
    view: str = Query("dispatch"),   # 'dispatch' | 'inward' | 'cancelled'
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_guard),
):
    """The guard's worklist — a live status query, never a copied list.
    'dispatch'  : Released passes at the guard's location.
    'inward'    : Dispatched / Partially Received RETURNABLE passes.
    'cancelled' : passes cancelled AFTER release and before dispatch — the
                  only cancelled passes a guard ever sees (answers 'where did
                  that pass on my list go?')."""
    query = db.query(GatePassHeader).options(
        joinedload(GatePassHeader.lines), joinedload(GatePassHeader.cancel_reason)
    )
    if view == "dispatch":
        query = query.filter(GatePassHeader.status == GP_RELEASED)
    elif view == "inward":
        query = query.filter(
            GatePassHeader.pass_type == PASS_TYPE_RETURNABLE,
            GatePassHeader.status.in_([GP_DISPATCHED, GP_PARTIAL]),
        )
    elif view == "cancelled":
        query = query.filter(
            GatePassHeader.status == GP_CANCELLED,
            GatePassHeader.released_at.isnot(None),      # was on the guard's list
            GatePassHeader.dispatched_at.is_(None),
        )
    else:
        raise HTTPException(status_code=400, detail="view must be 'dispatch', 'inward' or 'cancelled'")

    query = _guard_location_filter(db, query, current_user)
    today = date.today()
    rows = query.order_by(GatePassHeader.released_at.asc()).limit(200).all()
    return GatePassListResponse(total_count=len(rows), items=[_to_list_item(r, today) for r in rows])


@router.get("/notifications/due", response_model=DueNotificationsResponse)
def due_notifications(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    """In-app alert feed: returnable passes expected back today or earlier
    with quantities still outstanding. Guards get their location's set;
    initiators get theirs (all, until department scoping lands)."""
    roles = _roles(current_user)
    if "gatepassdispatcher" not in roles and "gatepasscreator" not in roles:
        raise HTTPException(status_code=403, detail="No access to gate pass notifications")

    today = date.today()
    query = (
        db.query(GatePassHeader)
        .options(joinedload(GatePassHeader.lines))
        .filter(
            GatePassHeader.pass_type == PASS_TYPE_RETURNABLE,
            GatePassHeader.status.in_([GP_DISPATCHED, GP_PARTIAL]),
            GatePassHeader.expected_inward_date <= today,
        )
    )
    # Dispatchers: their gate location(s). Creators: their locations + dept.
    query = _guard_location_filter(db, query, current_user)
    if "gatepasscreator" in roles and current_user.department:
        query = query.filter(GatePassHeader.department == current_user.department)

    items = []
    for gp in query.order_by(GatePassHeader.expected_inward_date.asc()).limit(100).all():
        outstanding = gp.total_outstanding()
        if outstanding <= 0:
            continue
        items.append(DueNotificationItem(
            gate_pass_no=gp.gate_pass_no,
            party_name=gp.party_name,
            department=gp.department,
            expected_inward_date=gp.expected_inward_date,
            days_overdue=(today - gp.expected_inward_date).days,
            outstanding_quantity=outstanding,
            status=gp.status,
        ))
    return DueNotificationsResponse(count=len(items), items=items)


@router.get("/{pass_id}", response_model=GatePassDetailResponse)
def get_gate_pass(
    pass_id: int,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    gp = (
        db.query(GatePassHeader)
        .options(
            joinedload(GatePassHeader.lines),
            joinedload(GatePassHeader.events),
            joinedload(GatePassHeader.cancel_reason),
        )
        .filter(GatePassHeader.id == pass_id)
        .first()
    )
    if gp is None:
        raise HTTPException(status_code=404, detail="Gate pass not found")

    _check_pass_view_access(db, gp, current_user)

    today = date.today()
    base = _to_list_item(gp, today)
    return GatePassDetailResponse(
        **base.model_dump(),
        sender_name=gp.sender_name,
        approver_name=gp.approver_name,
        remarks=gp.remarks,
        dispatch_remarks=gp.dispatch_remarks,
        cancel_remarks=gp.cancel_remarks,
        close_reason=gp.close_reason,
        released_by=gp.released_by,
        dispatched_by=gp.dispatched_by,
        cancelled_by=gp.cancelled_by,
        cancelled_at=gp.cancelled_at,
        closed_by=gp.closed_by,
        closed_at=gp.closed_at,
        lines=[GatePassLineResponse.model_validate(l) for l in gp.lines],
        events=[GatePassEventResponse.model_validate(e) for e in gp.events],
    )


# ═════════════════════════════ Transitions ═══════════════════════════════════
@router.post("/{pass_id}/release")
def release_gate_pass(
    pass_id: int,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_initiator),
):
    """Open → Released. Irreversible except by Cancel: after this the pass is
    on the guard's list and can never be modified."""
    try:
        gp = _locked_pass(db, pass_id)
        if gp.status != GP_OPEN:
            raise HTTPException(status_code=409, detail=f"Pass is {gp.status} — only an Open pass can be released")
        gp.status = GP_RELEASED
        gp.released_by = current_user.username
        gp.released_at = datetime.now()
        _log_event(db, gp, "RELEASE", current_user)
        db.commit()
        return {"message": "Gate pass released", "gate_pass_no": gp.gate_pass_no, "status": gp.status}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("release_gate_pass failed")
        raise HTTPException(status_code=500, detail="Failed to release gate pass. See server logs.")


@router.post("/{pass_id}/cancel")
def cancel_gate_pass(
    pass_id: int,
    payload: GatePassCancelRequest,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_initiator),
):
    """Cancel from Open or Released only, with a mandatory reason from the
    master. Never after Dispatch — material has physically left. The number
    is spent: it stays with this record forever."""
    reason = (
        db.query(GatePassCancelReason)
        .filter(GatePassCancelReason.id == payload.cancel_reason_id, GatePassCancelReason.is_active.is_(True))
        .first()
    )
    if reason is None:
        raise HTTPException(status_code=400, detail="Invalid cancel reason")

    try:
        gp = _locked_pass(db, pass_id)
        if gp.status not in (GP_OPEN, GP_RELEASED):
            raise HTTPException(
                status_code=409,
                detail=f"Pass is {gp.status} — a pass can be cancelled only while Open or Released",
            )
        gp.status = GP_CANCELLED
        gp.cancelled_by = current_user.username
        gp.cancelled_at = datetime.now()
        gp.cancel_reason_id = reason.id
        gp.cancel_remarks = payload.cancel_remarks
        _log_event(db, gp, "CANCEL", current_user, remarks=payload.cancel_remarks,
                   details={"reason": reason.reason_text})
        db.commit()
        return {"message": "Gate pass cancelled", "gate_pass_no": gp.gate_pass_no, "status": gp.status}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("cancel_gate_pass failed")
        raise HTTPException(status_code=500, detail="Failed to cancel gate pass. See server logs.")


@router.post("/{pass_id}/dispatch")
def dispatch_gate_pass(
    pass_id: int,
    payload: GatePassDispatchRequest,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_guard),
):
    """Released → Dispatched, by the guard at the pass's location. Security
    remarks are recorded on the event AND denormalised to the header for easy
    display. For NR passes, Dispatched is terminal."""
    try:
        gp = _locked_pass(db, pass_id)
        if gp.status != GP_RELEASED:
            raise HTTPException(status_code=409, detail=f"Pass is {gp.status} — only a Released pass can be dispatched")
        # Location check applies to EVERY dispatcher (no admin bypass)
        guard_locations = _user_gp_locations(db, current_user)
        if not guard_locations:
            raise HTTPException(status_code=403, detail="NO_GP_LOCATION")
        if gp.location_code not in guard_locations:
            raise HTTPException(status_code=403, detail="This pass belongs to another location's gate")

        # Segregation of duties (agreed RBAC rule): you cannot dispatch a
        # pass you yourself created or released (SG+GPU combo users).
        if current_user.username in (gp.created_by, gp.released_by):
            raise HTTPException(
                status_code=403,
                detail="SOD_VIOLATION: you cannot dispatch a pass you created or released",
            )

        gp.status = GP_DISPATCHED
        gp.dispatched_by = current_user.username
        gp.dispatched_at = datetime.now()
        gp.dispatch_remarks = payload.security_remarks
        if gp.pass_type == PASS_TYPE_NON_RETURNABLE:
            gp.completed_at = gp.dispatched_at   # NR: terminal at dispatch
        _log_event(db, gp, "DISPATCH", current_user, remarks=payload.security_remarks)
        db.commit()
        return {"message": "Gate pass dispatched", "gate_pass_no": gp.gate_pass_no, "status": gp.status}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("dispatch_gate_pass failed")
        raise HTTPException(status_code=500, detail="Failed to dispatch gate pass. See server logs.")


@router.post("/{pass_id}/inward")
def inward_gate_pass(
    pass_id: int,
    payload: GatePassInwardRequest,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(_require_guard),
):
    """Line-level partial receipt (append-only transaction). received_qty
    accumulates per line; the pass becomes Partially Received until every
    line is fully back, then Inward Received (terminal). Original quantities
    are never touched. Returns can arrive after the expected date — the date
    never closes anything."""
    try:
        gp = _locked_pass(db, pass_id)
        if gp.pass_type != PASS_TYPE_RETURNABLE:
            raise HTTPException(status_code=409, detail="Non-returnable passes have no inward leg")
        if gp.status not in (GP_DISPATCHED, GP_PARTIAL):
            raise HTTPException(status_code=409, detail=f"Pass is {gp.status} — inward applies to Dispatched or Partially Received passes")
        guard_locations = _user_gp_locations(db, current_user)
        if not guard_locations:
            raise HTTPException(status_code=403, detail="NO_GP_LOCATION")
        if gp.location_code not in guard_locations:
            raise HTTPException(status_code=403, detail="This pass belongs to another location's gate")
        # SOD tripwire (structural rule makes this unreachable via the app:
        # creators can never hold GPD — kept against hand-edited DB roles)
        if current_user.username in (gp.created_by, gp.released_by):
            raise HTTPException(
                status_code=403,
                detail="SOD_VIOLATION: you cannot receive a pass you created or released",
            )

        lines_by_id = {l.id: l for l in gp.lines}
        receipt_details = []
        for r in payload.receipts:
            line = lines_by_id.get(r.line_id)
            if line is None:
                raise HTTPException(status_code=400, detail=f"Line {r.line_id} does not belong to this pass")
            outstanding = (line.quantity or 0) - (line.received_qty or 0)
            if r.received_qty > outstanding:
                raise HTTPException(
                    status_code=400,
                    detail=f"Line {line.line_no}: receiving {r.received_qty} but only {outstanding} outstanding",
                )
            line.received_qty = (line.received_qty or 0) + r.received_qty
            receipt_details.append({
                "line_no": line.line_no,
                "description": line.description,
                "received_qty": r.received_qty,
                "total_received": line.received_qty,
                "of_quantity": line.quantity,
            })

        fully_received = all((l.received_qty or 0) >= (l.quantity or 0) for l in gp.lines)
        gp.status = GP_RECEIVED if fully_received else GP_PARTIAL
        if fully_received:
            gp.completed_at = datetime.now()
        _log_event(db, gp, "INWARD", current_user, remarks=payload.security_remarks,
                   details={"receipts": receipt_details})
        db.commit()
        return {
            "message": "Inward recorded",
            "gate_pass_no": gp.gate_pass_no,
            "status": gp.status,
            "outstanding_quantity": gp.total_outstanding(),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("inward_gate_pass failed")
        raise HTTPException(status_code=500, detail="Failed to record inward. See server logs.")


@router.post("/{pass_id}/force-close")
def force_close_gate_pass(
    pass_id: int,
    payload: GatePassForceCloseRequest,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Admin-only escape hatch for items that will never return (lost /
    written off). Records outstanding quantities at close time so the
    year-end report shows exactly what was written off and why."""
    if not _is_itadmin(current_user):
        raise HTTPException(status_code=403, detail="Only IT Admins can force close a gate pass")
    try:
        gp = _locked_pass(db, pass_id)
        # Scoped like any creator view: ITA needs GPC + the pass's location
        # (nobody force-closes outside their own scoped view).
        _check_pass_view_access(db, gp, current_user)
        if gp.pass_type != PASS_TYPE_RETURNABLE or gp.status not in (GP_DISPATCHED, GP_PARTIAL):
            raise HTTPException(
                status_code=409,
                detail=f"Pass is {gp.status} — only a Dispatched or Partially Received returnable pass can be force closed",
            )
        outstanding = [
            {"line_no": l.line_no, "description": l.description,
             "never_returned": (l.quantity or 0) - (l.received_qty or 0)}
            for l in gp.lines if (l.quantity or 0) > (l.received_qty or 0)
        ]
        gp.status = GP_CLOSED
        gp.closed_by = current_user.username
        gp.closed_at = datetime.now()
        gp.completed_at = gp.closed_at
        gp.close_reason = payload.close_reason
        _log_event(db, gp, "FORCE_CLOSE", current_user, remarks=payload.close_reason,
                   details={"outstanding_at_close": outstanding})
        db.commit()
        return {"message": "Gate pass closed without return", "gate_pass_no": gp.gate_pass_no, "status": gp.status}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("force_close_gate_pass failed")
        raise HTTPException(status_code=500, detail="Failed to close gate pass. See server logs.")
