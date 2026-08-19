# tests/test_edit_service.py
"""Tier 1 — app/services/edit_service.py (Q14). The 3-colour edit system for
gate entries, tested with a plain fake record — no database involved."""
from datetime import datetime, timedelta

from app.services import edit_service


class FakeRecord:
    """Stands in for an InsightsData row."""

    def __init__(self, age_hours=2, driver_name="Ram", km_reading="1234",
                 loader_names="A, B", interlayer_sheet_count=0,
                 warehouse_code="WH1",
                 security_username="guard1", edit_count=0):
        created = datetime.now() - timedelta(hours=age_hours)
        self.date = created            # model combines date part…
        self.time = created.time()     # …with time part
        self.driver_name = driver_name
        self.km_reading = km_reading
        self.loader_names = loader_names
        # NOT NULL DEFAULT 0 on the real column — 0 is a filled-in value,
        # only None counts as missing.
        self.interlayer_sheet_count = interlayer_sheet_count
        self.warehouse_code = warehouse_code
        self.security_username = security_username
        self.edit_count = edit_count


# ── status colours ───────────────────────────────────────────────────────────
def test_complete_recent_record_is_editable_green():
    assert edit_service.get_edit_status(FakeRecord()) == "editable"


def test_missing_field_makes_needs_completion_yellow():
    rec = FakeRecord(driver_name="")
    assert edit_service.get_edit_status(rec) == "needs_completion"


def test_whitespace_only_counts_as_missing():
    rec = FakeRecord(km_reading="   ")
    assert edit_service.get_edit_status(rec) == "needs_completion"
    assert "km_reading" in edit_service.get_missing_operational_fields(rec)


def test_old_record_is_expired_black():
    assert edit_service.get_edit_status(FakeRecord(age_hours=49)) == "expired"


def test_record_without_timestamp_is_expired():
    rec = FakeRecord()
    rec.date = None
    assert edit_service.get_edit_status(rec) == "expired"


def test_missing_fields_lists_each_gap():
    rec = FakeRecord(driver_name="", km_reading="", loader_names="")
    assert edit_service.get_missing_operational_fields(rec) == [
        "driver_name", "km_reading", "loader_names",
    ]


def test_zero_interlayer_sheets_is_not_missing():
    """0 is a real answer ('no interlayer sheets'), not an empty field."""
    rec = FakeRecord(interlayer_sheet_count=0)
    assert edit_service.get_missing_operational_fields(rec) == []
    assert edit_service.get_edit_status(rec) == "editable"


def test_null_interlayer_sheets_is_missing():
    rec = FakeRecord(interlayer_sheet_count=None)
    assert edit_service.get_missing_operational_fields(rec) == [
        "interlayer_sheet_count",
    ]
    assert edit_service.get_edit_status(rec) == "needs_completion"


# ── who can edit ─────────────────────────────────────────────────────────────
def test_pure_itadmin_cannot_edit():
    assert not edit_service.can_be_edited(FakeRecord(), "x", "IT Admin", "WH1")


def test_multi_role_itadmin_bug_regression():
    """The old code compared the unsplit role string, so 'IT Admin, Security
    Guard' bypassed the view-only rule inconsistently. Combo users with an
    operational role ARE allowed to edit — but by design now, not accident."""
    assert edit_service.can_be_edited(FakeRecord(), "x", "IT Admin, Security Guard", "WH1")


def test_guard_can_edit_own_warehouse():
    assert edit_service.can_be_edited(FakeRecord(), "x", "Security Guard", "WH1")


def test_guard_cannot_edit_other_warehouse():
    assert not edit_service.can_be_edited(FakeRecord(), "x", "Security Guard", "WH9")


def test_creator_fallback_any_warehouse():
    assert edit_service.can_be_edited(FakeRecord(), "guard1", "Security Guard", "WH9")


def test_nobody_edits_expired():
    rec = FakeRecord(age_hours=60)
    assert not edit_service.can_be_edited(rec, "guard1", "Security Guard", "WH1")


# ── button config for the frontend ───────────────────────────────────────────
def test_button_green():
    cfg = edit_service.get_edit_button_config(FakeRecord(), "x", "Security Guard", "WH1")
    assert cfg["color"] == "green" and cfg["enabled"]


def test_button_yellow_lists_missing():
    cfg = edit_service.get_edit_button_config(
        FakeRecord(driver_name=""), "x", "Security Guard", "WH1")
    assert cfg["color"] == "yellow"
    assert "driver_name" in cfg["message"]
    assert cfg["missing_fields"] == ["driver_name"]


def test_button_black_when_expired():
    cfg = edit_service.get_edit_button_config(
        FakeRecord(age_hours=49), "x", "Security Guard", "WH1")
    assert cfg["color"] == "black" and not cfg["enabled"]


def test_button_gray_when_no_access():
    cfg = edit_service.get_edit_button_config(FakeRecord(), "x", "IT Admin", "WH1")
    assert cfg["color"] == "gray" and not cfg["enabled"]
