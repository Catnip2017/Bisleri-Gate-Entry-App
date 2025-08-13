from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user
from app.models import UsersMaster
from app.services.db_service import DBService

router = APIRouter(tags=["Document Management"])

@router.post("/consolidate-documents", summary="Manually consolidate base tables into document_data")
def consolidate_document_data(current_user: UsersMaster = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can trigger consolidation")

    db_service = DBService()
    success = db_service.push_to_document_data()
    
    if success:
        count = db_service.get_document_data_count()
        return {"status": "success", "message": "Data consolidated", "document_data_rows": count}
    else:
        raise HTTPException(status_code=500, detail="Failed to consolidate document data")