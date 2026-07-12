# app/routers/raw_materials.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from app.database import get_db
from app.schemas.raw_materials_schemas import RawMaterialsCreate, RawMaterialsResponse, RawMaterialsEdit
from app.schemas.filter_schemas import MovementFilters
from app.models import RawMaterialsData, UsersMaster
from app.auth import get_current_user
from app.utils.errors import internal_error
from app.utils.helpers import generate_gate_entry_no_for_user, validate_vehicle_number
from app.utils.roles import normalize_roles
from app.utils.edit_window import EDIT_WINDOW_HOURS, is_within_edit_window, get_time_remaining
from datetime import datetime, timedelta, date
from typing import List

router = APIRouter(prefix="/rm", tags=["Raw Materials"])


def check_rm_document_movement_allowed(db: Session, document_no: str, gate_type: str):
    gate_in_count = db.query(func.count(RawMaterialsData.id)).filter(
        RawMaterialsData.document_no == document_no,
        RawMaterialsData.gate_type == "Gate-In"
    ).scalar() or 0

    gate_out_count = db.query(func.count(RawMaterialsData.id)).filter(
        RawMaterialsData.document_no == document_no,
        RawMaterialsData.gate_type == "Gate-Out"
    ).scalar() or 0

    if gate_type == "Gate-In":
        if gate_in_count > gate_out_count:
            return False, (
                f"Document {document_no} already has an active Gate-In. "
                f"Complete Gate-Out first before recording another Gate-In."
            )
    elif gate_type == "Gate-Out":
        if gate_out_count > gate_in_count:
            return False, (
                f"Document {document_no} already has an unmatched Gate-Out. "
                f"Complete Gate-In first before recording another Gate-Out."
            )
    return True, ""


@router.post("/create-entry", response_model=RawMaterialsResponse)
def create_raw_materials_entry(
    entry: RawMaterialsCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    try:
        # Validate vehicle number format
        if not validate_vehicle_number(entry.vehicle_no):
            raise HTTPException(
                status_code=400,
                detail="Invalid vehicle number format"
            )

        is_empty_vehicle = entry.is_empty_vehicle

        # Generate gate entry number first (needed for unique empty vehicle doc_no)
        gate_entry_no = generate_gate_entry_no_for_user(current_user.username)
        if not gate_entry_no:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate gate entry number"
            )

        if is_empty_vehicle:
            # ✅ Empty vehicle: auto-generate a unique document_no so it never conflicts
            doc_no = f"EMPTY-{gate_entry_no}"
        else:
            # 🔹 Normalize document_no for regular entries
            doc_no = entry.document_no.strip() if entry.document_no else ""

            # Run duplicate-movement check
            allowed, reason = check_rm_document_movement_allowed(db, doc_no, entry.gate_type)
            if not allowed:
                raise HTTPException(status_code=409, detail=reason)

        # Name of party, description, quantity are always provided by the user
        name_of_party = entry.name_of_party.strip()
        description_of_material = entry.description_of_material.strip()
        quantity = entry.quantity.strip()

        now = datetime.now()
        security_name = f"{current_user.first_name} {current_user.last_name}"

        rm_entry = RawMaterialsData(
            gate_entry_no=gate_entry_no,
            gate_type=entry.gate_type,
            vehicle_no=entry.vehicle_no.upper(),
            document_no=doc_no,
            name_of_party=name_of_party,
            description_of_material=description_of_material,
            quantity=quantity,
            date_time=now,
            security_name=security_name,
            security_username=current_user.username,
            warehouse_code=current_user.warehouse_code,
            site_code=current_user.site_code,
            edit_count=0
        )

        db.add(rm_entry)
        db.commit()
        db.refresh(rm_entry)

        return rm_entry

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise internal_error("Database error", e)

