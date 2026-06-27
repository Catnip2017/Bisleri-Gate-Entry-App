"""
app/redis_client.py
-------------------
Shared Redis connection and token-blocklist helpers.

All public functions are wrapped in try/except and FAIL OPEN — if Redis is
unavailable (e.g. during a restart), requests are not blocked. The error is
logged so it is visible in the uvicorn console.
"""
import logging
import redis

logger = logging.getLogger(__name__)

# Single connection shared across the entire app process.
# decode_responses=True → Redis returns str, not bytes.
_client: redis.Redis = redis.Redis(
    host="localhost",
    port=6379,
    db=0,
    decode_responses=True,
    socket_connect_timeout=1,   # don't hang if Redis is starting up
    socket_timeout=1,
)


# ── Internal accessor ────────────────────────────────────────────────────────

def _r() -> redis.Redis:
    return _client


# ── Public helpers ───────────────────────────────────────────────────────────

def store_active_jti(username: str, jti: str, ttl_seconds: int) -> None:
    """
    Remember that `username` currently holds token `jti`.
    Used to revoke a user's session when an admin resets their password or
    changes their role, without needing the token itself.
    TTL matches the token lifetime so Redis auto-cleans stale entries.
    """
    try:
        _r().setex(f"active_jti:{username}", ttl_seconds, jti)
    except Exception as exc:
        logger.warning(f"[Redis] store_active_jti failed for {username}: {exc}")


def revoke_jti(jti: str, ttl_seconds: int) -> None:
    """
    Add `jti` to the blocklist for `ttl_seconds`.
    get_current_user checks this on every authenticated request.
    Redis auto-deletes the key when the token would have expired anyway.
    """
    try:
        _r().setex(f"blocked:{jti}", max(ttl_seconds, 1), "1")
    except Exception as exc:
        logger.warning(f"[Redis] revoke_jti failed for jti={jti}: {exc}")


def revoke_user_token(username: str) -> None:
    """
    Look up the active jti for `username` and immediately revoke it.
    Called by:  reset-password, modify-user (role change), delete-user.
    If no active jti is found (user not logged in), this is a silent no-op.
    """
    try:
        r = _r()
        key = f"active_jti:{username}"
        jti = r.get(key)
        if jti:
            remaining = r.ttl(key)          # seconds left on this token
            r.setex(f"blocked:{jti}", max(remaining, 1), "1")
            r.delete(key)
            logger.info(f"[Redis] Revoked active token for user '{username}' (jti={jti})")
    except Exception as exc:
        logger.warning(f"[Redis] revoke_user_token failed for {username}: {exc}")


def is_token_revoked(jti: str) -> bool:
    """
    Return True if `jti` is on the blocklist (token was explicitly revoked).
    Returns False on Redis error — fail open so a Redis outage doesn't lock
    out all gate guards.
    """
    try:
        return bool(_r().exists(f"blocked:{jti}"))
    except Exception as exc:
        logger.warning(f"[Redis] Blocklist check failed for jti={jti}: {exc}")
        return False  # fail open
