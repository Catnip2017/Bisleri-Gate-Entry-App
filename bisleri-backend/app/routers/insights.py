# app/routers/insights.py - UPDATED WITH OPERATIONAL EDIT LOGIC
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
from app.database import get_db
from app.models import InsightsData, DocumentData
from app.schemas import InsightsFilter, OperationalDataEdit, EnhancedMovementResponse, EditStatistics, KMReadingContext
from app.auth import get_current_user
from app.models import UsersMaster 
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(tags=["Insights"])

@router.post("/filtered-movements")
def get_enhanced_filtered_movements(
    filters: dict,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get filtered movements with enhanced operational edit status"""
    try:
        # Build dynamic query
        query = db.query(InsightsData)
        
        # Date filters
        if filters.get('from_date'):
            query = query.filter(InsightsData.date >= filters['from_date'])
        if filters.get('to_date'):
            query = query.filter(InsightsData.date <= filters['to_date'])
            
        # Vehicle number filter
        if filters.get('vehicle_no'):
            vehicle_filter = f"%{filters['vehicle_no'].upper()}%"
            query = query.filter(InsightsData.vehicle_no.ilike(vehicle_filter))
            
        # Movement type filter
        if filters.get('movement_type'):
            query = query.filter(InsightsData.movement_type == filters['movement_type'])
        
        # Security filter for non-admins
        if current_user.role != "Admin":
            query = query.filter(InsightsData.warehouse_code == current_user.warehouse_code)
        
        # Execute query
        movements = query.order_by(
            InsightsData.date.desc(), 
            InsightsData.time.desc()
        ).limit(500).all()
        
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
            edit_button_config = movement.get_edit_button_config(
                current_user.username, 
                current_user.role
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
                "warehouse_name": movement.warehouse_name,
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
                "last_edited_at": movement.last_edited_at.isoformat() if movement.last_edited_at else None,
                "edit_count": movement.edit_count or 0,
                
                # ✅ NEW: Edit status information
                "edit_status": movement.get_edit_status(),
                "time_remaining": movement.get_time_remaining(),
                "is_operational_complete": movement.is_operational_data_complete(),
                "missing_fields": movement.get_missing_operational_fields(),
                "can_edit": movement.can_be_edited(current_user.username, current_user.role),
                "edit_button_config": edit_button_config
            })
        
        return {
            "count": len(result_list),
            "results": result_list,
            "filters_applied": filters
        }
        
    except Exception as e:
        print(f"Error in enhanced filtered movements: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Filter error: {str(e)}")

@router.put("/update-operational-data")
def update_operational_data(
    edit_data: OperationalDataEdit,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Update operational fields with enhanced 24-hour window logic"""
    try:
        # Find the insights record
        insights_record = db.query(InsightsData).filter(
            InsightsData.gate_entry_no == edit_data.gate_entry_no
        ).first()
        
        if not insights_record:
            raise HTTPException(status_code=404, detail="Gate entry not found")
        
        # ✅ NEW: Check 24-hour edit window (extended from 12)
        entry_datetime = datetime.combine(insights_record.date, insights_record.time)
        time_elapsed = datetime.now() - entry_datetime
        
        if time_elapsed.total_seconds() > 24 * 60 * 60:  # 24 hours in seconds
            raise HTTPException(
                status_code=403, 
                detail="Edit window expired. Records can only be edited within 24 hours."
            )
        
        # Check permissions (creator or admin)
        if not insights_record.can_be_edited(current_user.username, current_user.role):
            raise HTTPException(
                status_code=403,
                detail="You can only edit your own gate entries (or admin access required)"
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
        
        if edit_data.remarks is not None:
            insights_record.remarks = edit_data.remarks.strip() if edit_data.remarks.strip() else None
            fields_updated.append('remarks')
        
        # ✅ NEW: Update edit tracking
        insights_record.last_edited_at = datetime.now()
        insights_record.edit_count = (insights_record.edit_count or 0) + 1
        
        # Commit changes
        db.commit()
        
        # ✅ NEW: Get updated edit status
        updated_button_config = insights_record.get_edit_button_config(
            current_user.username, 
            current_user.role
        )
        
        return {
            "message": "Operational data updated successfully",
            "gate_entry_no": edit_data.gate_entry_no,
            "fields_updated": fields_updated,
            "edit_count": insights_record.edit_count,
            "updated_at": insights_record.last_edited_at.isoformat(),
            "operational_complete": insights_record.is_operational_data_complete(),
            "edit_status": insights_record.get_edit_status(),
            "time_remaining": insights_record.get_time_remaining(),
            "edit_button_config": updated_button_config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error updating operational data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

@router.get("/edit-statistics")
def get_edit_statistics(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get statistics about record completion and edit status"""
    try:
        base_query = db.query(InsightsData)
        
        # Filter by warehouse for non-admins
        if current_user.role != "Admin":
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
            edit_status = record.get_edit_status()
            
            # Count by edit status
            if edit_status == 'needs_completion':
                needs_completion += 1
            elif edit_status == 'editable':
                complete_and_editable += 1
            elif edit_status == 'expired':
                expired += 1
            
            # Count missing fields
            missing_fields = record.get_missing_operational_fields()
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
        
    except Exception as e:
        print(f"Error getting edit statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Statistics error: {str(e)}")

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
        print(f"Error getting KM context: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Context error: {str(e)}")

@router.get("/records-needing-completion")
def get_records_needing_completion(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get all records that need operational data completion (YELLOW button candidates)"""
    try:
        base_query = db.query(InsightsData)
        
        # Filter by warehouse for non-admins
        if current_user.role != "Admin":
            base_query = base_query.filter(
                InsightsData.warehouse_code == current_user.warehouse_code
            )
        
        # Only get records within 24-hour edit window
        twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
        recent_records = base_query.filter(
            InsightsData.date >= twenty_four_hours_ago.date()
        ).all()
        
        # Filter records that need completion
        needing_completion = []
        for record in recent_records:
            if record.get_edit_status() == 'needs_completion':
                button_config = record.get_edit_button_config(
                    current_user.username, 
                    current_user.role
                )
                
                needing_completion.append({
                    "gate_entry_no": record.gate_entry_no,
                    "vehicle_no": record.vehicle_no,
                    "date": record.date.isoformat(),
                    "time": record.time.isoformat(),
                    "movement_type": record.movement_type,
                    "missing_fields": record.get_missing_operational_fields(),
                    "time_remaining": record.get_time_remaining(),
                    "button_config": button_config
                })
        
        return {
            "count": len(needing_completion),
            "records": needing_completion
        }
        
    except Exception as e:
        print(f"Error getting records needing completion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Query error: {str(e)}")

# ✅ BACKWARD COMPATIBILITY: Keep the old edit endpoint for gradual migration
@router.put("/update-gate-entry")
def update_gate_entry_legacy(
    edit_data: dict,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Legacy edit endpoint - redirects to new operational data endpoint"""
    try:
        # Convert old format to new format
        operational_edit = OperationalDataEdit(
            gate_entry_no=edit_data.get('gate_entry_no'),
            driver_name=edit_data.get('driver_name'),
            km_reading=edit_data.get('km_reading'),
            loader_names=edit_data.get('loader_names'),
            remarks=edit_data.get('remarks')
        )
        
        # Call the new endpoint
        return update_operational_data(operational_edit, db, current_user)
        
    except Exception as e:
        print(f"Error in legacy edit endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Legacy update failed: {str(e)}")