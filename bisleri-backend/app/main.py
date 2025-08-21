from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from app.routers import auth, documents, gate, insights, ping, admin, sync

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        "http://192.168.1.10:8081",
        "http://123.63.20.237:8081"
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

@app.get("/")
async def root():
    return {"message": "Bisleri Backend API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}