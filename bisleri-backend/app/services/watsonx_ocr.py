# app/services/watsonx_ocr.py
"""
IBM WatsonX OCR Service — 4-machine-type extraction for the Co Packer session system.

Machine types:
    blow_molder  — KOSME Blow Molder           (session step 1)
    bottling     — KOSME Bottling / Filling     (session step 2)
    labelling    — Labelling machine            (session step 3)
    case_counter — Smitec Case Counter          (session step 4)

Public API (Phase 2):
    extract_machine_data(image_bytes, mime_type, capture_type) -> dict

Backward-compat (Phase 1 — kept, not used by new flow):
    extract_machine_data_from_image(image_bytes, mime_type) -> dict
    extract_quantity_from_image(image_bytes, mime_type) -> int | None
"""

import base64
import json
import logging
import re
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token"


# ── Machine-type-specific OCR prompts ────────────────────────────────────────
# Blow Molder prompt adapted from teammate's battle-tested version (trimmed to
# 7 fields we actually need). Case Counter prompt from teammate's smitec_machine.
# Bottling and Labelling are new prompts written for Bisleri's specific UIs.

PROMPTS = {

    "blow_molder": """You are an industrial OCR expert analyzing a blow molder HMI screen from any manufacturer.

Different plants use different machines with different label names for the same data.
Map whatever labels you see to the canonical fields below using the hint variants as guidance.
Read every character carefully. Do NOT confuse 8 with B, 0 with O, 1 with I, 6 with G.
Large counter numbers often contain commas — strip all commas and return only the plain integer.
If a field is not visible or cannot be matched on screen, return null for it.

Return ONLY a raw JSON object. No markdown. No code fences. No explanation.

{
  "asset_number": "physical asset tag or machine ID on the housing (e.g. FA-PM-452) — read exactly as printed, null if not visible",
  "bottle_recipe": "active recipe or format text visible anywhere on screen (e.g. 0.25l | 16000 BpH | 8g | chemco new) — null if not visible",
  "last_hour_production_count": "actual bottles produced in the last completed hour — may be labelled: Last Hour Production, Last Hour Count, Hourly Production, Bottles/Last Hour — plain integer no commas, null if not visible",
  "production_count_current_batch": "bottles counted in the current batch or shift run — may be labelled: Batch Production, Batch Count, Current Batch Output, Shift Bottles, Shift Count — plain integer only, null if not visible",
  "total_production_count": "lifetime or cumulative total bottles blown — may be labelled: Production Count, Total Bottles Blown, Cumulative Production, Lifetime Count, Bottles Total — plain integer no commas, null if not visible",
  "good_bottles_count": "count of accepted or good bottles — may be labelled: Number of Capped Bottles, Accepted Bottles, Good Bottles — plain integer only, null if not visible",
  "preforms_processed_count": "total preforms used or blown — may be labelled: Preform Blowed Quantity, Preforms Blown, Preform Count, Preforms Total — plain integer no commas, null if not visible",
  "target_batch_quantity": "the planned total quantity for this production batch or order — may be labelled: Standard Bottle Quantity, Planned Quantity, Target Quantity, Order Quantity — this is a large batch-level count (typically tens of thousands or more), NOT a speed or rate value like Bottles/Hour or BPH — plain integer only, null if not visible"
}""",

    "bottling": """You are an industrial OCR expert analyzing a bottling or filling machine HMI screen.

Read every character carefully. Do NOT confuse 8 with B, 0 with O, 1 with I.
Large counter numbers often contain commas — strip all commas and return only the plain integer.
If a field is not visible, return null for it.

Return ONLY a raw JSON object. No markdown. No code fences. No explanation.

{
  "asset_number": "physical asset tag or machine ID on housing (e.g. FA-BT-123) — read exactly as printed, null if not visible",
  "total_bottles": "lifetime or cumulative total bottles filled — the largest counter value on screen, plain integer no commas no units, null if not visible",
  "production_speed_bph": "current production speed in bottles per hour — may be labelled: Speed, BPH, Filling Rate, Output — plain integer only, null if not visible"
}""",

    "labelling": """You are an industrial OCR expert analyzing a labelling machine HMI screen.

The screen typically shows a machine diagram with a large counter number displayed on or near the machine graphic.
Read the counter value very carefully — every digit matters.
If a field is not visible, return null for it.

Return ONLY a raw JSON object. No markdown. No code fences. No explanation.

{
  "asset_number": "physical asset tag or ID on machine housing if visible (e.g. FA-LB-101) — null if not visible",
  "labels_count": "the main counter number shown on screen — may be labelled: Labels Count, Applied Labels, Total Labels — plain integer no commas no units, null if not visible",
  "format": "active format or recipe text visible on screen (e.g. F2 250 ML BISLERI WATER) — null if not visible"
}""",

    "case_counter": """You are an industrial OCR expert analyzing a shrink wrap or packing machine HMI screen.

Read every value carefully and exactly as shown. Do NOT confuse 8 with B, 0 with O, 1 with I.
If a field is not visible, return null for it.

Return ONLY a raw JSON object. No markdown. No code fences. No explanation.

{
  "asset_number": "brand label or asset ID on machine body if visible (e.g. smitec or FA-CC-101) — null if not visible",
  "packs_counter": "Packs Counter or cases packed value — may be labelled: Packs Counter, Cases Counted, Shrink Count — plain integer only, null if not visible",
  "format": "active format or pack configuration shown on screen (e.g. 8x6 250 ml film only) — null if not visible"
}""",
}


