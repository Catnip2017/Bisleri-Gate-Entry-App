# app/routers/copacker.py
"""
Co Packer feature router — all endpoints under /copacker prefix.
Protected by JWT (get_current_user) unless explicitly noted.
"""
import os
import re
import logging
from datetime import date, datetime
from typing import List, Optional

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException,
    Query, UploadFile, status
)
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import UsersMaster
from app.models.copacker import (
    CopackerAsset, CopackerEntry, CopackerLocation, CopackerQuantityEditLog, ItemMaster
)
from app.schemas.copacker_schemas import (
    AssetResponse, EditLogResponse, EditQuantityRequest,
    EditQuantityResponse, EntryResponse, FeatureStatusResponse,
    LocationResponse, RegisterAssetRequest, RegisterLocationRequest, SKUItem
)
from app.services.watsonx_ocr import extract_quantity_from_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copacker", tags=["Co Packer"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


# ── helpers ──────────────────────────────────────────────────────────────────
def normalize_roles(role_string: str) -> List[str]:
    if not role_string:
        return []
    return [r.strip().lower().replace(" ", "") for r in role_string.split(",") if r.strip()]


def require_roles(current_user: UsersMaster, allowed: List[str]):
    roles = normalize_roles(current_user.role)
    if not any(r in allowed for r in roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Required roles: {allowed}. Your roles: {current_user.role}"
        )


def sanitize_path_segment(value: str) -> str:
    """Make a string safe for use as a filesystem path segment."""
    return re.sub(r'[^\w\-.]', '_', value.strip())


# ── 1. Feature status ────────────────────────────────────────────────────────
@router.get("/feature-status", response_model=FeatureStatusResponse)
def feature_status(current_user: UsersMaster = Depends(get_current_user)):
    return {"enabled": settings.COPACKER_FEATURE_ENABLED}