@router.get("/entries")
def get_rm_entries(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    warehouse_code: str | None = Query(None, max_length=50),
    site_code: str | None = Query(None, max_length=50),
    vehicle_no: str | None = Query(None, max_length=50),
    movement_type: str | None = Query(None, max_length=20),
    skip: int = Query(0, ge=0),
    limit: int = Query(5000, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Q11: GET twin of the legacy POST /rm/filtered-entries (same response)."""
    filters = MovementFilters(
        from_date=from_date, to_date=to_date, warehouse_code=warehouse_code,
        site_code=site_code, vehicle_no=vehicle_no, movement_type=movement_type,
        skip=skip, limit=limit,
    )
    return get_filtered_rm_entries(filters, db, current_user)


@router.post("/filtered-entries", deprecated=True)  # Q11: use GET /rm/entries
def get_filtered_rm_entries(
    filters: MovementFilters,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get filtered raw materials entries"""
    try:
        # Build dynamic query
        query = db.query(RawMaterialsData)
        
        # Date filters (dates already validated & parsed by MovementFilters)
        if filters.from_date:
            query = query.filter(RawMaterialsData.date_time >= filters.from_date)
        if filters.to_date:
            # end of day, inclusive
            end_date = datetime.combine(filters.to_date, datetime.max.time())
            query = query.filter(RawMaterialsData.date_time <= end_date)

        # Vehicle number filter
        if filters.vehicle_no:
            query = query.filter(RawMaterialsData.vehicle_no.ilike(f"%{filters.vehicle_no.upper()}%"))

        # Movement type filter
        if filters.movement_type:
            query = query.filter(RawMaterialsData.gate_type == filters.movement_type)

        # Optional admin filters (mirrors /filtered-movements)
        if filters.warehouse_code:
            query = query.filter(RawMaterialsData.warehouse_code == filters.warehouse_code)
        if filters.site_code:
            query = query.filter(RawMaterialsData.site_code == filters.site_code)

        # IT Admin sees all warehouses; Security Admin / Security Guard see
        # their own warehouse only. (Was the raw "Admin" string bug — F14's
        # twin — which warehouse-locked IT Admins on this endpoint.)
        normalized_roles = normalize_roles(current_user.role)
        if "itadmin" not in normalized_roles:
            query = query.filter(RawMaterialsData.warehouse_code == current_user.warehouse_code)
        
        # Execute query
        total_count = query.count()   # Q8: rows matching, before paging
        entries = (
            query.order_by(RawMaterialsData.date_time.desc())
            .offset(filters.skip)
            .limit(filters.limit)
            .all()
        )
        
        # Format response with edit status
        result_list = []
        for entry in entries:
            # Check if entry can be edited (48-hour window — app/utils/edit_window.py)
            # IT Admin: view-only. Security Admin / Security Guard: same warehouse only.
            can_edit = (
                is_within_edit_window(entry.date_time) and
                "itadmin" not in normalized_roles and
                entry.warehouse_code == current_user.warehouse_code
            )
            time_remaining = get_time_remaining(entry.date_time)
            
            result_list.append({
                "id": entry.id,
                "gate_entry_no": entry.gate_entry_no,
                "gate_type": entry.gate_type,
                "vehicle_no": entry.vehicle_no,
                "document_no": entry.document_no,
                "name_of_party": entry.name_of_party,
                "description_of_material": entry.description_of_material,
                "quantity": entry.quantity,
                "date_time": entry.date_time.isoformat(),
                "security_name": entry.security_name,
                "security_username": entry.security_username,
                "warehouse_code": entry.warehouse_code,
                "site_code": entry.site_code,
                "last_edited_at": entry.last_edited_at.isoformat() if entry.last_edited_at else None,
                "edit_count": entry.edit_count or 0,
                "can_edit": can_edit,
                "time_remaining": time_remaining
            })
        
        return {
            "count": len(result_list),        # rows in this page
            "total_count": total_count,       # rows matching overall (Q8)
            "skip": filters.skip,
            "limit": filters.limit,
            "results": result_list,
            "filters_applied": filters
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise internal_error("Filter error", e)

@router.put("/update-entry")
def update_rm_entry(
    edit_data: RawMaterialsEdit,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Update raw materials entry within 48-hour window"""
    try:
        # Find the entry
        rm_entry = db.query(RawMaterialsData).filter(
            RawMaterialsData.gate_entry_no == edit_data.gate_entry_no
        ).first()
        
        if not rm_entry:
            raise HTTPException(status_code=404, detail="Raw materials entry not found")
        
        # Check 48-hour edit window (app/utils/edit_window.py)
        if not is_within_edit_window(rm_entry.date_time):
            raise HTTPException(
                status_code=403, 
                detail=f"Edit window expired. Records can only be edited within {EDIT_WINDOW_HOURS} hours."
            )

        # Check permissions — warehouse-based
        if "itadmin" in normalize_roles(current_user.role):
            raise HTTPException(
                status_code=403,
                detail="IT Admins can only view entries. Editing is disabled."
            )
        if rm_entry.warehouse_code != current_user.warehouse_code:
            raise HTTPException(
                status_code=403,
                detail="You can only edit entries from your own warehouse."
            )
        
        # Update fields
        fields_updated = []
        
        if edit_data.vehicle_no is not None:
            if edit_data.vehicle_no.strip():
                if not validate_vehicle_number(edit_data.vehicle_no):
                    raise HTTPException(status_code=400, detail="Invalid vehicle number format")
                rm_entry.vehicle_no = edit_data.vehicle_no.strip().upper()
            fields_updated.append('vehicle_no')
        
        if edit_data.document_no is not None:
            rm_entry.document_no = edit_data.document_no.strip() if edit_data.document_no.strip() else rm_entry.document_no
            fields_updated.append('document_no')
        
        if edit_data.name_of_party is not None:
            rm_entry.name_of_party = edit_data.name_of_party.strip() if edit_data.name_of_party.strip() else rm_entry.name_of_party
            fields_updated.append('name_of_party')
        
        if edit_data.description_of_material is not None:
            rm_entry.description_of_material = edit_data.description_of_material.strip() if edit_data.description_of_material.strip() else rm_entry.description_of_material
            fields_updated.append('description_of_material')
        
        if edit_data.quantity is not None:
            rm_entry.quantity = edit_data.quantity.strip() if edit_data.quantity.strip() else rm_entry.quantity
            fields_updated.append('quantity')
        
        # Update edit tracking
        rm_entry.last_edited_at = datetime.now()
        rm_entry.edit_count = (rm_entry.edit_count or 0) + 1
        
        # Commit changes
        db.commit()
        
        return {
            "message": "Raw materials entry updated successfully",
            "gate_entry_no": edit_data.gate_entry_no,
            "fields_updated": fields_updated,
            "edit_count": rm_entry.edit_count,
            "updated_at": rm_entry.last_edited_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise internal_error("Update failed", e)

@router.get("/statistics")
def get_rm_statistics(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get raw materials statistics"""
    try:
        normalized_roles = normalize_roles(current_user.role)

        base_query = db.query(RawMaterialsData)

        # IT Admin sees all warehouses; Security Admin / Security Guard see their own warehouse only
        if "itadmin" not in normalized_roles:
            base_query = base_query.filter(
                RawMaterialsData.warehouse_code == current_user.warehouse_code
            )

        # Get records from last 30 days
        thirty_days_ago = datetime.now() - timedelta(days=30)

        try:
            recent_records = base_query.filter(
                RawMaterialsData.date_time >= thirty_days_ago
            ).all()
        except Exception as db_err:
            print(f"DB query error in RM statistics: {str(db_err)}")
            raise HTTPException(
                status_code=500,
                detail=f"Database query failed. Ensure migrations are up to date. ({str(db_err)})"
            )

        if not recent_records:
            return {
                "total_entries": 0,
                "gate_in_count": 0,
                "gate_out_count": 0,
                "unique_vehicles": 0,
                "edited_entries": 0,
                "period": "Last 30 days"
            }

        # Calculate statistics
        total_entries = len(recent_records)
        gate_in_count = sum(1 for r in recent_records if r.gate_type == "Gate-In")
        gate_out_count = sum(1 for r in recent_records if r.gate_type == "Gate-Out")
        unique_vehicles = len(set(r.vehicle_no for r in recent_records if r.vehicle_no))
        edited_entries = sum(1 for r in recent_records if (r.edit_count or 0) > 0)

        return {
            "total_entries": total_entries,
            "gate_in_count": gate_in_count,
            "gate_out_count": gate_out_count,
            "unique_vehicles": unique_vehicles,
            "edited_entries": edited_entries,
            "period": "Last 30 days"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise internal_error("Statistics error", e)
       
# ✅ ENHANCED: Admin filtered RM entries
@router.get("/admin-entries")
def get_rm_admin_entries(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    warehouse_code: str | None = Query(None, max_length=50),
    site_code: str | None = Query(None, max_length=50),
    vehicle_no: str | None = Query(None, max_length=50),
    movement_type: str | None = Query(None, max_length=20),
    skip: int = Query(0, ge=0),
    limit: int = Query(5000, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Q11: GET twin of the legacy POST /rm/admin-filtered-entries (same response)."""
    filters = MovementFilters(
        from_date=from_date, to_date=to_date, warehouse_code=warehouse_code,
        site_code=site_code, vehicle_no=vehicle_no, movement_type=movement_type,
        skip=skip, limit=limit,
    )
    return get_admin_filtered_rm_entries(filters, db, current_user)


@router.post("/admin-filtered-entries", deprecated=True)  # Q11: use GET /rm/admin-entries
def get_admin_filtered_rm_entries(
    filters: MovementFilters,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get filtered raw materials entries for admin with proper role-based access"""
    try:
        # Normalize roles
        roles = normalize_roles(current_user.role)
        
        if not any(r in ["securityadmin", "itadmin"] for r in roles):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Build dynamic query
        query = db.query(RawMaterialsData)
        
        # ✅ NEW: Role-based filtering
        if "securityadmin" in roles and "itadmin" not in roles:
            # Security Admin: only their warehouse
            query = query.filter(RawMaterialsData.warehouse_code == current_user.warehouse_code)
        else:
            # IT Admin: can filter by site/warehouse if provided
            if filters.site_code:
                query = query.filter(RawMaterialsData.site_code == filters.site_code)
            if filters.warehouse_code:
                query = query.filter(RawMaterialsData.warehouse_code == filters.warehouse_code)
        
        # Date filters (dates already validated & parsed by MovementFilters)
        if filters.from_date:
            query = query.filter(RawMaterialsData.date_time >= filters.from_date)
        if filters.to_date:
            # end of day, inclusive
            end_date = datetime.combine(filters.to_date, datetime.max.time())
            query = query.filter(RawMaterialsData.date_time <= end_date)

        # Vehicle number filter
        if filters.vehicle_no:
            query = query.filter(RawMaterialsData.vehicle_no.ilike(f"%{filters.vehicle_no.upper()}%"))

        # Movement type filter
        if filters.movement_type:
            query = query.filter(RawMaterialsData.gate_type == filters.movement_type)
        
        # Execute query
        total_count = query.count()   # Q8: rows matching, before paging
        entries = (
            query.order_by(RawMaterialsData.date_time.desc())
            .offset(filters.skip)
            .limit(filters.limit)
            .all()
        )
        
        # Format response with edit status
        result_list = []
        for entry in entries:
            # Check if entry can be edited (48-hour window — app/utils/edit_window.py)
            # IT Admin: view-only. Security Admin: same warehouse only.
            can_edit = (
                is_within_edit_window(entry.date_time) and
                "itadmin" not in roles and
                entry.warehouse_code == current_user.warehouse_code
            )
            time_remaining = get_time_remaining(entry.date_time)
            
            result_list.append({
                "id": entry.id,
                "gate_entry_no": entry.gate_entry_no,
                "gate_type": entry.gate_type,
                "vehicle_no": entry.vehicle_no,
                "document_no": entry.document_no,
                "name_of_party": entry.name_of_party,
                "description_of_material": entry.description_of_material,
                "quantity": entry.quantity,
                "date_time": entry.date_time.isoformat(),
                "security_name": entry.security_name,
                "security_username": entry.security_username,
                "warehouse_code": entry.warehouse_code,
                "site_code": entry.site_code,
                "last_edited_at": entry.last_edited_at.isoformat() if entry.last_edited_at else None,
                "edit_count": entry.edit_count or 0,
                "can_edit": can_edit,
                "time_remaining": time_remaining
            })
        
        return {
            "count": len(result_list),        # rows in this page
            "total_count": total_count,       # rows matching overall (Q8)
            "skip": filters.skip,
            "limit": filters.limit,
            "results": result_list,
            "filters_applied": filters,
            "user_role": current_user.role,
            "access_level": "itadmin" if "itadmin" in roles else "securityadmin"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise internal_error("Filter error", e)