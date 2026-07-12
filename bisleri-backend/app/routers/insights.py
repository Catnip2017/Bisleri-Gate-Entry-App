# app/routers/insights.py - UPDATED WITH OPERATIONAL EDIT LOGIC
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta, date
from app.database import get_db
from app.models import InsightsData, DocumentData
from app.schemas import InsightsFilter, OperationalDataEdit, EnhancedMovementResponse, EditStatistics, KMReadingContext, MovementFilters
from app.auth import get_current_user
from app.utils.errors import internal_error
from app.utils.roles import normalize_roles
from app.utils.edit_window import EDIT_WINDOW, EDIT_WINDOW_HOURS, is_within_edit_window
from app.services import edit_service
from app.models import UsersMaster 
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(tags=["Insights"])

@router.get("/movements")
def get_movements(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    warehouse_code: Optional[str] = Query(None, max_length=50),
    site_code: Optional[str] = Query(None, max_length=50),
    vehicle_no: Optional[str] = Query(None, max_length=50),
    movement_type: Optional[str] = Query(None, max_length=20),
    skip: int = Query(0, ge=0),
    limit: int = Query(5000, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    """Q11: GET twin of the legacy POST /filtered-movements (same response)."""
    filters = MovementFilters(
        from_date=from_date, to_date=to_date, warehouse_code=warehouse_code,
        site_code=site_code, vehicle_no=vehicle_no, movement_type=movement_type,
        skip=skip, limit=limit,
    )
    return get_enhanced_filtered_movements(filters, db, current_user)


@router.post("/filtered-movements", deprecated=True)  # Q11: use GET /movements
def get_enhanced_filtered_movements(
    filters: MovementFilters,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get filtered movements with enhanced operational edit status"""
    try:
        # Build dynamic query
        query = db.query(InsightsData)
        
        # Date filters
        if filters.from_date:
            query = query.filter(InsightsData.date >= filters.from_date)
        if filters.to_date:
            query = query.filter(InsightsData.date <= filters.to_date)
            
        # ✅ ADD WAREHOUSE CODE FILTER HERE
        if filters.warehouse_code:
            query = query.filter(InsightsData.warehouse_code == filters.warehouse_code)
            
        # ✅ ADD SITE CODE FILTER HERE  
        if filters.site_code:
            query = query.filter(InsightsData.site_code == filters.site_code)
            
        # Vehicle number filter
        if filters.vehicle_no:
            query = query.filter(InsightsData.vehicle_no.ilike(f"%{filters.vehicle_no.upper()}%"))
            
        # Movement type filter
        if filters.movement_type:
            query = query.filter(InsightsData.movement_type == filters.movement_type)
        
        # IT Admin sees all warehouses; Security Admin / Security Guard see their own warehouse only
        user_roles = normalize_roles(current_user.role)
        if "itadmin" not in user_roles:
            query = query.filter(InsightsData.warehouse_code == current_user.warehouse_code)
        
        
        # Execute query
        total_count = query.count()   # Q8: rows matching, before paging
        movements = (
            query.order_by(InsightsData.date.desc(), InsightsData.time.desc())
            .offset(filters.skip)
            .limit(filters.limit)
            .all()
        )
        
        # ✅ NEW: Enhanced response with operational edit status
        result_list = []
        for movement in movements:
            # Calculate document age
            document_age_time = None
            if movement.document_date:
                time_diff = datetime.now() - movement.document_date
                total_seconds = int(time_diff.total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                seconds = total_seconds % 60
                document_age_time = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            
            # ✅ NEW: Get edit status and button configuration
            edit_button_config = edit_service.get_edit_button_config(
                movement,
                current_user.username,
                current_user.role,
                current_user.warehouse_code
            )
            
            result_list.append({
                "id": movement.id,
                "gate_entry_no": movement.gate_entry_no,
                "document_type": movement.document_type,
                "sub_document_type": movement.sub_document_type,
                "document_no": movement.document_no,  # NEW FIELD
                "vehicle_no": movement.vehicle_no,
                "date": movement.date.isoformat() if movement.date else None,
                "time": movement.time.isoformat() if movement.time else None,
                "movement_type": movement.movement_type,
                "to_warehouse_code": movement.warehouse_code,
                "security_name": movement.security_name,
                "security_username": movement.security_username,
                "site_code": movement.site_code,
                "remarks": movement.remarks,
                "document_date": movement.document_date.isoformat() if movement.document_date else None,
                "document_age_time": document_age_time,
                
                # ✅ NEW: Operational fields
                "driver_name": movement.driver_name,
                "km_reading": movement.km_reading,
                "loader_names": movement.loader_names,
                "loader_count": movement.loader_count,   # ✅ ADD THIS
                "last_edited_at": movement.last_edited_at.isoformat() if movement.last_edited_at else None,
                "edit_count": movement.edit_count or 0,
                
                # ✅ NEW: Edit status information
                "edit_status": edit_service.get_edit_status(movement),
                "time_remaining": edit_service.get_time_remaining(movement),
                "is_operational_complete": edit_service.is_operational_data_complete(movement),
                "missing_fields": edit_service.get_missing_operational_fields(movement),
                "can_edit": edit_service.can_be_edited(movement, current_user.username, current_user.role, current_user.warehouse_code),
                "edit_button_config": edit_button_config
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

@router.put("/update-operational-data")
def update_operational_data(
    edit_data: OperationalDataEdit,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Update operational fields with enhanced 48-hour window logic"""
    try:
        # Find the insights record
        insights_record = db.query(InsightsData).filter(
            InsightsData.gate_entry_no == edit_data.gate_entry_no
        ).first()
        
        if not insights_record:
            raise HTTPException(status_code=404, detail="Gate entry not found")
        
        # ✅ Check 48-hour edit window (app/utils/edit_window.py)
        if not is_within_edit_window(edit_service.record_created_at(insights_record)):
            raise HTTPException(
                status_code=403, 
                detail=f"Edit window expired. Records can only be edited within {EDIT_WINDOW_HOURS} hours."
            )
            
        # Check permissions (same warehouse or admin)
        if not edit_service.can_be_edited(insights_record, current_user.username, current_user.role, current_user.warehouse_code):
            raise HTTPException(
                status_code=403,
                detail="Only staff from this warehouse or Admin can edit this entry."
            )
        
        # ✅ NEW: Update operational fields
        fields_updated = []
        
        if edit_data.driver_name is not None:
            insights_record.driver_name = edit_data.driver_name.strip() if edit_data.driver_name.strip() else None
            fields_updated.append('driver_name')
        
        if edit_data.km_reading is not None:
            insights_record.km_reading = edit_data.km_reading.strip() if edit_data.km_reading.strip() else None
            fields_updated.append('km_reading')
        
        if edit_data.loader_names is not None:
            insights_record.loader_names = edit_data.loader_names.strip() if edit_data.loader_names.strip() else None
            fields_updated.append('loader_names')
        
                        # ✅ ADD THIS BLOCK
        if edit_data.loader_count is not None:
                insights_record.loader_count = edit_data.loader_count
                fields_updated.append('loader_count')
        if edit_data.remarks is not None:
            insights_record.remarks = edit_data.remarks.strip() if edit_data.remarks.strip() else None
            fields_updated.append('remarks')
        
        # ✅ NEW: Update edit tracking
        insights_record.last_edited_at = datetime.now()
        insights_record.edit_count = (insights_record.edit_count or 0) + 1
        
        # Commit changes
        db.commit()
        
        # ✅ NEW: Get updated edit status
        updated_button_config = edit_service.get_edit_button_config(
            insights_record,
            current_user.username,
            current_user.role,
            current_user.warehouse_code
        )
        
        return {
            "message": "Operational data updated successfully",
            "gate_entry_no": edit_data.gate_entry_no,
            "fields_updated": fields_updated,
            "edit_count": insights_record.edit_count,
            "updated_at": insights_record.last_edited_at.isoformat(),
            "operational_complete": edit_service.is_operational_data_complete(insights_record),
            "edit_status": edit_service.get_edit_status(insights_record),
            "time_remaining": edit_service.get_time_remaining(insights_record),
            "edit_button_config": updated_button_config,
            "updated_data": {
            "driver_name": insights_record.driver_name,
            "km_reading": insights_record.km_reading,
            "loader_names": insights_record.loader_names,
            "last_edited_at": insights_record.last_edited_at.isoformat(),
            "edit_count": insights_record.edit_count,
            "loader_count": insights_record.loader_count,   # ✅ ADD

    }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise internal_error("Update failed", e)

@router.get("/edit-statistics")
def get_edit_statistics(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get statistics about record completion and edit status"""
    try:
        base_query = db.query(InsightsData)

        # IT Admin sees all warehouses; Security Admin / Security Guard see their own warehouse only
        normalized_roles = normalize_roles(current_user.role)
        if "itadmin" not in normalized_roles:
            base_query = base_query.filter(
                InsightsData.warehouse_code == current_user.warehouse_code
            )

        # Get all records from last 30 days
        thirty_days_ago = datetime.now() - timedelta(days=30)
        records = base_query.filter(InsightsData.date >= thirty_days_ago.date()).all()
        
        if not records:
            return EditStatistics(
                total_records=0, needs_completion=0, complete_and_editable=0,
                expired=0, completion_percentage=0.0, within_6_hours=0,
                within_12_hours=0, within_24_hours=0, missing_driver=0,
                missing_km=0, missing_loaders=0, edited_today=0,
                most_edited_record=None, avg_edits_per_record=0.0
            )
        
        # Calculate statistics
        total_records = len(records)
        needs_completion = 0
        complete_and_editable = 0
        expired = 0
        
        within_6_hours = 0
        within_12_hours = 0
        within_24_hours = 0
        
        missing_driver = 0
        missing_km = 0
        missing_loaders = 0
        
        edited_today = 0
        edit_counts = []
        max_edits = 0
        most_edited_record = None
        
        today = datetime.now().date()
        
        for record in records:
            edit_status = edit_service.get_edit_status(record)
            
            # Count by edit status
            if edit_status == 'needs_completion':
                needs_completion += 1
            elif edit_status == 'editable':
                complete_and_editable += 1
            elif edit_status == 'expired':
                expired += 1
            
            # Count missing fields
            missing_fields = edit_service.get_missing_operational_fields(record)
            if 'driver_name' in missing_fields:
                missing_driver += 1
            if 'km_reading' in missing_fields:
                missing_km += 1
            if 'loader_names' in missing_fields:
                missing_loaders += 1
            
            # Time-based counting
            if record.date and record.time:
                record_datetime = datetime.combine(record.date, record.time)
                time_elapsed = datetime.now() - record_datetime
                
                if time_elapsed <= timedelta(hours=6):
                    within_6_hours += 1
                elif time_elapsed <= timedelta(hours=12):
                    within_12_hours += 1
                elif time_elapsed <= timedelta(hours=24):
                    within_24_hours += 1
            
            # Edit tracking
            edit_count = record.edit_count or 0
            edit_counts.append(edit_count)
            
            if edit_count > max_edits:
                max_edits = edit_count
                most_edited_record = record.gate_entry_no
            
            if record.last_edited_at and record.last_edited_at.date() == today:
                edited_today += 1
        
        # Calculate completion percentage
        operational_complete = complete_and_editable + expired  # Expired records are assumed complete
        completion_percentage = (operational_complete / total_records * 100) if total_records > 0 else 0.0
        
        # Calculate average edits
        avg_edits = sum(edit_counts) / len(edit_counts) if edit_counts else 0.0
        
        return EditStatistics(
            total_records=total_records,
            needs_completion=needs_completion,
            complete_and_editable=complete_and_editable,
            expired=expired,
            completion_percentage=round(completion_percentage, 1),
            within_6_hours=within_6_hours,
            within_12_hours=within_12_hours,
            within_24_hours=within_24_hours,
            missing_driver=missing_driver,
            missing_km=missing_km,
            missing_loaders=missing_loaders,
            edited_today=edited_today,
            most_edited_record=most_edited_record,
            avg_edits_per_record=round(avg_edits, 1)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise internal_error("Statistics error", e)

@router.get("/km-reading-context/{gate_entry_no}")
def get_km_reading_context(
    gate_entry_no: str,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get context for KM reading input (previous readings, suggested range)"""
    try:
        # Get the target record
        record = db.query(InsightsData).filter(
            InsightsData.gate_entry_no == gate_entry_no
        ).first()
        
        if not record:
            raise HTTPException(status_code=404, detail="Gate entry not found")
        
        # Get previous KM reading for this vehicle
        previous_reading = None
        if record.vehicle_no:
            previous_record = db.query(InsightsData).filter(
                InsightsData.vehicle_no == record.vehicle_no,
                InsightsData.date < record.date,
                InsightsData.km_reading.isnot(None)
            ).order_by(InsightsData.date.desc(), InsightsData.time.desc()).first()
            
            if previous_record and previous_record.km_reading:
                previous_reading = previous_record.km_reading
        
        # Calculate suggested range
        suggested_range = {"min": 0, "max": 999999}
        if previous_reading and previous_reading.isdigit():
            prev_km = int(previous_reading)
            # Reasonable daily range: 0-500 km
            suggested_range = {
                "min": prev_km,
                "max": prev_km + 500
            }
        
        # Determine reading type
        reading_type = "km_out" if record.movement_type == "Gate-Out" else "km_in"
        
        return KMReadingContext(
            gate_entry_no=gate_entry_no,
            movement_type=record.movement_type,
            vehicle_no=record.vehicle_no or "Unknown",
            previous_km_reading=previous_reading,
            suggested_range=suggested_range,
            reading_type=reading_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise internal_error("Context error", e)

@router.get("/records-needing-completion")
def get_records_needing_completion(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get all records that need operational data completion (YELLOW button candidates)"""
    try:
        base_query = db.query(InsightsData)

        # IT Admin sees all warehouses; Security Admin / Security Guard see their own warehouse only
        normalized_roles = normalize_roles(current_user.role)
        if "itadmin" not in normalized_roles:
            base_query = base_query.filter(
                InsightsData.warehouse_code == current_user.warehouse_code
            )

        # Only get records within the edit window (app/utils/edit_window.py)
        window_start = datetime.now() - EDIT_WINDOW
        recent_records = base_query.filter(
            InsightsData.date >= window_start.date()
        ).all()
        
        # Filter records that need completion
        needing_completion = []
        for record in recent_records:
            if edit_service.get_edit_status(record) == 'needs_completion':
                button_config = edit_service.get_edit_button_config(
                    record,
                    current_user.username, 
                    current_user.role
                )
                
                needing_completion.append({
                    "gate_entry_no": record.gate_entry_no,
                    "vehicle_no": record.vehicle_no,
                    "date": record.date.isoformat(),
                    "time": record.time.isoformat(),
                    "movement_type": record.movement_type,
                    "missing_fields": edit_service.get_missing_operational_fields(record),
                    "time_remaining": edit_service.get_time_remaining(record),
                    "button_config": button_config
                })
        
        return {
            "count": len(needing_completion),
            "records": needing_completion
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise internal_error("Query error", e)

# ✅ BACKWARD COMPATIBILITY: Keep the old edit endpoint for gradual migration
@router.put("/update-gate-entry")
def update_gate_entry_legacy(
    edit_data: OperationalDataEdit,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Legacy edit endpoint - same body schema, validated by FastAPI (Q6)."""
    try:
        return update_operational_data(edit_data, db, current_user)
        
    except HTTPException:
        raise
    except Exception as e:
        raise internal_error("Legacy update failed", e)