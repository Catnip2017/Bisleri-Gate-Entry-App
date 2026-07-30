from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import logging
import os
from app.routers import auth, documents, gate, insights, admin, sync, raw_materials, rpa, gate_pass, dashboard
from app.routers import copacker as copacker_router
from app.config import settings as _settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Q18: optional persistent log file (FILE_LOGGING=true in .env) ────────────
# Console logging above always stays. When enabled, everything (incl. the
# ref-ID error tracebacks from app.utils.errors) ALSO lands in logs/app.log,
# rolling over at 5 MB with 5 backups — so "ref a3f8c2 from yesterday"
# survives terminal restarts. Disabled by default until the user flips it.
from app.config import settings as _settings  # noqa: E402
if _settings.FILE_LOGGING:
    from logging.handlers import RotatingFileHandler
    _log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
    os.makedirs(_log_dir, exist_ok=True)
    _fh = RotatingFileHandler(
        os.path.join(_log_dir, "app.log"),
        maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8",
    )
    _fh.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logging.getLogger().addHandler(_fh)
    logger.info("FILE_LOGGING enabled -> %s", os.path.join(_log_dir, "app.log"))

# Suppress passlib/bcrypt version-mismatch warning (bcrypt 4.x removed __about__)
logging.getLogger('passlib').setLevel(logging.ERROR)
# Silence APScheduler's own verbose logging
logging.getLogger('apscheduler').setLevel(logging.WARNING)


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


def _run_dashboard_etl():
    """Called by APScheduler every 8 hours (and once at startup, in the
    background). Lazy-imports so the ETL modules' connections are created
    after app startup completes. Targets the separate Bisleri_dashboard DB
    only — unrelated to _run_mfabric_sync's document_data target."""
    logger.info("[Scheduler] Starting vehicle/load dashboard ETL...")
    try:
        from app.dashboard.etl.run_all import run_dashboard_etl
        run_dashboard_etl(is_startup=True)
        logger.info("[Scheduler] Dashboard ETL completed successfully.")
    except Exception as exc:
        logger.error(f"[Scheduler] Dashboard ETL failed: {exc}")


def _run_ecosystem_sync():
    """Called by APScheduler every 12 hours (and once at startup, in the
    background). Read-only pull from the live Bisleri_01 DB into this app's
    own bisleri_ecosystem DB — see app/ecosystem_sync/incremental_sync.py."""
    logger.info("[Scheduler] Starting ecosystem incremental sync...")
    try:
        from app.ecosystem_sync.incremental_sync import run_ecosystem_incremental_sync
        run_ecosystem_incremental_sync()
        logger.info("[Scheduler] Ecosystem sync completed successfully.")
    except Exception as exc:
        logger.error(f"[Scheduler] Ecosystem sync failed: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Starting up FastAPI application...")

    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(
        _run_mfabric_sync,
        trigger="interval",
        minutes=10,
        id="mfabric_sync",
        max_instances=1,       # never overlap two sync jobs
        replace_existing=True,
    )
    scheduler.add_job(
        _run_dashboard_etl,
        trigger="interval",
        minutes=480,            # 8 hours
        id="dashboard_etl",
        max_instances=1,       # never overlap two ETL runs
        replace_existing=True,
        next_run_time=datetime.now(),  # fire once immediately, in the background
    )
    scheduler.add_job(
        _run_ecosystem_sync,
        trigger="interval",
        minutes=720,            # 12 hours
        id="ecosystem_sync",
        max_instances=1,       # never overlap two sync runs
        replace_existing=True,
        next_run_time=datetime.now(),  # fire once immediately, in the background
    )
    scheduler.start()
    logger.info("Background sync scheduler started — mfabric_sync every 10 minutes, "
                "dashboard_etl every 8 hours, ecosystem_sync every 12 hours (IST).")

    # Run one mfabric sync immediately (synchronously, it's fast) so
    # document_data is fresh on startup. The dashboard ETL's first run is
    # scheduled above instead (next_run_time=now) since it can be much
    # slower — it runs in the scheduler's background thread rather than
    # blocking app startup.
    logger.info("Running initial sync on startup...")
    _run_mfabric_sync()

    logger.info("Application startup complete.")
    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Shutting down FastAPI application...")
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped. Application shutdown complete.")


