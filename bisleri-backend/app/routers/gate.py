# app/routers/gate.py - COMPLETE ENHANCED VERSION WITH MULTI-DOCUMENT MANUAL ENTRY
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.schemas import (
    GateEntryCreate, 
    GateEntryResponse, 
    EnhancedGateEntryCreate, 
    EnhancedManualGateEntryCreate,
    ManualGateEntryCreate,
    BatchGateEntryCreate,
    MultiDocumentManualEntryCreate  # NEW: Multi-document schema
)
from app.models import DocumentData, InsightsData, UsersMaster
from app.auth import get_current_user
from app.utils.helpers import generate_gate_entry_no_for_user, fetch_user_details
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(tags=["Gate Operations"])

@router.get("/search-recent-documents/{vehicle_no}")
def search_recent_documents(
    vehicle_no: str,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Search documents within last 48 hours for a vehicle"""
    
    if not vehicle_no.strip():
        raise HTTPException(status_code=400, detail="Vehicle number cannot be empty")
    
    clean_vehicle_no = vehicle_no.strip().upper()
    
    try:
        query = text("""
            SELECT * FROM document_data
            WHERE vehicle_no = :vehicle_no
            AND document_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '48 hours'
            ORDER BY document_date DESC
        """)
        
        result = db.execute(query, {"vehicle_no": clean_vehicle_no})
        documents = result.fetchall()
        
        if not documents:
            raise HTTPException(
                status_code=404, 
                detail=f"No recent documents found for vehicle: {vehicle_no} (within last 48 hours)"
            )
        
        document_list = []
        for doc in documents:
            document_list.append({
                "document_no": doc.document_no,
                "document_type": doc.document_type,
                "sub_document_type": doc.sub_document_type,
                "document_date": doc.document_date.isoformat() if doc.document_date else None,
                "vehicle_no": doc.vehicle_no,
                "to_warehouse_code": doc.to_warehouse_code,  
                "warehouse_code": doc.warehouse_code,
                "customer_name": doc.customer_name,
                "customer_code": doc.customer_code,
                "total_quantity": doc.total_quantity,
                "transporter_name": doc.transporter_name,
                "e_way_bill_no": doc.e_way_bill_no,
                "route_code": doc.route_code,
                "route_no": doc.route_no,
                "site": doc.site,
                "direct_dispatch": doc.direct_dispatch,
                "salesman": doc.salesman,
                "gate_entry_no": doc.gate_entry_no,
                "from_warehouse_code": doc.from_warehouse_code,
                "irn_no": doc.irn_no
            })
        
        return {
            "vehicle_no": clean_vehicle_no,
            "count": len(document_list),
            "search_time": datetime.now().isoformat(),
            "documents": document_list
        }
        
    except Exception as e:
        if "No recent documents found" in str(e):
            raise e
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Database error while searching documents: {str(e)}"
            )

@router.get("/vehicle-status/{vehicle_no}")
def get_vehicle_status(
    vehicle_no: str,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get current gate status of a vehicle"""
    
    clean_vehicle_no = vehicle_no.strip().upper()
    
    last_entry = db.query(InsightsData).filter(
        InsightsData.vehicle_no == clean_vehicle_no
    ).order_by(InsightsData.date.desc(), InsightsData.time.desc()).first()
    
    if not last_entry:
        return {
            "vehicle_no": clean_vehicle_no,
            "status": "no_history",
            "last_movement": None,
            "can_gate_in": True,
            "can_gate_out": False,
            "message": "No previous gate movements found"
        }
    
    can_gate_in = last_entry.movement_type == "Gate-Out"
    can_gate_out = last_entry.movement_type == "Gate-In"
    
    return {
        "vehicle_no": clean_vehicle_no,
        "status": "active",
        "last_movement": {
            "type": last_entry.movement_type,
            "date": last_entry.date.isoformat(),
            "time": last_entry.time.isoformat(),
            "gate_entry_no": last_entry.gate_entry_no
        },
        "can_gate_in": can_gate_in,
        "can_gate_out": can_gate_out,
        "message": f"Last movement: {last_entry.movement_type} on {last_entry.date}"
    }

@router.post("/enhanced-batch-gate-entry")
def create_enhanced_batch_gate_entry(
    entry: EnhancedGateEntryCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Enhanced batch gate entry with optional operational data capture"""
    
    try:
        if not entry.document_nos and not entry.vehicle_no:
            raise HTTPException(status_code=400, detail="Please provide vehicle number or select documents")
        
        vehicle_no = entry.vehicle_no.strip().upper()
        
        # Check GATE IN/OUT SEQUENCE VALIDATION
        last_entry = db.query(InsightsData).filter(
            InsightsData.vehicle_no == vehicle_no
        ).order_by(InsightsData.date.desc(), InsightsData.time.desc()).first()

        # ✅ NEW: Handle first-time vehicle (no history)
        if not last_entry:
            # First-time vehicle - only Gate-In allowed
            if entry.gate_type == "Gate-Out":
                raise HTTPException(
                    status_code=400,
                    detail=f"First entry for vehicle {vehicle_no} must be Gate-In. Cannot do Gate-Out without prior Gate-In."
                )
            # Gate-In is allowed for first-time vehicles - no validation needed
        else:
            # ✅ EXISTING: Vehicle has history - apply alternating sequence validation
            if last_entry.movement_type == entry.gate_type:
                if entry.gate_type == "Gate-In":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Vehicle {vehicle_no} already has Gate-In on {last_entry.date}. Must do Gate-Out first."
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Vehicle {vehicle_no} already has Gate-Out on {last_entry.date}. Must do Gate-In first."
                    )
                
        # Generate gate entry number
        gate_entry_no = generate_gate_entry_no_for_user(current_user.username)
        
        if not gate_entry_no:
            user_details = fetch_user_details(current_user.username)
            if user_details and user_details.get('warehouse_code'):
                from app.utils.helpers import generate_gate_entry_number
                gate_entry_no = generate_gate_entry_number(user_details['warehouse_code'])
            
            if not gate_entry_no:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to generate gate entry number. Please check user warehouse assignment."
                )
        
        now = datetime.now()
        security_name = f"{current_user.first_name} {current_user.last_name}"
        security_username = current_user.username
        
        records_processed = 0
        processed_documents = []
        
        # NEW: Validate operational data if provided
        operational_data = {}
        if entry.driver_name and entry.driver_name.strip():
            if len(entry.driver_name.strip()) < 2:
                raise HTTPException(status_code=400, detail="Driver name must be at least 2 characters")
            operational_data['driver_name'] = entry.driver_name.strip()
        
        if entry.km_reading and entry.km_reading.strip():
            km_reading = entry.km_reading.strip()
            if not km_reading.isdigit() or len(km_reading) < 3 or len(km_reading) > 6:
                raise HTTPException(status_code=400, detail="KM reading must be 3-6 digits")
            operational_data['km_reading'] = km_reading
        
        if entry.loader_names and entry.loader_names.strip():
            loader_names = entry.loader_names.strip()
            names = [name.strip() for name in loader_names.split(',') if name.strip()]
            if len(names) > 10:
                raise HTTPException(status_code=400, detail="Maximum 10 loader names allowed")
            operational_data['loader_names'] = ', '.join(names)
        
        # Process documents if provided
        if entry.document_nos:
            for document_no in entry.document_nos:
                try:
                    document = db.query(DocumentData).filter(
                        DocumentData.document_no == document_no
                    ).first()
                    
                    if not document:
                        print(f"Document {document_no} not found, skipping...")
                        continue
                    
                    # UPDATE document_data with gate_entry_no
                    document.gate_entry_no = gate_entry_no
                    
                    # CREATE insights_data entry with operational data
                    insight_record = InsightsData(
                        gate_entry_no=gate_entry_no,
                        document_type=document.document_type or "",
                        sub_document_type=document.sub_document_type or "",
                        document_no=document.document_no,
                        vehicle_no=document.vehicle_no or vehicle_no,
                        date=now.date(),
                        time=now.time(),
                        movement_type=entry.gate_type,
                        remarks=entry.remarks or f"Gate entry for {document_no}",
                        warehouse_code=current_user.warehouse_code,
                        site_code=current_user.site_code,
                        security_name=security_name,
                        security_username=security_username,
                        document_date=document.document_date,
                        # NEW: Include operational data if provided
                        driver_name=operational_data.get('driver_name'),
                        km_reading=operational_data.get('km_reading'),
                        loader_names=operational_data.get('loader_names'),
                        edit_count=0,
                        last_edited_at=now if operational_data else None
                    )
                    
                    db.add(insight_record)
                    records_processed += 1
                    
                    processed_documents.append({
                        "document_no": document.document_no,
                        "document_type": document.document_type,
                        "vehicle_no": document.vehicle_no,
                        "status": "success"
                    })
                    
                except Exception as doc_error:
                    print(f"Error processing document {document_no}: {str(doc_error)}")
                    processed_documents.append({
                        "document_no": document_no,
                        "status": "error",
                        "error": str(doc_error)
                    })
                    continue
        else:
            # No documents - create single insights entry for empty vehicle
            insight_record = InsightsData(
                gate_entry_no=gate_entry_no,
                document_type=document.document_type or "",
                sub_document_type=document.sub_document_type or "",
                document_no=document.document_no,  # NEW FIELD
                vehicle_no=document.vehicle_no or vehicle_no,           
                warehouse_name=getattr(current_user, 'warehouse_name', f"Warehouse-{current_user.warehouse_code}"),
                date=now.date(),
                time=now.time(),
                movement_type=entry.gate_type,
                remarks=entry.remarks or f"Empty vehicle {entry.gate_type}",
                warehouse_code=current_user.warehouse_code,
                site_code=current_user.site_code,
                security_name=security_name,
                security_username=security_username,
                # NEW: Include operational data if provided
                driver_name=operational_data.get('driver_name'),
                km_reading=operational_data.get('km_reading'),
                loader_names=operational_data.get('loader_names'),
                edit_count=0,
                last_edited_at=now if operational_data else None
            )
            
            db.add(insight_record)
            records_processed = 1
        
        if records_processed > 0:
            db.commit()
            
            # NEW: Calculate operational completeness
            has_operational_data = bool(operational_data)
            operational_complete = all([
                operational_data.get('driver_name'),
                operational_data.get('km_reading'), 
                operational_data.get('loader_names')
            ])
            
            return {
                "message": f"Successfully processed {records_processed} records",
                "gate_entry_no": gate_entry_no,
                "records_processed": records_processed,
                "total_requested": len(entry.document_nos) if entry.document_nos else 1,
                "processed_documents": processed_documents,
                "date": now.isoformat(),
                "vehicle_no": vehicle_no,
                "movement_type": entry.gate_type,
                # NEW: Operational data status
                "operational_data_captured": has_operational_data,
                "operational_complete": operational_complete,
                "missing_operational_fields": [
                    field for field in ['driver_name', 'km_reading', 'loader_names']
                    if not operational_data.get(field)
                ],
                "edit_window_expires": (now + timedelta(hours=24)).isoformat()
            }
        else:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="No documents were processed successfully"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Enhanced batch gate entry error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

@router.post("/batch-gate-entry")
def create_batch_gate_entry(
    entry: BatchGateEntryCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Batch gate entry with RAW SQL gate entry number generation"""
    
    try:
        if not entry.document_nos:
            raise HTTPException(status_code=400, detail="Please select at least one document")
        
        vehicle_no = entry.vehicle_no.strip().upper()
        
        # Check GATE IN/OUT SEQUENCE VALIDATION
        last_entry = db.query(InsightsData).filter(
            InsightsData.vehicle_no == vehicle_no
        ).order_by(InsightsData.date.desc(), InsightsData.time.desc()).first()

        # ✅ NEW: Handle first-time vehicle (no history)
        if not last_entry:
            # First-time vehicle - only Gate-In allowed
            if entry.gate_type == "Gate-Out":
                raise HTTPException(
                    status_code=400,
                    detail=f"First entry for vehicle {vehicle_no} must be Gate-In. Cannot do Gate-Out without prior Gate-In."
                )
            # Gate-In is allowed for first-time vehicles - no validation needed
        else:
            # ✅ EXISTING: Vehicle has history - apply alternating sequence validation
            if last_entry.movement_type == entry.gate_type:
                if entry.gate_type == "Gate-In":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Vehicle {vehicle_no} already has Gate-In on {last_entry.date}. Must do Gate-Out first."
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Vehicle {vehicle_no} already has Gate-Out on {last_entry.date}. Must do Gate-In first."
                    )
        
        # RAW SQL: Generate gate entry number using fresh database data
        gate_entry_no = generate_gate_entry_no_for_user(current_user.username)
        
        if not gate_entry_no:
            # Fallback: Get fresh user details and try again
            user_details = fetch_user_details(current_user.username)
            if user_details and user_details.get('warehouse_code'):
                from app.utils.helpers import generate_gate_entry_number
                gate_entry_no = generate_gate_entry_number(user_details['warehouse_code'])
            
            if not gate_entry_no:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to generate gate entry number. Please check user warehouse assignment."
                )
        
        now = datetime.now()
        
        # Get user details for security logging
        security_name = f"{current_user.first_name} {current_user.last_name}"
        security_username = current_user.username
        
        records_processed = 0
        processed_documents = []
        
        # Process each selected document
        for document_no in entry.document_nos:
            try:
                document = db.query(DocumentData).filter(
                    DocumentData.document_no == document_no
                ).first()
                
                if not document:
                    print(f"Document {document_no} not found, skipping...")
                    continue
                
                # UPDATE document_data with gate_entry_no
                document.gate_entry_no = gate_entry_no
                
                # CREATE insights_data entry
                insight_record = InsightsData(
                    gate_entry_no=gate_entry_no,
                    document_type=document.document_type or "",
                    sub_document_type=document.sub_document_type or "",
                    document_no=document.document_no,
                    vehicle_no=document.vehicle_no or vehicle_no,
                    date=now.date(),
                    time=now.time(),
                    movement_type=entry.gate_type,
                    remarks=entry.remarks or f"Gate entry for {document_no}",
                    warehouse_code=current_user.warehouse_code,
                    site_code=current_user.site_code,
                    security_name=security_name,
                    security_username=security_username,
                    document_date=document.document_date,
                    edit_count=0
                )
                
                db.add(insight_record)
                records_processed += 1
                
                processed_documents.append({
                    "document_no": document.document_no,
                    "document_type": document.document_type,
                    "vehicle_no": document.vehicle_no,
                    "status": "success"
                })
                
            except Exception as doc_error:
                print(f"Error processing document {document_no}: {str(doc_error)}")
                processed_documents.append({
                    "document_no": document_no,
                    "status": "error",
                    "error": str(doc_error)
                })
                continue
        
        if records_processed > 0:
            db.commit()
            
            return {
                "message": f"Successfully processed {records_processed} records",
                "gate_entry_no": gate_entry_no,
                "records_processed": records_processed,
                "total_requested": len(entry.document_nos),
                "processed_documents": processed_documents,
                "date": now.isoformat(),
                "vehicle_no": vehicle_no,
                "movement_type": entry.gate_type
            }
        else:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="No documents were processed successfully"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Batch gate entry error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

