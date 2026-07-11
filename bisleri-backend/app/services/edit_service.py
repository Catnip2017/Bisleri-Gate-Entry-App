# app/services/edit_service.py
"""3-colour edit-system business logic for InsightsData (Pass 3 — Q14).

Moved out of app/models/insights.py so the ORM model stays a pure data
class. All functions take the record as the first argument (they were
previously instance methods on InsightsData).

Colour semantics (unchanged):
    'expired'          -> BLACK  (48h window passed)
    'needs_completion' -> YELLOW (inside window, operational fields missing)
    'editable'         -> GREEN  (inside window, all fields complete)
"""
from datetime import datetime
from typing import List, Optional

from app.utils.edit_window import is_within_edit_window, get_time_remaining as _window_remaining
from app.utils.roles import normalize_roles

# Fields required for a record to count as "operationally complete"
REQUIRED_OPERATIONAL_FIELDS = ("driver_name", "km_reading", "loader_names")


def record_created_at(record) -> Optional[datetime]:
    """InsightsData stores creation moment as separate date + time columns."""
    if not record.date or not record.time:
        return None
    return datetime.combine(record.date, record.time)


def is_operational_data_complete(record) -> bool:
    """True if all required operational fields are filled."""
    return all(
        (getattr(record, f) or "").strip() for f in REQUIRED_OPERATIONAL_FIELDS
    )


def get_missing_operational_fields(record) -> List[str]:
    """Names of required operational fields that are still empty."""
    return [
        f for f in REQUIRED_OPERATIONAL_FIELDS
        if not (getattr(record, f) or "").strip()
    ]


def get_edit_status(record) -> str:
    """Current edit status for the 3-colour system."""
    created_at = record_created_at(record)
    if not is_within_edit_window(created_at):
        return 'expired'  # BLACK button
    if not is_operational_data_complete(record):
        return 'needs_completion'  # YELLOW button
    return 'editable'  # GREEN button


def get_time_remaining(record) -> Optional[str]:
    """Remaining time in the 48-hour edit window as 'Hh Mm', or None."""
    return _window_remaining(record_created_at(record))


def can_be_edited(record, current_user_username, current_user_role,
                  current_user_warehouse_code=None) -> bool:
    """Check if the record can be edited by the given user.

    Rules (unchanged from the old model method, but now multi-role aware):
    - must be inside the 48-hour window
    - IT Admin is view-only — unless the user ALSO holds an operational
      role (Security Guard / Security Admin), in which case the
      operational role wins
    - warehouse staff can edit entries from their own warehouse
    - the creator can always edit their own entry
    """
    if get_edit_status(record) == 'expired':
        return False

    roles = normalize_roles(current_user_role)

    # IT Admin: view-only (operational roles override for combo users)
    if "itadmin" in roles and not ({"securityguard", "securityadmin"} & set(roles)):
        return False

    # Security Guard / Security Admin: any entry from their own warehouse
    if current_user_warehouse_code and record.warehouse_code == current_user_warehouse_code:
        return True

    # Fallback: creator can always edit their own entry
    return record.security_username == current_user_username


def get_edit_button_config(record, current_user_username, current_user_role,
                           current_user_warehouse_code=None) -> dict:
    """Complete edit-button configuration for the frontend."""
    edit_status = get_edit_status(record)
    can_edit = can_be_edited(record, current_user_username, current_user_role,
                             current_user_warehouse_code)
    time_remaining = get_time_remaining(record)
    missing_fields = get_missing_operational_fields(record)

    if edit_status == 'expired':
        return {
            'color': 'black',
            'text': '⚫ Expired',
            'enabled': False,
            'priority': 'none',
            'message': 'Edit window expired (48+ hours)',
            'action': 'view_only'
        }

    if not can_edit:
        return {
            'color': 'gray',
            'text': '🚫 No Access',
            'enabled': False,
            'priority': 'none',
            'message': 'Only staff from this warehouse or Admin can edit',
            'action': 'no_access'
        }

    if edit_status == 'needs_completion':
        return {
            'color': 'yellow',
            'text': '⚠️ Complete Info',
            'enabled': True,
            'priority': 'high',
            'message': f'Missing: {", ".join(missing_fields)} | {time_remaining} remaining',
            'action': 'complete_required',
            'missing_fields': missing_fields
        }

    # edit_status == 'editable'
    return {
        'color': 'green',
        'text': '✅ Edit Details',
        'enabled': True,
        'priority': 'medium',
        'message': f'All data complete | {time_remaining} remaining',
        'action': 'edit_optional',
        'edit_count': record.edit_count or 0
    }
