# app/routers/ping.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db

router = APIRouter(prefix="/ping", tags=["Ping"])

@router.get("/db")
def ping_db(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        return {"status": "success", "message": "Database connection is healthy!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}