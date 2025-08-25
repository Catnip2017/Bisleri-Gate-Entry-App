from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from app.routers import auth, documents, gate, insights, ping, admin, sync, raw_materials

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Bisleri Backend API",
    description="Backend API for Bisleri with automated data synchronization and raw materials tracking", 
    version="1.0.0"
)

# CORS - Allow localhost:8081 to access backend:8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081", 
        "http://192.168.1.10:8081",
        "http://123.63.20.237:8081",
        "http://192.168.1.56:8081",
        "*"
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
app.include_router(raw_materials.router)  # NEW: Raw Materials router

@app.get("/")
async def root():
    return {"message": "Bisleri Backend API is running with Raw Materials support"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# import logging
# import os
# from app.routers import auth, documents, gate, insights, ping, admin, sync, raw_materials

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# app = FastAPI(
#     title="Bisleri Backend API",
#     description="Backend API for Bisleri with automated data synchronization and raw materials tracking", 
#     version="1.0.0"
# )

# # Enhanced CORS configuration for global access
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         # Local development
#         "http://localhost:8081",
#         "http://localhost:19000",  # Expo web on port 19000
#         "http://127.0.0.1:8081",
#         "http://127.0.0.1:19000",
        
#         # Your local network IPs
#         "http://192.168.1.10:8081",
#         "http://192.168.1.56:8081",
#         "http://192.168.1.56:19000",
#         "http://192.168.1.56",
        
#         # Your public IP - all possible ports
#         "http://123.63.20.237:8081",
#         "http://123.63.20.237:19000",
#         "http://123.63.20.237",
#         "https://123.63.20.237:8443",
#         "https://123.63.20.237:443",
#         "https://123.63.20.237",
        
#         # Bisleri domain
#         "https://srvhofortiems.bisleri.com",
#         "http://srvhofortiems.bisleri.com",
        
#         # Mobile app origins (for Expo Go and development builds)
#         "capacitor://localhost",
#         "ionic://localhost",
#         "http://localhost",
        
#         # Wildcard for development (remove in production)
#         "*"
#     ],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
#     expose_headers=["*"]
# )

# # Include routers
# app.include_router(auth.router)
# app.include_router(documents.router) 
# app.include_router(gate.router)
# app.include_router(insights.router)
# app.include_router(ping.router)
# app.include_router(admin.router)
# app.include_router(sync.router)
# app.include_router(raw_materials.router)

# @app.get("/")
# async def root():
#     return {"message": "Bisleri Backend API is running with Raw Materials support"}

# @app.get("/health")
# async def health_check():
#     return {"status": "healthy", "accessible_from": "global"}

# # Add a new endpoint to help debug CORS issues
# @app.get("/cors-test")
# async def cors_test():
#     return {
#         "message": "CORS is working",
#         "accessible_from": "anywhere",
#         "backend_host": "0.0.0.0:8000"
#     }