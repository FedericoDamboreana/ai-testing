from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.db import engine, init_db
from app.api.main import api_router
from fastapi.middleware.cors import CORSMiddleware
from app.core.bootstrap import bootstrap_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Bootstrap DB from GCS if needed
    bootstrap_database(settings)
    
    # Check/Init DB (create tables if missing)
    init_db()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Allow all origins for simplicity in this dev tool
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Serve frontend static files
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Serve static files if directory exists (for Docker build)
frontend_dist = os.path.join(os.getcwd(), "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    # Catch-all for SPA to serve index.html
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Allow API calls to pass through if not matched above (though they should be caught by api_router)
        if full_path.startswith("api"):
            return {"error": "Not Found"}
            
        # If file exists in dist (e.g. favicon.ico), serve it
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Otherwise serve index.html
        return FileResponse(os.path.join(frontend_dist, "index.html"))
