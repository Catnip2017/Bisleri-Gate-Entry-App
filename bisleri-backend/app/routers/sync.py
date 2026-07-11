from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.utils.errors import internal_error
from app.utils.roles import normalize_roles
from app.models import UsersMaster
from app.services.data_sync_service import data_sync_service

router = APIRouter(prefix="/sync", tags=["sync"])


def _require_itadmin(current_user: UsersMaster = Depends(get_current_user)) -> UsersMaster:
    """Dependency: rejects any caller who is not an IT Admin."""
    roles = normalize_roles(current_user.role)
    if "itadmin" not in roles:
        raise HTTPException(status_code=403, detail="Only IT Admins can access sync endpoints")
    return current_user


@router.post("/manual")
async def manual_sync(current_user: UsersMaster = Depends(_require_itadmin)):
    """Manually trigger the full mfabric → document_data sync (same logic as the auto-scheduler)."""
    try:
        import csv_to_DB as _sync  # noqa: N813
        _sync.push_to_document_data()
        return {"message": "Data sync completed successfully", "status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise internal_error("Sync error", e)


@router.get("/status")
async def sync_status(current_user: UsersMaster = Depends(_require_itadmin)):
    """Get current sync status and record counts."""
    try:
        status = data_sync_service.get_sync_status()
        if status:
            return status
        raise HTTPException(status_code=500, detail="Could not retrieve sync status")
    except HTTPException:
        raise
    except Exception as e:
        raise internal_error("Status error", e)


@router.get("/logs")
async def get_sync_logs(current_user: UsersMaster = Depends(_require_itadmin)):
    """Return the last 50 lines from the most recent sync log file."""
    # csv_to_DB.py writes to upload_log.txt; fall back to older log file names
    for log_file in ("upload_log.txt", "scheduler_log.txt", "sync_log.txt"):
        try:
            with open(log_file, "r", encoding="utf-8", errors="replace") as f:
                lines = f.read().splitlines()
                return {"logs": lines[-50:], "source": log_file}
        except FileNotFoundError:
            continue
    return {
        "logs": ["No log file found yet. Sync logs appear in the uvicorn console."],
        "source": None,
    }
