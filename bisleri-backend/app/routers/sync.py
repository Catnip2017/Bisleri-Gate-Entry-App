from fastapi import APIRouter, HTTPException
from app.services.data_sync_service import data_sync_service

router = APIRouter(prefix="/sync", tags=["sync"])

@router.post("/manual")
async def manual_sync():
    """Manually trigger data sync from mfabric tables to document_data"""
    try:
        success = data_sync_service.push_to_document_data()
        if success:
            return {"message": "Data sync completed successfully", "status": "success"}
        else:
            raise HTTPException(status_code=500, detail="Data sync failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")

@router.get("/status")
async def sync_status():
    """Get current sync status and record counts"""
    try:
        status = data_sync_service.get_sync_status()
        if status:
            return status
        else:
            raise HTTPException(status_code=500, detail="Could not retrieve sync status")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status error: {str(e)}")

@router.get("/logs")
async def get_sync_logs():
    """Get recent sync logs"""
    try:
        with open("sync_log.txt", "r") as f:
            logs = f.read().split('\n')
            # Return last 50 lines
            return {"logs": logs[-50:]}
    except FileNotFoundError:
        return {"logs": ["No logs available yet"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading logs: {str(e)}")