# ── 2. Register location (IT Admin only) ─────────────────────────────────────
@router.post("/register-location", response_model=LocationResponse, status_code=201)
def register_location(
    payload: RegisterLocationRequest,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    require_roles(current_user, ["itadmin"])

    existing = db.query(CopackerLocation).filter(
        CopackerLocation.location_name.ilike(payload.location_name.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Location already exists.")

    loc = CopackerLocation(location_name=payload.location_name.strip())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


# ── 3. Search locations (proximity) ──────────────────────────────────────────
@router.get("/locations", response_model=List[LocationResponse])
def search_locations(
    q: Optional[str] = Query(default="", description="Search term"),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    query = db.query(CopackerLocation)
    if q and q.strip():
        query = query.filter(CopackerLocation.location_name.ilike(f"%{q.strip()}%"))
    return query.order_by(CopackerLocation.location_name).limit(20).all()


# ── 4. Register asset (IT Admin or CoPacker — own location only) ─────────────
@router.post("/register-asset", response_model=AssetResponse, status_code=201)
def register_asset(
    payload: RegisterAssetRequest,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    roles = normalize_roles(current_user.role)
    if not any(r in ["itadmin", "copacker"] for r in roles):
        raise HTTPException(status_code=403, detail="Access denied.")

    # CoPacker can only register assets for their own location
    if "copacker" in roles and "itadmin" not in roles:
        if (current_user.copacker_location or "").lower() != payload.location_name.strip().lower():
            raise HTTPException(
                status_code=403,
                detail="CoPacker can only register assets for their own location."
            )

    loc = db.query(CopackerLocation).filter(
        CopackerLocation.location_name.ilike(payload.location_name.strip())
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found.")

    # Check for duplicate line_no at this location
    existing = db.query(CopackerAsset).filter(
        CopackerAsset.location_id == loc.id,
        CopackerAsset.line_no == payload.line_no,
    ).first()
    if existing:
        # Update asset_model_id instead of raising error (re-mapping)
        existing.asset_model_id = payload.asset_model_id.strip()
        db.commit()
        db.refresh(existing)
        return existing

    asset = CopackerAsset(
        location_id=loc.id,
        line_no=payload.line_no,
        asset_model_id=payload.asset_model_id.strip(),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


# ── 5. Get assets for a location ─────────────────────────────────────────────
@router.get("/assets/{location_name}", response_model=List[AssetResponse])
def get_assets(
    location_name: str,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    loc = db.query(CopackerLocation).filter(
        CopackerLocation.location_name.ilike(location_name.strip())
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found.")

    assets = (
        db.query(CopackerAsset)
        .filter(CopackerAsset.location_id == loc.id)
        .order_by(CopackerAsset.line_no)
        .all()
    )
    return assets


# ── 6. SKU search ─────────────────────────────────────────────────────────────
@router.get("/sku-search", response_model=List[SKUItem])
def sku_search(
    q: str = Query(default="", description="Search term"),
    field: str = Query(default="name", description="'name' or 'itemid'"),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    if not q or not q.strip():
        return []

    search = f"%{q.strip()}%"

    # Use raw SQL to avoid SQLAlchemy quoting mixed-case column names incorrectly.
    # The actual DB columns are lowercase: item_number, product_name.
    if field == "itemid":
        rows = db.execute(
            text(
                "SELECT item_number, product_name FROM item_master "
                "WHERE item_number ILIKE :q LIMIT 20"
            ),
            {"q": search},
        ).fetchall()
    else:
        rows = db.execute(
            text(
                "SELECT item_number, product_name FROM item_master "
                "WHERE product_name ILIKE :q LIMIT 20"
            ),
            {"q": search},
        ).fetchall()

    return [
        SKUItem(item_number=row[0], product_name=row[1] or "")
        for row in rows
    ]


# ── 7. Submit entry (multipart) ───────────────────────────────────────────────
@router.post("/submit-entry", response_model=EntryResponse, status_code=201)
async def submit_entry(
    copacker_location: str = Form(...),
    line_no: int = Form(...),
    asset_model_id: str = Form(...),
    entry_date: str = Form(...),   # YYYY-MM-DD
    entry_time: str = Form(...),   # HH:MM:SS
    sku_name: Optional[str] = Form(default=None),
    sku_itemid: Optional[str] = Form(default=None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    roles = normalize_roles(current_user.role)
    if not any(r in ["itadmin", "copacker"] for r in roles):
        raise HTTPException(status_code=403, detail="Access denied.")

    # ── Validate image format ────────────────────────────────────────────────
    content_type = (image.content_type or "").lower()
    file_ext = os.path.splitext(image.filename or "")[1].lower()

    if content_type not in ALLOWED_IMAGE_TYPES and file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Only JPEG, JPG, and PNG files are accepted."
        )

    image_bytes = await image.read()

    # ── Parse date / time ────────────────────────────────────────────────────
    try:
        parsed_date = date.fromisoformat(entry_date)
        from datetime import time as dtime
        t_parts = entry_time.split(":")
        parsed_time = dtime(int(t_parts[0]), int(t_parts[1]), int(t_parts[2]) if len(t_parts) > 2 else 0)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date or time format.")

    if parsed_date > date.today():
        raise HTTPException(status_code=400, detail="Entry date cannot be in the future.")

    # ── Build image save path ────────────────────────────────────────────────
    loc_safe = sanitize_path_segment(copacker_location)
    asset_safe = sanitize_path_segment(asset_model_id)
    sku_safe = sanitize_path_segment(sku_itemid or "no_sku")
    year = parsed_date.strftime("%Y")
    month = parsed_date.strftime("%m")
    day = parsed_date.strftime("%d")
    timestamp_str = datetime.now().strftime("%Y%m%d%H%M%S%f")
    image_filename = f"{current_user.username}_{line_no}_{timestamp_str}.jpg"

    save_dir = os.path.join(
        settings.COPACKER_IMAGE_PATH,
        loc_safe, year, month, day, asset_safe, sku_safe
    )
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, image_filename)

    try:
        with open(save_path, "wb") as f:
            f.write(image_bytes)
    except Exception as e:
        logger.error(f"Failed to save image: {e}")
        raise HTTPException(status_code=500, detail="Failed to save image to server.")

    # Relative path for DB storage — always use forward slashes so the path
    # works as a URL segment regardless of the server OS (Windows uses \ but
    # browsers interpret \NNNN as escape sequences, corrupting the URL).
    relative_path = "/".join([loc_safe, year, month, day, asset_safe, sku_safe, image_filename])

    # ── OCR ──────────────────────────────────────────────────────────────────
    mime = "image/jpeg"
    if file_ext == ".png" or content_type == "image/png":
        mime = "image/png"
    extracted_qty = extract_quantity_from_image(image_bytes, mime)

    # ── Save entry ────────────────────────────────────────────────────────────
    entry = CopackerEntry(
        copacker_location=copacker_location.strip(),
        line_no=line_no,
        asset_model_id=asset_model_id.strip(),
        entry_date=parsed_date,
        entry_time=parsed_time,
        image_path=relative_path,
        sku_name=sku_name.strip() if sku_name else None,
        sku_itemid=sku_itemid.strip() if sku_itemid else None,
        username=current_user.username,
        extracted_quantity=extracted_qty,
        extracted_quantity_raw=extracted_qty,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


# ── 8. Get entries for a location + date ─────────────────────────────────────
@router.get("/entries", response_model=List[EntryResponse])
def get_entries(
    location: str = Query(..., description="CoPacker location name"),
    date_str: Optional[str] = Query(default=None, alias="date", description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    roles = normalize_roles(current_user.role)
    if not any(r in ["itadmin", "copacker"] for r in roles):
        raise HTTPException(status_code=403, detail="Access denied.")

    # CoPacker can only view entries for their own location
    if "copacker" in roles and "itadmin" not in roles:
        if (current_user.copacker_location or "").lower() != location.strip().lower():
            raise HTTPException(
                status_code=403,
                detail="CoPacker can only view entries for their own location."
            )

    parsed_date = date.today()
    if date_str:
        try:
            parsed_date = date.fromisoformat(date_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    entries = (
        db.query(CopackerEntry)
        .filter(
            CopackerEntry.copacker_location.ilike(location.strip()),
            CopackerEntry.entry_date == parsed_date,
        )
        .order_by(CopackerEntry.line_no, CopackerEntry.entry_time)
        .all()
    )
    return entries


# ── 9. Edit extracted quantity (entry owner, same calendar day) ───────────────
@router.put("/edit-quantity", response_model=EditQuantityResponse)
def edit_quantity(
    payload: EditQuantityRequest,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    entry = db.query(CopackerEntry).filter(CopackerEntry.id == payload.entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")

    # Only entry owner can edit
    if entry.username != current_user.username:
        raise HTTPException(
            status_code=403,
            detail="Only the user who created this entry can edit the quantity."
        )

    # Only same calendar day
    if entry.entry_date != date.today():
        raise HTTPException(
            status_code=403,
            detail="Quantity can only be edited on the same day the entry was created."
        )

    original_value = entry.extracted_quantity
    new_value = payload.new_quantity
    auto_remark = (
        f"Extracted value was {original_value}, "
        f"user {current_user.username} edited it to {new_value}."
    )

    # Save audit log
    log = CopackerQuantityEditLog(
        entry_id=entry.id,
        original_value=original_value,
        edited_value=new_value,
        edited_by=current_user.username,
        auto_remarks=auto_remark,
    )
    db.add(log)

    # Update entry
    entry.extracted_quantity = new_value
    db.commit()
    db.refresh(log)

    return EditQuantityResponse(
        entry_id=entry.id,
        original_value=original_value,
        new_value=new_value,
        auto_remarks=auto_remark,
        edited_by=current_user.username,
        edited_at=log.edited_at,
    )


# ── 10. Edit logs (IT Admin only) ─────────────────────────────────────────────
@router.get("/edit-logs", response_model=List[EditLogResponse])
def get_edit_logs(
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    require_roles(current_user, ["itadmin"])

    logs = (
        db.query(CopackerQuantityEditLog, CopackerEntry)
        .join(CopackerEntry, CopackerQuantityEditLog.entry_id == CopackerEntry.id)
        .order_by(CopackerQuantityEditLog.edited_at.desc())
        .all()
    )

    result = []
    for log, entry in logs:
        result.append(EditLogResponse(
            id=log.id,
            entry_id=log.entry_id,
            original_value=log.original_value,
            edited_value=log.edited_value,
            edited_by=log.edited_by,
            edited_at=log.edited_at,
            auto_remarks=log.auto_remarks,
            copacker_location=entry.copacker_location,
            line_no=entry.line_no,
            asset_model_id=entry.asset_model_id,
            entry_date=entry.entry_date,
            entry_username=entry.username,
        ))
    return result