@router.post("/enhanced-manual-gate-entry", response_model=GateEntryResponse)
def create_enhanced_manual_gate_entry(
    entry: EnhancedManualGateEntryCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Enhanced manual gate entry with operational data capture"""
    
    try:
        if not entry.vehicle_no.strip():
            raise HTTPException(status_code=400, detail="Vehicle number is required")
        
        vehicle_no = entry.vehicle_no.strip().upper()
        
        # Check GATE IN/OUT SEQUENCE VALIDATION
        last_entry = db.query(InsightsData).filter(
            InsightsData.vehicle_no == vehicle_no
        ).order_by(InsightsData.date.desc(), InsightsData.time.desc()).first()

        # ✅ NEW: Handle first-time vehicle (no history)
        if not last_entry:
            # First-time vehicle - only Gate-In allowed
            if entry.gate_type == "Gate-Out":
                raise HTTPException(
                    status_code=400,
                    detail=f"First entry for vehicle {vehicle_no} must be Gate-In. Cannot do Gate-Out without prior Gate-In."
                )
            # Gate-In is allowed for first-time vehicles - no validation needed
        else:
            # ✅ EXISTING: Vehicle has history - apply alternating sequence validation
            if last_entry.movement_type == entry.gate_type:
                if entry.gate_type == "Gate-In":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Vehicle {vehicle_no} already has Gate-In on {last_entry.date}. Must do Gate-Out first."
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Vehicle {vehicle_no} already has Gate-Out on {last_entry.date}. Must do Gate-In first."
                    )
        
        # Generate gate entry number
        gate_entry_no = generate_gate_entry_no_for_user(current_user.username)
        
        if not gate_entry_no:
            user_details = fetch_user_details(current_user.username)
            if user_details and user_details.get('warehouse_code'):
                from app.utils.helpers import generate_gate_entry_number
                gate_entry_no = generate_gate_entry_number(user_details['warehouse_code'])
            
            if not gate_entry_no:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to generate gate entry number. Please check user warehouse assignment."
                )
        
        now = datetime.now()
        to_warehouse_code = None        
        # NEW: Process operational data
        operational_data = {}
        if entry.driver_name and entry.driver_name.strip():
            operational_data['driver_name'] = entry.driver_name.strip()
        
        if entry.km_reading and entry.km_reading.strip():
            km_reading = entry.km_reading.strip()
            if km_reading.isdigit() and 3 <= len(km_reading) <= 6:
                operational_data['km_reading'] = km_reading
        
        if entry.loader_names and entry.loader_names.strip():
            operational_data['loader_names'] = entry.loader_names.strip()
        
        # CREATE insights_data entry with operational data
        insight_record = InsightsData(
            gate_entry_no=gate_entry_no,
            document_type=entry.document_type or "Manual Entry",
            sub_document_type="Manual Entry",
            vehicle_no=vehicle_no,
            date=now.date(),
            time=now.time(),
            movement_type=entry.gate_type,
            remarks=entry.remarks or f"Manual {entry.gate_type} for {vehicle_no}",
            warehouse_code=current_user.warehouse_code,
            site_code=current_user.site_code,
            security_name=f"{current_user.first_name} {current_user.last_name}",
            security_username=current_user.username,
            # NEW: Include operational data
            driver_name=operational_data.get('driver_name'),
            km_reading=operational_data.get('km_reading'),
            loader_names=operational_data.get('loader_names'),
            edit_count=0,
            last_edited_at=now if operational_data else None
        )
        
        db.add(insight_record)
        db.commit()
        
        return GateEntryResponse(
            gate_entry_no=gate_entry_no,
            date=now,
            time=now,
            vehicle_no=vehicle_no,
            document_no=f"MANUAL-{gate_entry_no}",
            warehouse_name=f"Warehouse-{current_user.warehouse_code}",
            movement_type=entry.gate_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Enhanced manual entry error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

@router.post("/manual-gate-entry", response_model=GateEntryResponse)
def create_manual_gate_entry(
    entry: ManualGateEntryCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Manual gate entry with RAW SQL gate entry number generation"""
    
    try:
        if not entry.vehicle_no.strip():
            raise HTTPException(status_code=400, detail="Vehicle number is required")
        
        vehicle_no = entry.vehicle_no.strip().upper()
        
        # Check GATE IN/OUT SEQUENCE VALIDATION
        last_entry = db.query(InsightsData).filter(
            InsightsData.vehicle_no == vehicle_no
        ).order_by(InsightsData.date.desc(), InsightsData.time.desc()).first()

        # ✅ NEW: Handle first-time vehicle (no history)
        if not last_entry:
            # First-time vehicle - only Gate-In allowed
            if entry.gate_type == "Gate-Out":
                raise HTTPException(
                    status_code=400,
                    detail=f"First entry for vehicle {vehicle_no} must be Gate-In. Cannot do Gate-Out without prior Gate-In."
                )
            # Gate-In is allowed for first-time vehicles - no validation needed
        else:
            # ✅ EXISTING: Vehicle has history - apply alternating sequence validation
            if last_entry.movement_type == entry.gate_type:
                if entry.gate_type == "Gate-In":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Vehicle {vehicle_no} already has Gate-In on {last_entry.date}. Must do Gate-Out first."
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Vehicle {vehicle_no} already has Gate-Out on {last_entry.date}. Must do Gate-In first."
                    )
        
        # RAW SQL: Generate gate entry number using fresh database data
        gate_entry_no = generate_gate_entry_no_for_user(current_user.username)
        
        if not gate_entry_no:
            # Fallback: Get fresh user details and try again
            user_details = fetch_user_details(current_user.username)
            if user_details and user_details.get('warehouse_code'):
                from app.utils.helpers import generate_gate_entry_number
                gate_entry_no = generate_gate_entry_number(user_details['warehouse_code'])
            
            if not gate_entry_no:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to generate gate entry number. Please check user warehouse assignment."
                )
        
        now = datetime.now()
        
        # Get warehouse name safely
        to_warehouse_code = None        
        # ONLY CREATE insights_data entry
        insight_record = InsightsData(
            gate_entry_no=gate_entry_no,
            document_type=entry.document_type or "Manual Entry",
            sub_document_type="Manual Entry",
            vehicle_no=vehicle_no,
            date=now.date(),
            time=now.time(),
            movement_type=entry.gate_type,
            remarks=entry.remarks or f"Manual {entry.gate_type} for {vehicle_no}",
            warehouse_code=current_user.warehouse_code,
            site_code=current_user.site_code,
            security_name=f"{current_user.first_name} {current_user.last_name}",
            security_username=current_user.username,
            edit_count=0
        )
        
        db.add(insight_record)
        db.commit()
        
        return GateEntryResponse(
            gate_entry_no=gate_entry_no,
            date=now,
            time=now,
            vehicle_no=vehicle_no,
            document_no=f"MANUAL-{gate_entry_no}",
            warehouse_name=f"Warehouse-{current_user.warehouse_code}",
            movement_type=entry.gate_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Manual entry error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

# NEW: Get unassigned documents for vehicle
@router.get("/unassigned-documents/{vehicle_no}")
def get_unassigned_documents_for_vehicle(
    vehicle_no: str,
    hours_back: int = 24,  # Default 24 hour, can be made configurable
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get unassigned documents for a vehicle within specified time window"""
    
    if not vehicle_no.strip():
        raise HTTPException(status_code=400, detail="Vehicle number cannot be empty")
    
    clean_vehicle_no = vehicle_no.strip().upper()
    
    try:
        # Calculate time window
        time_threshold = datetime.now() - timedelta(hours=hours_back)
        
        # Query for unassigned documents
        query = text("""
            SELECT 
                document_no,
                document_type,
                sub_document_type,
                document_date,
                vehicle_no,
                warehouse_name,
                warehouse_code,
                customer_name,
                customer_code,
                total_quantity,
                transporter_name,
                e_way_bill_no,
                route_code,
                route_no,
                site,
                direct_dispatch,
                salesman,
                from_warehouse_code,
                to_warehouse_code,
                irn_no
            FROM document_data
            WHERE vehicle_no = :vehicle_no
              AND document_date >= :time_threshold
              AND (gate_entry_no IS NULL OR gate_entry_no = '')
            ORDER BY document_date DESC
        """)
        
        result = db.execute(query, {
            "vehicle_no": clean_vehicle_no,
            "time_threshold": time_threshold
        })
        documents = result.fetchall()
        
        document_list = []
        for doc in documents:
            document_list.append({
                "document_no": doc.document_no,
                "document_type": doc.document_type,
                "sub_document_type": doc.sub_document_type,
                "document_date": doc.document_date.isoformat() if doc.document_date else None,
                "vehicle_no": doc.vehicle_no,
                "warehouse_name": doc.warehouse_name,
                "warehouse_code": doc.warehouse_code,
                "customer_name": doc.customer_name,
                "customer_code": doc.customer_code,
                "total_quantity": doc.total_quantity,
                "transporter_name": doc.transporter_name,
                "e_way_bill_no": doc.e_way_bill_no,
                "route_code": doc.route_code,
                "route_no": doc.route_no,
                "site": doc.site,
                "direct_dispatch": doc.direct_dispatch,
                "salesman": doc.salesman,
                "from_warehouse_code": doc.from_warehouse_code,
                "to_warehouse_code": doc.to_warehouse_code,
                "irn_no": doc.irn_no,
                "age_hours": (datetime.now() - doc.document_date).total_seconds() / 3600 if doc.document_date else None
            })
        
        return {
            "vehicle_no": clean_vehicle_no,
            "time_window_hours": hours_back,
            "search_time": datetime.now().isoformat(),
            "available_count": len(document_list),
            "documents": document_list
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching unassigned documents: {str(e)}"
        )

# NEW: Assign document to manual entry
@router.post("/assign-document-to-manual-entry")
def assign_document_to_manual_entry(
    assignment_data: dict,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Assign a document from document_data to a manual insights entry"""
    
    try:
        insights_id = assignment_data.get('insights_id')
        document_no = assignment_data.get('document_no')
        
        if not insights_id or not document_no:
            raise HTTPException(
                status_code=400, 
                detail="Both insights_id and document_no are required"
            )
        
        # Start transaction
        # 1. Get the insights record
        insights_record = db.query(InsightsData).filter(
            InsightsData.id == insights_id
        ).first()
        
        if not insights_record:
            raise HTTPException(status_code=404, detail="Manual entry not found")
        
        # 2. Get the document record
        document_record = db.query(DocumentData).filter(
            DocumentData.document_no == document_no
        ).first()
        
        if not document_record:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # 3. Check if document is already assigned
        if document_record.gate_entry_no:
            raise HTTPException(
                status_code=400, 
                detail=f"Document {document_no} is already assigned to gate entry {document_record.gate_entry_no}"
            )
        
        # 4. Check if insights record is already assigned
        if insights_record.document_type != "Manual Entry - Pending Assignment":
            raise HTTPException(
                status_code=400,
                detail="This manual entry has already been assigned a document"
            )
        
        # 5. Perform the assignment
        # Update insights record with document details
        insights_record.document_type = document_record.document_type or "Assigned Document"
        insights_record.sub_document_type = document_record.sub_document_type
        insights_record.document_no = document_record.document_no
        insights_record.document_date = document_record.document_date
        insights_record.remarks = f"Assigned document {document_no} | Original: {insights_record.remarks}"
        insights_record.last_edited_at = datetime.now()
        insights_record.edit_count = (insights_record.edit_count or 0) + 1
        
        # Update document record with gate entry number
        document_record.gate_entry_no = insights_record.gate_entry_no
        
        db.commit()
        
        return {
            "message": "Document assigned successfully",
            "insights_id": insights_id,
            "document_no": document_no,
            "gate_entry_no": insights_record.gate_entry_no,
            "assigned_at": datetime.now().isoformat(),
            "updated_insights": {
                "document_type": insights_record.document_type,
                "document_date": insights_record.document_date.isoformat() if insights_record.document_date else None,
                "edit_count": insights_record.edit_count
            },
            "updated_document": {
                "gate_entry_no": document_record.gate_entry_no
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Document assignment error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Assignment failed: {str(e)}"
        )

@router.get("/documents/{vehicle_no}")
def get_documents_by_vehicle(
    vehicle_no: str,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Enhanced document search by vehicle number"""
    
    if not vehicle_no.strip():
        raise HTTPException(status_code=400, detail="Vehicle number cannot be empty")
    
    clean_vehicle_no = vehicle_no.strip().upper()
    
    documents = db.query(DocumentData).filter(
        DocumentData.vehicle_no.ilike(f"%{clean_vehicle_no}%")
    ).all()
    
    if not documents:
        raise HTTPException(
            status_code=404, 
            detail=f"No documents found for vehicle: {vehicle_no}"
        )
    
    return [
        {
            "document_no": doc.document_no,
            "document_type": doc.document_type,
            "sub_document_type": doc.sub_document_type,
            "document_date": doc.document_date,
            "vehicle_no": doc.vehicle_no,
            "to_warehouse_code": doc.to_warehouse_code,  # CHANGED: Use this instead
            "warehouse_code": doc.warehouse_code,
            "customer_name": doc.customer_name,
            "customer_code": doc.customer_code,
            "total_quantity": doc.total_quantity,
            "transporter_name": doc.transporter_name,
            "e_way_bill_no": doc.e_way_bill_no,
            "route_code": doc.route_code,
            "site": doc.site,
            "direct_dispatch": doc.direct_dispatch,
            "salesman": doc.salesman,
            "gate_entry_no": doc.gate_entry_no
        }
        for doc in documents
    ]

@router.get("/vehicle-history/{vehicle_no}")
def get_vehicle_history(
    vehicle_no: str,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get complete movement history for a vehicle"""
    
    clean_vehicle_no = vehicle_no.strip().upper()
    
    movements = db.query(InsightsData).filter(
        InsightsData.vehicle_no.ilike(f"%{clean_vehicle_no}%")
    ).order_by(InsightsData.date.desc(), InsightsData.time.desc()).all()
    
    if not movements:
        raise HTTPException(
            status_code=404,
            detail=f"No movement history found for vehicle: {vehicle_no}"
        )
    
    return {
        "vehicle_no": clean_vehicle_no,
        "total_movements": len(movements),
        "history": [
            {
                "gate_entry_no": move.gate_entry_no,
                "date": move.date,
                "time": move.time,
                "movement_type": move.movement_type,
                "warehouse_name": move.warehouse_name,
                "document_type": move.document_type,
                "security_name": move.security_name,
                "remarks": move.remarks,
                # NEW: Include operational data in history
                "driver_name": move.driver_name,
                "km_reading": move.km_reading,
                "loader_names": move.loader_names,
                "edit_count": move.edit_count or 0
            }
            for move in movements
        ]
    }

@router.get("/operational-summary")
def get_operational_data_summary(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Get summary of operational data completion rates"""
    try:
        # Base query with warehouse filter
        base_query = db.query(InsightsData)
        if current_user.role != "Admin":
            base_query = base_query.filter(
                InsightsData.warehouse_code == current_user.warehouse_code
            )
        
        # Get records from last 7 days
        seven_days_ago = datetime.now() - timedelta(days=7)
        recent_records = base_query.filter(
            InsightsData.date >= seven_days_ago.date()
        ).all()
        
        if not recent_records:
            return {
                "total_records": 0,
                "completion_stats": {},
                "recommendations": []
            }
        
        # Calculate completion statistics
        total_records = len(recent_records)
        complete_operational = 0
        missing_driver = 0
        missing_km = 0
        missing_loaders = 0
        multiple_edits = 0
        
        for record in recent_records:
            # Check operational completeness
            if (record.driver_name and record.driver_name.strip() and
                record.km_reading and record.km_reading.strip() and
                record.loader_names and record.loader_names.strip()):
                complete_operational += 1
            
            # Count missing fields
            if not (record.driver_name and record.driver_name.strip()):
                missing_driver += 1
            if not (record.km_reading and record.km_reading.strip()):
                missing_km += 1
            if not (record.loader_names and record.loader_names.strip()):
                missing_loaders += 1
            
            # Count records with multiple edits
            if (record.edit_count or 0) > 1:
                multiple_edits += 1
        
        completion_percentage = (complete_operational / total_records * 100) if total_records > 0 else 0
        
        # Generate recommendations
        recommendations = []
        if completion_percentage < 50:
            recommendations.append("Consider capturing operational data during initial gate entry")
        if missing_driver > total_records * 0.3:
            recommendations.append("Focus on capturing driver names during vehicle entry")
        if missing_km > total_records * 0.4:
            recommendations.append("Emphasize KM reading collection for journey tracking")
        if missing_loaders > total_records * 0.5:
            recommendations.append("Improve loader name documentation for operational efficiency")
        
        return {
            "total_records": total_records,
            "completion_stats": {
                "complete_operational": complete_operational,
                "completion_percentage": round(completion_percentage, 1),
                "missing_driver": missing_driver,
                "missing_km": missing_km,
                "missing_loaders": missing_loaders,
                "multiple_edits": multiple_edits
            },
            "recommendations": recommendations,
            "period": "Last 7 days"
        }
        
    except Exception as e:
        print(f"Error getting operational summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Summary error: {str(e)}")

# Updated Multi-Document Manual Entry Endpoint - gate.py
# ✅ UPDATED: Multi-document manual entry endpoint with Empty Vehicle Support

@router.post("/multi-document-manual-entry")
def create_multi_document_manual_entry(
    entry: MultiDocumentManualEntryCreate,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user)
):
    """Create multiple manual gate entries with same gate entry number OR single empty vehicle entry"""
    
    try:
        if not entry.vehicle_no.strip():
            raise HTTPException(status_code=400, detail="Vehicle number is required")
        
        vehicle_no = entry.vehicle_no.strip().upper()
        
        # Check GATE IN/OUT SEQUENCE VALIDATION
        last_entry = db.query(InsightsData).filter(
            InsightsData.vehicle_no == vehicle_no
        ).order_by(InsightsData.date.desc(), InsightsData.time.desc()).first()
        
        if last_entry:
            if last_entry.movement_type == entry.gate_type:
                if entry.gate_type == "Gate-In":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Vehicle {vehicle_no} already has Gate-In. Must do Gate-Out first."
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Vehicle {vehicle_no} already has Gate-Out. Must do Gate-In first."
                    )
        
        # Generate gate entry number (same for all entries)
        gate_entry_no = generate_gate_entry_no_for_user(current_user.username)
        
        if not gate_entry_no:
            user_details = fetch_user_details(current_user.username)
            if user_details and user_details.get('warehouse_code'):
                from app.utils.helpers import generate_gate_entry_number
                gate_entry_no = generate_gate_entry_number(user_details['warehouse_code'])
            
            if not gate_entry_no:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to generate gate entry number. Please check user warehouse assignment."
                )
        
        now = datetime.now()
        to_warehouse_code = None        
        # ✅ NEW: Handle Empty Vehicle Scenario (no_of_documents = 0)
        if entry.no_of_documents == 0:
            # Create SINGLE entry with "EMPTY VEHICLE" document type
            insight_record = InsightsData(
                gate_entry_no=gate_entry_no,
                document_type="EMPTY VEHICLE",  # ✅ NEW: Special document type for empty vehicles
                sub_document_type="Empty Vehicle",
                vehicle_no=vehicle_no,
                date=now.date(),
                time=now.time(),
                movement_type=entry.gate_type,
                remarks=entry.remarks or f"Empty vehicle {entry.gate_type} for {vehicle_no}",
                warehouse_code=current_user.warehouse_code,
                site_code=current_user.site_code,
                security_name=f"{current_user.first_name} {current_user.last_name}",
                security_username=current_user.username,
                document_date=now,  # Use gate entry date
                edit_count=0,
                # Empty vehicles don't need document assignment
                driver_name=None,
                km_reading=None,
                loader_names=None
            )
            
            db.add(insight_record)
            created_entries = [{
                "sequence": 1,
                "gate_entry_no": gate_entry_no,
                "vehicle_no": vehicle_no,
                "document_type": "EMPTY VEHICLE",
                "status": "complete"  # Empty vehicle entries are complete by default
            }]
            
            entries_created = 1
            next_step = "Empty vehicle recorded - no further action needed"
            entry_type = "empty_vehicle"
            
        else:
            # ✅ EXISTING: CREATE multiple insights_data entries for manual documents
            created_entries = []
            for i in range(entry.no_of_documents):
                insight_record = InsightsData(
                    gate_entry_no=gate_entry_no,
                    document_type="Manual Entry - Pending Assignment",  # Clear status for manual entries
                    sub_document_type="Manual Entry",
                    vehicle_no=vehicle_no,
                    date=now.date(),
                    time=now.time(),
                    movement_type=entry.gate_type,
                    remarks=entry.remarks or f"Manual {entry.gate_type} for {vehicle_no} - Document {i+1} of {entry.no_of_documents}",
                    warehouse_code=current_user.warehouse_code,
                    site_code=current_user.site_code,
                    security_name=f"{current_user.first_name} {current_user.last_name}",
                    security_username=current_user.username,
                    document_date=now,  # Gate entry date, not document date
                    edit_count=0,
                    # Mark as unassigned - these need document assignment
                    driver_name=None,
                    km_reading=None,
                    loader_names=None
                )
                
                db.add(insight_record)
                created_entries.append({
                    "sequence": i + 1,
                    "gate_entry_no": gate_entry_no,
                    "vehicle_no": vehicle_no,
                    "document_type": "Manual Entry - Pending Assignment",
                    "status": "pending_assignment"
                })
            
            entries_created = entry.no_of_documents
            next_step = "Assign documents from insights tab when available"
            entry_type = "manual"
        
        db.commit()
        
        # ✅ UPDATED: Enhanced response with empty vehicle support
        return {
            "message": f"Successfully created {entries_created} {entry_type.replace('_', ' ')} entr{'y' if entries_created == 1 else 'ies'}",
            "gate_entry_no": gate_entry_no,
            "vehicle_no": vehicle_no,
            "entries_created": entries_created,
            "movement_type": entry.gate_type,
            "date": now.isoformat(),
            "created_entries": created_entries,
            "next_step": next_step,
            "entry_type": entry_type,  # ✅ NEW: "empty_vehicle" or "manual"
            "is_empty_vehicle": entry.no_of_documents == 0  # ✅ NEW: Flag for frontend
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Multi-document manual entry error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )