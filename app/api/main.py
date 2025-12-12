from fastapi import APIRouter
from app.api.routes import projects, testcases, runs

api_router = APIRouter()
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(testcases.router, prefix="/testcases", tags=["testcases"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
