from fastapi import FastAPI
from contextlib import asynccontextmanager
import logging
from app.routers import auth, documents, gate, insights, ping, admin, sync
from app.scheduler import scheduler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up FastAPI application...")
    try:
        # Start the data sync scheduler
        scheduler.start()
        logger.info("Application startup complete")
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down FastAPI application...")
    try:
        # Stop the scheduler
        scheduler.stop()
        logger.info("Application shutdown complete")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")

app = FastAPI(
    title="Bisleri Backend API",
    description="Backend API for Bisleri with automated data synchronization",
    version="1.0.0",
    lifespan=lifespan
)

# Include routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(gate.router)
app.include_router(insights.router)
app.include_router(ping.router)
app.include_router(admin.router)
app.include_router(sync.router)  # Add sync router

@app.get("/")
async def root():
    return {"message": "Bisleri Backend API is running with automated data sync"}

@app.get("/health")
async def health_check():
    scheduler_status = "running" if scheduler.is_running else "stopped"
    return {
        "status": "healthy",
        "scheduler_status": scheduler_status,
        "active_jobs": len(scheduler.get_jobs()) if scheduler.is_running else 0
    }