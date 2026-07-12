# app/schemas/filter_schemas.py
"""Typed filter bodies for movement/entry list endpoints (Pass 3 — Q6/Q10).

Replaces raw ``filters: dict`` on /filtered-movements, /rm/filtered-entries
and /rm/admin-filtered-entries. Malformed input now returns 422 with a
field-level message instead of a 500, and unknown/typo'd keys are rejected
(extra="forbid") instead of being silently ignored.
"""
from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class MovementFilters(BaseModel):
    """Shared filter set for FG movements and RM entries lists."""
    model_config = ConfigDict(extra="forbid")

    from_date: Optional[date] = None
    to_date: Optional[date] = None
    warehouse_code: Optional[str] = Field(None, max_length=50)
    site_code: Optional[str] = Field(None, max_length=50)
    vehicle_no: Optional[str] = Field(None, max_length=50)
    movement_type: Optional[str] = Field(None, max_length=20)
    # Q8: pagination. Default matches the old 5000 cap so existing callers
    # see zero change; new callers page with e.g. skip=0&limit=200.
    skip: int = Field(0, ge=0)
    limit: int = Field(5000, ge=1, le=5000)