# ── Empty fallback dicts per machine type ─────────────────────────────────────

_EMPTY = {
    "blow_molder": {
        "asset_number":                   None,
        "bottle_recipe":                  None,
        "last_hour_production_count":      None,
        "production_count_current_batch": None,
        "total_production_count":         None,
        "good_bottles_count":             None,
        "preforms_processed_count":       None,
        "target_batch_quantity":          None,
    },
    "bottling": {
        "asset_number":         None,
        "total_bottles":        None,
        "production_speed_bph": None,
    },
    "labelling": {
        "asset_number": None,
        "labels_count": None,
        "format":       None,
    },
    "case_counter": {
        "asset_number":  None,
        "packs_counter": None,
        "format":        None,
    },
}


# ── IBM IAM token exchange ────────────────────────────────────────────────────

def _get_iam_token() -> str | None:
    """Exchange IBM Cloud API key for a short-lived IAM bearer token."""
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                IAM_TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                    "apikey": settings.IBM_API_KEY,
                },
            )
            resp.raise_for_status()
            return resp.json()["access_token"]
    except Exception as e:
        logger.error(f"Failed to get IAM token: {e}")
        return None


# ── WatsonX call ─────────────────────────────────────────────────────────────

def _call_watsonx(image_bytes: bytes, prompt: str,
                  mime_type: str = "image/jpeg") -> str | None:
    """Core helper: IAM token + WatsonX multimodal call → raw text response."""
    if settings.IBM_API_KEY == "placeholder" or settings.IBM_SERVICE_URL == "placeholder":
        logger.warning("IBM credentials are placeholders — OCR skipped")
        return None

    token = _get_iam_token()
    if not token:
        logger.error("Could not obtain IAM token — OCR skipped")
        return None

    api_url = (
        f"{settings.IBM_SERVICE_URL.rstrip('/')}"
        "/ml/v1/text/chat?version=2024-05-01"
    )

    try:
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        payload = {
            "model_id": settings.WATSONX_MODEL,
            "project_id": settings.IBM_PROJECT_ID,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_b64}"
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            "parameters": {
                "max_new_tokens": 500,
                "temperature": 0,
            },
        }

        with httpx.Client(timeout=90) as client:
            response = client.post(
                api_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()

        data = response.json()
        raw_text: str = (
            data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            or
            data.get("results", [{}])[0].get("generated_text", "")
        )
        return raw_text.strip()

    except httpx.HTTPStatusError as e:
        logger.error(f"WatsonX HTTP error {e.response.status_code}: {e.response.text}")
    except httpx.RequestError as e:
        logger.error(f"WatsonX request error: {e}")
    except Exception as e:
        logger.error(f"WatsonX unexpected error: {e}")
    return None


# ── JSON parsing ──────────────────────────────────────────────────────────────

def _parse_json(raw: str) -> dict | None:
    """Strip markdown fences, extract JSON object block, parse it."""
    if not raw:
        return None
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip("` \n")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if m:
        try:
            return json.loads(m.group())
        except Exception:
            pass
    return None


# ── Value coercion helpers ────────────────────────────────────────────────────

def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        return int(str(val).replace(",", "").replace(" ", "").split(".")[0])
    except Exception:
        return None


def _safe_str(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


# ── Public API (Phase 2) ──────────────────────────────────────────────────────

def extract_machine_data(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    capture_type: str = "blow_molder",
) -> dict:
    """
    Send image to WatsonX and extract machine-specific fields.

    capture_type must be one of: blow_molder | bottling | labelling | case_counter

    Returns a dict keyed to the machine type's fields.
    All fields default to None if OCR fails or field is unreadable.
    """
    prompt = PROMPTS.get(capture_type, PROMPTS["blow_molder"])
    empty  = dict(_EMPTY.get(capture_type, _EMPTY["blow_molder"]))

    raw_text = _call_watsonx(image_bytes, prompt, mime_type)
    if raw_text is None:
        return empty

    logger.info(f"WatsonX OCR [{capture_type}] raw: {raw_text[:400]}")

    parsed = _parse_json(raw_text)
    if parsed is None:
        logger.warning(f"Could not parse JSON [{capture_type}]: {raw_text[:400]}")
        return empty

    if capture_type == "blow_molder":
        return {
            "asset_number":                   _safe_str(parsed.get("asset_number")),
            "bottle_recipe":                  _safe_str(parsed.get("bottle_recipe")),
            "last_hour_production_count":      _safe_int(parsed.get("last_hour_production_count")),
            "production_count_current_batch": _safe_int(parsed.get("production_count_current_batch")),
            "total_production_count":         _safe_int(parsed.get("total_production_count")),
            "good_bottles_count":             _safe_int(parsed.get("good_bottles_count")),
            "preforms_processed_count":       _safe_int(parsed.get("preforms_processed_count")),
            "target_batch_quantity":          _safe_int(parsed.get("target_batch_quantity")),
        }
    elif capture_type == "bottling":
        return {
            "asset_number":         _safe_str(parsed.get("asset_number")),
            "total_bottles":        _safe_int(parsed.get("total_bottles")),
            "production_speed_bph": _safe_int(parsed.get("production_speed_bph")),
        }
    elif capture_type == "labelling":
        return {
            "asset_number": _safe_str(parsed.get("asset_number")),
            "labels_count": _safe_int(parsed.get("labels_count")),
            "format":       _safe_str(parsed.get("format")),
        }
    elif capture_type == "case_counter":
        return {
            "asset_number":  _safe_str(parsed.get("asset_number")),
            "packs_counter": _safe_int(parsed.get("packs_counter")),
            "format":        _safe_str(parsed.get("format")),
        }

    return empty


# ── Backward-compat functions (Phase 1 — not used by new session flow) ────────

def extract_quantity_from_image(image_bytes: bytes,
                                mime_type: str = "image/jpeg") -> int | None:
    """Legacy: returns a single integer from a counter display."""
    OCR_PROMPT = (
        "This image shows a numeric counter display on a production machine. "
        "Extract only the numeric integer value shown on the display. "
        "Return only the integer number, nothing else."
    )
    raw_text = _call_watsonx(image_bytes, OCR_PROMPT, mime_type)
    if raw_text is None:
        return None
    match = re.search(r"\d+", raw_text)
    return int(match.group()) if match else None


def extract_machine_data_from_image(image_bytes: bytes,
                                    mime_type: str = "image/jpeg") -> dict:
    """Legacy wrapper: calls blow_molder extraction with Phase 1 key names."""
    result = extract_machine_data(image_bytes, mime_type, "blow_molder")
    return {
        "bottles_total":   result.get("total_production_count"),
        "recipe":          result.get("bottle_recipe"),
        "asset_model_no":  result.get("asset_number"),
    }
