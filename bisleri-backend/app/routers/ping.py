# app/routers/ping.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.utils.errors import log_exception

router = APIRouter(prefix="/ping", tags=["Ping"])

@router.get("/db")
def ping_db(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        return {"status": "success", "message": "Database connection is healthy!"}
    except Exception:
        ref = log_exception("DB health check failed")
        return {"status": "error", "message": f"Database connection failed (ref: {ref})"}