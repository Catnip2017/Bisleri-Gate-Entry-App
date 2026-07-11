# app/utils/edit_window.py
"""Single source of truth for the 48-hour edit window (Pass 3 — Q2).

Before this module existed the window was computed three different ways
(model methods on InsightsData, inline timedelta maths in the raw
materials router, and raw seconds arithmetic). All window checks and
"time remaining" strings must come from here.

Note on timestamps: the DB stores naive local datetimes, so comparisons
use datetime.now() (naive) to match existing data. If the DB ever moves
to UTC-aware timestamps, change NOW_FN in one place.
"""
from datetime import datetime, timedelta
from typing import Optional

EDIT_WINDOW_HOURS = 48
EDIT_WINDOW = timedelta(hours=EDIT_WINDOW_HOURS)


def _now() -> datetime:
    return datetime.now()


def time_since(created_at: Optional[datetime]) -> Optional[timedelta]:
    """Elapsed time since the record was created, or None if unknown."""
    if not created_at:
        return None
    return _now() - created_at


def is_within_edit_window(created_at: Optional[datetime]) -> bool:
    """True if the record is still inside the 48-hour edit window."""
    elapsed = time_since(created_at)
    return elapsed is not None and elapsed <= EDIT_WINDOW


def get_time_remaining(created_at: Optional[datetime]) -> Optional[str]:
    """Remaining window as 'Hh Mm' (e.g. '31h 12m'), or None if
    expired / creation time unknown."""
    elapsed = time_since(created_at)
    if elapsed is None:
        return None
    remaining = EDIT_WINDOW - elapsed
    if remaining.total_seconds() <= 0:
        return None
    hours = int(remaining.total_seconds() // 3600)
    minutes = int((remaining.total_seconds() % 3600) // 60)
    return f"{hours}h {minutes}m"
