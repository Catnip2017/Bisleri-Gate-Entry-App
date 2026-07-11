# app/utils/errors.py
"""Safe error responses (Pass 3 — Q5).

Before this module existed, 46 handlers did:
    raise HTTPException(status_code=500, detail=f"...: {str(e)}")
which leaked DB hostnames, usernames, SQL and internal field names to any
API caller. Now:

  - the CLIENT gets a generic message plus a short reference ID
  - the SERVER LOG gets the full stack trace tagged with the same ID,
    so support can grep the ref the user reports and land on the exact
    traceback.

Dev convenience: set DEBUG_ERRORS=true in .env to also include the raw
exception text in the response. NEVER enable this in production.
"""
import logging
import os
import uuid

from fastapi import HTTPException

logger = logging.getLogger("app.errors")

DEBUG_ERRORS = os.getenv("DEBUG_ERRORS", "false").strip().lower() in ("1", "true", "yes")


def log_exception(context: str) -> str:
    """Log the currently-handled exception with full traceback.
    Returns a short reference ID included in both log line and response.
    Must be called from inside an ``except`` block."""
    ref = uuid.uuid4().hex[:8]
    logger.exception("[ref %s] %s", ref, context)
    return ref


def internal_error(context: str, exc: Exception = None) -> HTTPException:
    """Build a safe 500 for ``raise internal_error("Filter error", e)``.

    Logs the full traceback server-side; the client sees only a generic
    message + ref ID (plus raw detail when DEBUG_ERRORS is enabled).
    """
    ref = log_exception(context)
    detail = f"Internal server error (ref: {ref})"
    if DEBUG_ERRORS and exc is not None:
        detail = f"{detail} — {context}: {exc}"
    return HTTPException(status_code=500, detail=detail)
