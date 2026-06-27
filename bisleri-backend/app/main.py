from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
import logging
import os
import subprocess
import time
from app.routers import auth, documents, gate, insights, ping, admin, sync, raw_materials
from app.routers import copacker as copacker_router
from app.config import settings as _settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Suppress passlib/bcrypt version-mismatch warning (bcrypt 4.x removed __about__)
logging.getLogger('passlib').setLevel(logging.ERROR)
# Silence APScheduler's own verbose logging
logging.getLogger('apscheduler').setLevel(logging.WARNING)


# ── Redis auto-start ──────────────────────────────────────────────────────────

_REDIS_EXE = r"C:\Automation\Redis-x64-5.0.14.1\redis-server.exe"

def _start_redis_if_needed() -> "subprocess.Popen | None":
    """
    Ping Redis. If it's already running (e.g. Windows Service), do nothing.
    If it's not running and the executable exists, start it as a subprocess.
    Returns the Popen handle if WE started it (so we can shut it down on exit),
    or None if Redis was already running / executable not found.
    """
    import redis as _redis_pkg
    try:
        test = _redis_pkg.Redis(host="localhost", port=6379, socket_connect_timeout=1)
        test.ping()
        logger.info("[Redis] Already running — connecting to existing instance.")
        return None
    except Exception:
        pass  # not running yet — try to start it

    if not os.path.exists(_REDIS_EXE):
        logger.error(
            f"[Redis] redis-server.exe not found at {_REDIS_EXE}. "
            "Token revocation will fail open. Place Redis at C:\\Redis\\ to enable it."
        )
        return None

    logger.info("[Redis] Starting redis-server.exe ...")
    proc = subprocess.Popen(
        [_REDIS_EXE],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1.5)  # give Redis a moment to bind its port
    logger.info("[Redis] Redis server started.")
    return proc


# ── mFabric sync job ──────────────────────────────────────────────────────────

def _run_mfabric_sync():
    """Called by APScheduler every 10 minutes. Lazy-imports csv_to_DB so the
    module's engine and logger are created after app startup completes."""
    logger.info("[Scheduler] Starting mfabric → document_data sync...")
    try:
        import csv_to_DB as _sync  # noqa: N813
        _sync.push_to_document_data()
        logger.info("[Scheduler] Sync completed successfully.")
    except Exception as exc:
        logger.error(f"[Scheduler] Sync failed: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Starting up FastAPI application...")

    # Start Redis (for token revocation blocklist)
    redis_proc = _start_redis_if_needed()

    # Start background sync scheduler
    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(
        _run_mfabric_sync,
        trigger="interval",
        minutes=10,
        id="mfabric_sync",
        max_instances=1,       # never overlap two sync jobs
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Background sync scheduler started — runs every 10 minutes (IST).")

    # Run one sync immediately so document_data is fresh on startup
    logger.info("Running initial sync on startup...")
    _run_mfabric_sync()

    logger.info("Application startup complete.")
    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Shutting down FastAPI application...")
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped.")
    if redis_proc is not None:
        redis_proc.terminate()
        redis_proc.wait()
        logger.info("[Redis] Redis server stopped.")
    logger.info("Application shutdown complete.")

app = FastAPI(
    title="Bisleri Backend API",
    description="Backend API for Bisleri with automated data synchronization",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - Allowed origins (dev: 8082, prod: 8081, server: nginx)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://192.168.1.56:9081",
        "http://127.0.0.1:9081",
        "http://localhost:9081"
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
        "http://192.168.1.56:8081",
        "http://192.168.1.56:8082",
        "http://123.63.20.237:8081",
        # Add nginx proxy URLs
        "https://srvhofortiems.bisleri.com:19000",
        "https://123.63.20.237:19000",
        "https://srvhofortiems.bisleri.com",
        "https://123.63.20.237",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(gate.router)
app.include_router(insights.router)
app.include_router(ping.router)
app.include_router(admin.router)
app.include_router(sync.router)
app.include_router(raw_materials.router)
app.include_router(copacker_router.router)

# Ensure the copacker images directory exists on startup
_copacker_img_dir = _settings.COPACKER_IMAGE_PATH
os.makedirs(_copacker_img_dir, exist_ok=True)
# NOTE: Images are served via the authenticated GET /copacker/image/{path} endpoint
# in app/routers/copacker.py — NOT as public static files.

@app.get("/")
async def root():
    return {"message": "Bisleri Backend API is running"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
