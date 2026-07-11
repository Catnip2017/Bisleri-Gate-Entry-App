from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user
from app.utils.roles import normalize_roles
from app.models import UsersMaster
from app.services.db_service import DBService

router = APIRouter(tags=["Document Management"])

@router.post("/consolidate-documents", summary="Manually consolidate base tables into document_data")
def consolidate_document_data(current_user: UsersMaster = Depends(get_current_user)):
    normalized_roles = normalize_roles(current_user.role)
    if "itadmin" not in normalized_roles:
        raise HTTPException(status_code=403, detail="Only IT Admins can trigger consolidation")

    db_service = DBService()
    success = db_service.push_to_document_data()
    
    if success:
        count = db_service.get_document_data_count()
        return {"status": "success", "message": "Data consolidated", "document_data_rows": count}
    else:
        raise HTTPException(status_code=500, detail="Failed to consolidate document data")