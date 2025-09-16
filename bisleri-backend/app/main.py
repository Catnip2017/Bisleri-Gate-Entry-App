from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os
from app.routers import auth, documents, gate, insights, ping, admin, sync , raw_materials

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up FastAPI application...")
    try:
        # Log that data sync service is available
        logger.info("Data sync service initialized and ready")
        logger.info("Application startup complete")
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down FastAPI application...")
    try:
        logger.info("Application shutdown complete")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")

app = FastAPI(
    title="Bisleri Backend API",
    description="Backend API for Bisleri with automated data synchronization", 
    version="1.0.0"
)

# CORS - Allow localhost:8081 to access backend:8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081", 
        "http:/10.103.237.157:8081",
        "http://123.63.20.237:8081",
        "http://192.168.1.56:8081",
        # Add nginx proxy URLs
        "https://srvhofortiems.bisleri.com:19000",
        "https://123.63.20.237:19000",
        "https://srvhofortiems.bisleri.com",
        "https://123.63.20.237",
        "*"  # Keep this for development, remove in production if needed
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

@app.get("/")
async def root():
    return {"message": "Bisleri Backend API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

    # Check data sync service status
    try:
        sync_status = scheduler.get_sync_status()
        return {
            "status": "healthy",
            "data_sync_service": "available",
            "sync_status": sync_status
        }
    except Exception as e:
        return {
            "status": "healthy", 
            "data_sync_service": "error",
            "error": str(e)
        }