# ── Swagger toggle (#8): docs are OFF by default and only exposed when
# ENABLE_DOCS=true in .env. Secure-by-default — a missing/false flag on the
# production server hides /docs, /redoc and /openapi.json (all return 404).
# Read once at startup, so flipping the flag needs a uvicorn restart.
_docs_enabled = _settings.ENABLE_DOCS
app = FastAPI(
    title="Bisleri Backend API",
    description="Backend API for Bisleri with automated data synchronization",
    version="1.0.4-merged-insights",
    lifespan=lifespan,
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)
if not _docs_enabled:
    logger.info("API docs disabled (ENABLE_DOCS=false) — /docs, /redoc, /openapi.json return 404")


# ── Global safety net (Q5): any unhandled exception is fully logged with a
# ref ID, while the client only ever sees a generic message. Per-route
# handlers use app.utils.errors.internal_error for the same behaviour.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    from app.utils.errors import log_exception
    ref = log_exception(f"Unhandled error on {request.method} {request.url.path}")
    return JSONResponse(status_code=500, content={"detail": f"Internal server error (ref: {ref})"})

# CORS - Allowed origins (dev: 8082, prod: 8081, server: nginx)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://192.168.1.56:9001",
        "http://localhost:9001",
        "http://127.0.0.1:9001",
        "http://192.168.1.56:9081",
        "http://127.0.0.1:9081",
        "http://localhost:9081",
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
app.include_router(admin.router)
app.include_router(sync.router)
app.include_router(raw_materials.router)
app.include_router(copacker_router.router)
app.include_router(rpa.router)
app.include_router(gate_pass.router)
app.include_router(dashboard.router)

# Ensure the copacker images directory exists on startup
_copacker_img_dir = _settings.COPACKER_IMAGE_PATH
os.makedirs(_copacker_img_dir, exist_ok=True)
# NOTE: Images are served via the authenticated GET /copacker/image/{path} endpoint
# in app/routers/copacker.py — NOT as public static files.

# ── Vehicle/Load Dashboard SPA ───────────────────────────────────────────────
# Built with `npm run build` in dashboard-web/, served from this same
# process/port — no separate Node server to run in production (the API and
# the dashboard's HTML/JS/CSS share one origin). Built with base: '/dashboard/'
# so its own asset URLs already point at /dashboard/assets/...
_dashboard_dist = os.path.join(os.path.dirname(__file__), "..", "..", "dashboard-web", "dist")
_dashboard_index = os.path.join(_dashboard_dist, "index.html")

if os.path.isdir(_dashboard_dist):
    app.mount("/dashboard/assets", StaticFiles(directory=os.path.join(_dashboard_dist, "assets")), name="dashboard-assets")

    @app.get("/dashboard/favicon.svg")
    async def dashboard_favicon():
        return FileResponse(os.path.join(_dashboard_dist, "favicon.svg"))

    @app.get("/dashboard/icons.svg")
    async def dashboard_icons():
        return FileResponse(os.path.join(_dashboard_dist, "icons.svg"))

    @app.get("/dashboard")
    @app.get("/dashboard/{full_path:path}")
    async def dashboard_spa(full_path: str = ""):
        # Client-side routes (e.g. /dashboard/tat) all serve the same
        # index.html — react-router handles the path in the browser.
        return FileResponse(_dashboard_index)
else:
    logger.warning("dashboard-web/dist not found — run `npm run build` in the root dashboard-web/ folder to serve the dashboard SPA.")


@app.get("/")
async def root():
    return {"message": "Bisleri Backend API is running"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
