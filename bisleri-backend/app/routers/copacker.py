# app/routers/copacker.py
"""
Co Packer feature router — all endpoints under /copacker prefix.
Protected by JWT (get_current_user) unless explicitly noted.
"""
import json
import os
import re
import logging
from datetime import date, datetime, timezone, timedelta
from typing import List, Optional

# Indian Standard Time = UTC + 5:30
_IST = timezone(timedelta(hours=5, minutes=30))

def today_ist() -> date:
    """Return the current calendar date in IST (UTC+5:30)."""
    return datetime.now(_IST).date()

def created_at_to_ist_date(created_at: datetime) -> date:
    """Convert a naive UTC created_at timestamp to IST calendar date."""
    if created_at.tzinfo is None:
        # DB stores naive UTC datetimes
        utc_dt = created_at.replace(tzinfo=timezone.utc)
    else:
        utc_dt = created_at
    return utc_dt.astimezone(_IST).date()

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
    CopackerAsset, CopackerEntry, CopackerLocation, CopackerQuantityEditLog, ItemMaster,
    CopackerSession, CopackerCapture, CopackerCaptureEditLog,
)
from app.schemas.copacker_schemas import (
    AssetResponse, EditFieldRequest, EditFieldResponse,
    EditLogResponse, EditQuantityRequest, EditQuantityResponse,
    EntryResponse, FeatureStatusResponse,
    LocationResponse, RegisterAssetRequest, RegisterLocationRequest, SKUItem,
    CreateSessionRequest, SessionResponse, CaptureResponse,
    EditAssetRequest, EditAssetResponse, AssetHistoryItem,
)
from app.services.watsonx_ocr import (
    extract_quantity_from_image,
    extract_machine_data_from_image,
    extract_machine_data,
)

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
    return {
        "enabled": settings.COPACKER_FEATURE_ENABLED,
        "field_edit_enabled": settings.ENABLE_FIELD_EDIT,
    }


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

    if parsed_date > today_ist():
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

    # ── OCR — multi-field extraction ─────────────────────────────────────────
    mime = "image/jpeg"
    if file_ext == ".png" or content_type == "image/png":
        mime = "image/png"
    ocr_data = extract_machine_data_from_image(image_bytes, mime)

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
        # Legacy qty — set to bottles_total for backward compat
        extracted_quantity=ocr_data.get("bottles_total"),
        extracted_quantity_raw=ocr_data.get("bottles_total"),
        # New multi-field OCR values
        preform_total=ocr_data.get("preform_total"),
        preform_shift=ocr_data.get("preform_shift"),
        bottles_total=ocr_data.get("bottles_total"),
        bottles_shift=ocr_data.get("bottles_shift"),
        operating_hours=ocr_data.get("operating_hours"),
        recipe=ocr_data.get("recipe"),
        asset_model_no=ocr_data.get("asset_model_no"),
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

    parsed_date = today_ist()   # default to IST today if no date provided
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

    # Only same calendar day — check created_at in IST (submission time), not entry_date.
    # entry_date can be manually set to a past date; edit window is based on when submitted.
    # created_at is stored as naive UTC in DB — convert to IST before comparing.
    if created_at_to_ist_date(entry.created_at) != today_ist():
        raise HTTPException(
            status_code=403,
            detail="Quantity can only be edited on the day the entry was submitted."
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


# ── 10. Edit a single OCR field (entry owner, same calendar day) ─────────────
_INT_FIELDS  = {"preform_total", "preform_shift", "bottles_total",
                "bottles_shift", "operating_hours"}   # Phase 1 legacy entry fields
_TEXT_FIELDS = {"recipe", "asset_model_no"}
_ALLOWED_EDIT_FIELDS = _INT_FIELDS | _TEXT_FIELDS


@router.put("/edit-field", response_model=EditFieldResponse)
def edit_field(
    payload: EditFieldRequest,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    if payload.field_name not in _ALLOWED_EDIT_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid field_name. Allowed: {sorted(_ALLOWED_EDIT_FIELDS)}"
        )

    entry = db.query(CopackerEntry).filter(CopackerEntry.id == payload.entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")

    if entry.username != current_user.username:
        raise HTTPException(
            status_code=403,
            detail="Only the user who created this entry can edit it."
        )

    if created_at_to_ist_date(entry.created_at) != today_ist():
        raise HTTPException(
            status_code=403,
            detail="Fields can only be edited on the day the entry was submitted."
        )

    # Current value
    original_raw = getattr(entry, payload.field_name, None)
    original_text = str(original_raw) if original_raw is not None else None

    # Parse and validate new value
    if payload.field_name in _INT_FIELDS:
        try:
            new_val = int(str(payload.new_value).replace(",", "").strip())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"'{payload.field_name}' must be a valid integer."
            )
    else:
        new_val = payload.new_value.strip()

    auto_remark = (
        f"Field '{payload.field_name}' changed from '{original_text}' "
        f"to '{new_val}' by {current_user.username}."
    )

    # Audit log
    log = CopackerQuantityEditLog(
        entry_id=entry.id,
        original_value=None,
        edited_value=None,
        edited_by=current_user.username,
        auto_remarks=auto_remark,
        field_name=payload.field_name,
        original_text_value=original_text,
        edited_text_value=str(new_val),
    )
    db.add(log)

    # Update entry
    setattr(entry, payload.field_name, new_val)

    # Keep bottles_total in sync with legacy extracted_quantity
    if payload.field_name == "bottles_total":
        entry.extracted_quantity = new_val

    db.commit()
    db.refresh(log)

    return EditFieldResponse(
        entry_id=entry.id,
        field_name=payload.field_name,
        original_value=original_text,
        new_value=str(new_val),
        auto_remarks=auto_remark,
        edited_by=current_user.username,
        edited_at=log.edited_at,
    )


# ── 11. Edit logs (IT Admin only) ─────────────────────────────────────────────
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


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 2 — Session-based 4-machine capture system
# ═══════════════════════════════════════════════════════════════════════════════

# Step order → capture type mapping (fixed, cannot be skipped or reordered)
_STEP_CAPTURE_TYPES = {
    1: "blow_molder",
    2: "bottling",
    3: "labelling",
    4: "case_counter",
}


# ── 12. Create session ─────────────────────────────────────────────────────────
@router.post("/session/create", response_model=SessionResponse, status_code=201)
def create_session(
    payload: CreateSessionRequest,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    roles = normalize_roles(current_user.role)
    if not any(r in ["itadmin", "copacker"] for r in roles):
        raise HTTPException(status_code=403, detail="Access denied.")

    session = CopackerSession(
        copacker_location=payload.copacker_location.strip(),
        line_no=payload.line_no,
        sku_name=payload.sku_name.strip() if payload.sku_name else None,
        sku_item_id=payload.sku_item_id.strip() if payload.sku_item_id else None,
        shift_no=payload.shift_no,
        shift_start_time=payload.shift_start_time.strip() if payload.shift_start_time else None,
        shift_end_time=payload.shift_end_time.strip() if payload.shift_end_time else None,
        submitted_by=current_user.username,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# ── 13. Submit capture (one of 4 steps) ───────────────────────────────────────
@router.post("/session/{session_id}/capture", response_model=CaptureResponse, status_code=201)
async def submit_capture(
    session_id: int,
    asset_model_id: str = Form(default=""),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    roles = normalize_roles(current_user.role)
    if not any(r in ["itadmin", "copacker"] for r in roles):
        raise HTTPException(status_code=403, detail="Access denied.")

    # ── Validate session ────────────────────────────────────────────────────
    session = db.query(CopackerSession).filter(CopackerSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.submitted_by != current_user.username:
        raise HTTPException(status_code=403, detail="Not your session.")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Session already completed.")

    # ── Determine step from existing captures ───────────────────────────────
    existing_count = (
        db.query(CopackerCapture)
        .filter(CopackerCapture.session_id == session_id)
        .count()
    )
    step_order = existing_count + 1
    if step_order > 4:
        raise HTTPException(status_code=400, detail="All 4 captures already submitted.")

    capture_type = _STEP_CAPTURE_TYPES[step_order]

    # ── Validate image ──────────────────────────────────────────────────────
    content_type = (image.content_type or "").lower()
    file_ext = os.path.splitext(image.filename or "")[1].lower()
    if content_type not in ALLOWED_IMAGE_TYPES and file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Only JPEG, JPG, PNG accepted."
        )

    image_bytes = await image.read()

    # ── Save image ──────────────────────────────────────────────────────────
    now_ist    = datetime.now(_IST)
    loc_safe   = sanitize_path_segment(session.copacker_location)
    year       = now_ist.strftime("%Y")
    month      = now_ist.strftime("%m")
    day        = now_ist.strftime("%d")
    ts         = datetime.now().strftime("%Y%m%d%H%M%S%f")
    img_name   = f"step{step_order}_{current_user.username}_{ts}.jpg"

    save_dir = os.path.join(
        settings.COPACKER_IMAGE_PATH,
        "sessions", loc_safe, year, month, day, str(session_id)
    )
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, img_name)
    try:
        with open(save_path, "wb") as f:
            f.write(image_bytes)
    except Exception as e:
        logger.error(f"Failed to save capture image: {e}")
        raise HTTPException(status_code=500, detail="Failed to save image to server.")

    # Always forward slashes for DB (Windows backslash → URL corruption)
    relative_path = "/".join(
        ["sessions", loc_safe, year, month, day, str(session_id), img_name]
    )

    # ── OCR ────────────────────────────────────────────────────────────────
    mime = "image/png" if (file_ext == ".png" or content_type == "image/png") else "image/jpeg"
    ocr_data = extract_machine_data(image_bytes, mime, capture_type)
    ocr_raw  = json.dumps(ocr_data)

    # Asset ID: user-provided form value takes priority over OCR
    asset_from_ocr  = ocr_data.get("asset_number")
    final_asset_id  = asset_model_id.strip() or asset_from_ocr or None

    # ── Build capture record ────────────────────────────────────────────────
    cap = CopackerCapture(
        session_id     = session_id,
        step_order     = step_order,
        capture_type   = capture_type,
        asset_model_id = final_asset_id,
        image_path     = relative_path,
        ocr_raw        = ocr_raw,
        captured_by    = current_user.username,
    )

    if capture_type == "blow_molder":
        cap.bottle_recipe                  = ocr_data.get("bottle_recipe")
        cap.last_hour_production_count     = ocr_data.get("last_hour_production_count")
        cap.production_count_current_batch = ocr_data.get("production_count_current_batch")
        cap.total_production_count         = ocr_data.get("total_production_count")
        cap.good_bottles_count             = ocr_data.get("good_bottles_count")
        cap.preforms_processed_count       = ocr_data.get("preforms_processed_count")
        cap.target_batch_quantity          = ocr_data.get("target_batch_quantity")
    elif capture_type == "bottling":
        cap.bottles_total        = ocr_data.get("total_bottles")
        cap.production_speed_bph = ocr_data.get("production_speed_bph")
    elif capture_type == "labelling":
        cap.labels_count = ocr_data.get("labels_count")
        cap.label_format = ocr_data.get("format")
    elif capture_type == "case_counter":
        cap.packs_counter = ocr_data.get("packs_counter")
        cap.pack_format   = ocr_data.get("format")

    db.add(cap)

    # Complete session on step 4
    if step_order == 4:
        session.status       = "completed"
        session.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(cap)
    return cap


# ── 14. Get sessions for a location + date ─────────────────────────────────────
@router.get("/sessions", response_model=List[SessionResponse])
def get_sessions(
    location: Optional[str] = Query(default=None),
    date_str: Optional[str] = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    roles = normalize_roles(current_user.role)
    if not any(r in ["itadmin", "copacker"] for r in roles):
        raise HTTPException(status_code=403, detail="Access denied.")

    # CoPacker → own location only
    if "copacker" in roles and "itadmin" not in roles:
        loc = current_user.copacker_location
    else:
        loc = location

    if not loc:
        raise HTTPException(status_code=400, detail="Location is required.")

    # Parse target date (default: today IST)
    if date_str:
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date. Use YYYY-MM-DD.")
    else:
        target_date = today_ist()

    # Convert IST date range to UTC for the DB query
    _IST_TZ = timezone(timedelta(hours=5, minutes=30))
    ist_start = datetime(
        target_date.year, target_date.month, target_date.day, 0, 0, 0,
        tzinfo=_IST_TZ
    )
    ist_end = datetime(
        target_date.year, target_date.month, target_date.day, 23, 59, 59,
        tzinfo=_IST_TZ
    )
    utc_start = ist_start.astimezone(timezone.utc)
    utc_end   = ist_end.astimezone(timezone.utc)

    sessions = (
        db.query(CopackerSession)
        .filter(
            CopackerSession.copacker_location.ilike(loc.strip()),
            CopackerSession.created_at >= utc_start,
            CopackerSession.created_at <= utc_end,
        )
        .order_by(CopackerSession.created_at.desc())
        .all()
    )
    return sessions


# ── 15. Asset ID history search (proximity search) ────────────────────────────
@router.get("/asset-history")
def get_asset_history(
    location: str = Query(...),
    q: str = Query(default=""),
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    roles = normalize_roles(current_user.role)
    if not any(r in ["itadmin", "copacker"] for r in roles):
        raise HTTPException(status_code=403, detail="Access denied.")

    search = f"%{q.strip()}%" if q.strip() else "%"
    rows = db.execute(
        text("""
            SELECT DISTINCT ON (c.asset_model_id)
                c.asset_model_id,
                c.captured_at AS last_used
            FROM copacker_captures c
            JOIN copacker_sessions s ON s.id = c.session_id
            WHERE s.copacker_location ILIKE :location
              AND c.asset_model_id IS NOT NULL
              AND c.asset_model_id != ''
              AND c.asset_model_id ILIKE :q
            ORDER BY c.asset_model_id, c.captured_at DESC
            LIMIT 20
        """),
        {"location": f"%{location.strip()}%", "q": search},
    ).fetchall()

    return [{"asset_model_id": r[0], "last_used": str(r[1])} for r in rows]


# ── 16. Edit capture asset ID (always allowed, same-day, own session) ──────────
@router.put("/capture/edit-asset", response_model=EditAssetResponse)
def edit_capture_asset(
    payload: EditAssetRequest,
    db: Session = Depends(get_db),
    current_user: UsersMaster = Depends(get_current_user),
):
    cap = db.query(CopackerCapture).filter(CopackerCapture.id == payload.capture_id).first()
    if not cap:
        raise HTTPException(status_code=404, detail="Capture not found.")

    session = db.query(CopackerSession).filter(CopackerSession.id == cap.session_id).first()
    if session.submitted_by != current_user.username:
        raise HTTPException(status_code=403, detail="Not your session.")

    if created_at_to_ist_date(cap.captured_at) != today_ist():
        raise HTTPException(
            status_code=403,
            detail="Asset ID can only be edited on the day of capture."
        )

    original = cap.asset_model_id
    cap.asset_model_id = payload.new_asset_model_id.strip()

    log = CopackerCaptureEditLog(
        capture_id     = cap.id,
        field_name     = "asset_model_id",
        original_value = original,
        edited_value   = cap.asset_model_id,
        edited_by      = current_user.username,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return EditAssetResponse(
        capture_id     = cap.id,
        original_value = original,
        new_value      = cap.asset_model_id,
        edited_by      = current_user.username,
        edited_at      = log.edited_at,
    )
