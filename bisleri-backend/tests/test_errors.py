# tests/test_errors.py
"""Tier 1 — app/utils/errors.py (Q5). 500 responses must never leak DB
hostnames, usernames, SQL or internal exception text to the client."""
import logging

import app.utils.errors as errors_module
from app.utils.errors import internal_error, log_exception

LEAKY = ('connection to server at "10.4.2.17", port 5432 failed: '
         'FATAL: password authentication failed for user "bisleri_app" '
         '[SQL: SELECT insights_data.id FROM insights_data]')


def _make_error():
    try:
        raise ConnectionError(LEAKY)
    except Exception as exc:
        return internal_error("Filter error", exc)


def test_client_detail_is_generic():
    http = _make_error()
    assert http.status_code == 500
    assert http.detail.startswith("Internal server error (ref: ")
    for secret in ("10.4.2.17", "bisleri_app", "SELECT", "psycopg2", "FATAL"):
        assert secret not in http.detail


def test_ref_id_present_and_short():
    ref = _make_error().detail.split("ref: ")[1].rstrip(")")
    assert len(ref) == 8
    int(ref, 16)  # hex


def test_full_error_reaches_the_log(caplog):
    with caplog.at_level(logging.ERROR, logger="app.errors"):
        http = _make_error()
    ref = http.detail.split("ref: ")[1].rstrip(")")
    assert ref in caplog.text            # same ref in log and response
    assert "bisleri_app" in caplog.text  # full detail server-side
    assert "ConnectionError" in caplog.text  # stack trace captured


def test_debug_errors_flag_appends_detail(monkeypatch):
    monkeypatch.setattr(errors_module, "DEBUG_ERRORS", True)
    http = _make_error()
    assert "bisleri_app" in http.detail  # dev mode: raw text included


def test_log_exception_returns_ref(caplog):
    with caplog.at_level(logging.ERROR, logger="app.errors"):
        try:
            raise ValueError("boom")
        except ValueError:
            ref = log_exception("health check")
    assert ref in caplog.text
    assert "boom" in caplog.text
