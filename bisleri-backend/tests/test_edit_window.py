# tests/test_edit_window.py
"""Tier 1 — app/utils/edit_window.py (Q2). The 48-hour edit window is a core
business rule; these tests pin the boundary exactly."""
from datetime import datetime, timedelta

from app.utils.edit_window import (
    EDIT_WINDOW,
    EDIT_WINDOW_HOURS,
    get_time_remaining,
    is_within_edit_window,
    time_since,
)


def test_window_is_48_hours():
    assert EDIT_WINDOW_HOURS == 48
    assert EDIT_WINDOW == timedelta(hours=48)


def test_fresh_record_is_editable():
    assert is_within_edit_window(datetime.now() - timedelta(minutes=5))


def test_just_inside_boundary():
    assert is_within_edit_window(datetime.now() - timedelta(hours=47, minutes=59))


def test_just_outside_boundary():
    assert not is_within_edit_window(datetime.now() - timedelta(hours=48, minutes=1))


def test_unknown_creation_time_is_not_editable():
    assert not is_within_edit_window(None)


def test_future_timestamp_is_within_window():
    """Clock skew between app server and DB must not lock a fresh record."""
    assert is_within_edit_window(datetime.now() + timedelta(minutes=2))


def test_time_remaining_format():
    remaining = get_time_remaining(datetime.now() - timedelta(hours=16, minutes=48))
    assert remaining in ("31h 11m", "31h 12m")  # tolerate the test's own runtime


def test_time_remaining_expired_is_none():
    assert get_time_remaining(datetime.now() - timedelta(hours=50)) is None


def test_time_remaining_unknown_is_none():
    assert get_time_remaining(None) is None


def test_time_since():
    assert time_since(None) is None
    elapsed = time_since(datetime.now() - timedelta(hours=1))
    assert timedelta(minutes=59) < elapsed < timedelta(minutes=61)
