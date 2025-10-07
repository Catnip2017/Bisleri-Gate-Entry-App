# app/routers/raw_materials.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.schemas.raw_materials_schemas import RawMaterialsCreate, RawMaterialsResponse, RawMaterialsEdit
from app.models import RawMaterialsData, UsersMaster
from app.auth import get_current_user
from app.utils.helpers import generate_gate_entry_no_for_user, validate_vehicle_number
from datetime import datetime, timedelta
from typing import List

router = APIRouter(prefix="/rm", tags=["Raw Materials"])

@router.post("/create-entry", response_model=RawMaterialsResponse)
def create_raw_materials_entry(
    entry: RawMaterialsCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Create raw materials gate entry"""
    try:
        # Validate vehicle number format
        if not validate_vehicle_number(entry.vehicle_no):
            raise HTTPException(
                status_code=400,
                detail="Invalid vehicle number format"
            )
        
        # Generate gate entry number
        gate_entry_no = generate_gate_entry_no_for_user(current_user.username)
        if not gate_entry_no:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate gate entry number"
            )
        
        now = datetime.now()
        security_name = f"{current_user.first_name} {current_user.last_name}"
        
        # Create raw materials entry
        rm_entry = RawMaterialsData(
            gate_entry_no=gate_entry_no,
            gate_type=entry.gate_type,
            vehicle_no=entry.vehicle_no.upper(),
            document_no=entry.document_no,
            name_of_party=entry.name_of_party,
            description_of_material=entry.description_of_material,
            quantity=entry.quantity,
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
        print(f"Raw materials entry creation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

@router.post("/filtered-entries")
def get_filtered_rm_entries(
    filters: dict,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get filtered raw materials entries"""
    try:
        # Build dynamic query
        query = db.query(RawMaterialsData)
        
        # Date filters
        if filters.get('from_date'):
            from_date = datetime.strptime(filters['from_date'], '%Y-%m-%d').date()
            query = query.filter(RawMaterialsData.date_time >= from_date)
        if filters.get('to_date'):
            to_date = datetime.strptime(filters['to_date'], '%Y-%m-%d').date()
            # Add one day and convert to end of day
            end_date = datetime.combine(to_date, datetime.max.time())
            query = query.filter(RawMaterialsData.date_time <= end_date)
            
        # Vehicle number filter
        if filters.get('vehicle_no'):
            vehicle_filter = f"%{filters['vehicle_no'].upper()}%"
            query = query.filter(RawMaterialsData.vehicle_no.ilike(vehicle_filter))
            
        # Movement type filter
        if filters.get('movement_type'):
            query = query.filter(RawMaterialsData.gate_type == filters['movement_type'])
        
        # Security filter for non-admins
        if current_user.role != "Admin":
            query = query.filter(RawMaterialsData.warehouse_code == current_user.warehouse_code)
        
        # Execute query
        entries = query.order_by(
            RawMaterialsData.date_time.desc()
        ).limit(5000).all()
        
        # Format response with edit status
        result_list = []
        for entry in entries:
            # Check if entry can be edited (24-hour window)
            time_since_creation = datetime.now() - entry.date_time
            can_edit = (
                time_since_creation <= timedelta(hours=24) and
                (current_user.role == "Admin" or entry.security_username == current_user.username)
            )
            
            # Calculate time remaining
            time_remaining = None
            if time_since_creation <= timedelta(hours=24):
                remaining_seconds = (timedelta(hours=24) - time_since_creation).total_seconds()
                hours = int(remaining_seconds // 3600)
                minutes = int((remaining_seconds % 3600) // 60)
                time_remaining = f"{hours}h {minutes}m"
            
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
            "count": len(result_list),
            "results": result_list,
            "filters_applied": filters
        }
        
    except Exception as e:
        print(f"Error in filtered RM entries: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Filter error: {str(e)}")

@router.put("/update-entry")
def update_rm_entry(
    edit_data: RawMaterialsEdit,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Update raw materials entry within 24-hour window"""
    try:
        # Find the entry
        rm_entry = db.query(RawMaterialsData).filter(
            RawMaterialsData.gate_entry_no == edit_data.gate_entry_no
        ).first()
        
        if not rm_entry:
            raise HTTPException(status_code=404, detail="Raw materials entry not found")
        
        # Check 24-hour edit window
        time_since_creation = datetime.now() - rm_entry.date_time
        if time_since_creation.total_seconds() > 24 * 60 * 60:  # 24 hours in seconds
            raise HTTPException(
                status_code=403, 
                detail="Edit window expired. Records can only be edited within 24 hours."
            )
        
        # Check permissions (creator or admin)
        if current_user.role != "Admin" and rm_entry.security_username != current_user.username:
            raise HTTPException(
                status_code=403,
                detail="You can only edit your own entries"
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
        print(f"Error updating RM entry: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

@router.get("/statistics")
def get_rm_statistics(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get raw materials statistics"""
    try:
        # ✅ FIX: Normalize roles like you do everywhere else
        def normalize_roles(role_string: str) -> List[str]:
            if not role_string:
                return []
            return [r.strip().lower().replace(" ", "") for r in role_string.split(",") if r.strip()]
        
        current_roles = normalize_roles(current_user.role)
        
        base_query = db.query(RawMaterialsData)
        
        # ✅ FIX: Check for normalized admin roles
        if not any(r in ["securityadmin", "itadmin"] for r in current_roles):
            # Non-admin: filter by warehouse
            base_query = base_query.filter(
                RawMaterialsData.warehouse_code == current_user.warehouse_code
            )
        
        # Get records from last 30 days
        thirty_days_ago = datetime.now() - timedelta(days=30)
        recent_records = base_query.filter(RawMaterialsData.date_time >= thirty_days_ago).all()
        
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
        gate_in_count = len([r for r in recent_records if r.gate_type == "Gate-In"])
        gate_out_count = len([r for r in recent_records if r.gate_type == "Gate-Out"])
        unique_vehicles = len(set(r.vehicle_no for r in recent_records))
        edited_entries = len([r for r in recent_records if (r.edit_count or 0) > 0])
        
        return {
            "total_entries": total_entries,
            "gate_in_count": gate_in_count,
            "gate_out_count": gate_out_count,
            "unique_vehicles": unique_vehicles,
            "edited_entries": edited_entries,
            "period": "Last 30 days"
        }
        
    except Exception as e:
        print(f"Error getting RM statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Statistics error: {str(e)}")
       
# ✅ ENHANCED: Admin filtered RM entries
@router.post("/admin-filtered-entries")
def get_admin_filtered_rm_entries(
    filters: dict,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get filtered raw materials entries for admin with proper role-based access"""
    try:
        # Normalize roles
        if hasattr(current_user, 'role') and current_user.role:
            roles = [r.strip().lower().replace(" ", "") for r in current_user.role.split(",")]
        else:
            roles = []
        
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
            if filters.get('site_code'):
                query = query.filter(RawMaterialsData.site_code == filters['site_code'])
            if filters.get('warehouse_code'):
                query = query.filter(RawMaterialsData.warehouse_code == filters['warehouse_code'])
        
        # Date filters
        if filters.get('from_date'):
            from_date = datetime.strptime(filters['from_date'], '%Y-%m-%d').date()
            query = query.filter(RawMaterialsData.date_time >= from_date)
        if filters.get('to_date'):
            to_date = datetime.strptime(filters['to_date'], '%Y-%m-%d').date()
            # Add one day and convert to end of day
            end_date = datetime.combine(to_date, datetime.max.time())
            query = query.filter(RawMaterialsData.date_time <= end_date)
            
        # Vehicle number filter
        if filters.get('vehicle_no'):
            vehicle_filter = f"%{filters['vehicle_no'].upper()}%"
            query = query.filter(RawMaterialsData.vehicle_no.ilike(vehicle_filter))
            
        # Movement type filter
        if filters.get('movement_type'):
            query = query.filter(RawMaterialsData.gate_type == filters['movement_type'])
        
        # Execute query
        entries = query.order_by(
            RawMaterialsData.date_time.desc()
        ).limit(5000).all()
        
        # Format response with edit status
        result_list = []
        for entry in entries:
            # Check if entry can be edited (24-hour window)
            time_since_creation = datetime.now() - entry.date_time
            can_edit = (
                time_since_creation <= timedelta(hours=24) and
                (current_user.role == "Admin" or "itadmin" in roles or entry.security_username == current_user.username)
            )
            
            # Calculate time remaining
            time_remaining = None
            if time_since_creation <= timedelta(hours=24):
                remaining_seconds = (timedelta(hours=24) - time_since_creation).total_seconds()
                hours = int(remaining_seconds // 3600)
                minutes = int((remaining_seconds % 3600) // 60)
                time_remaining = f"{hours}h {minutes}m"
            
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
            "count": len(result_list),
            "results": result_list,
            "filters_applied": filters,
            "user_role": current_user.role,
            "access_level": "itadmin" if "itadmin" in roles else "securityadmin"
        }
        
    except Exception as e:
        print(f"Error in admin filtered RM entries: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Filter error: {str(e)}")