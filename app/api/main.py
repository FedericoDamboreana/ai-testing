from fastapi import APIRouter
from app.api.routes import projects, testcases, runs, dashboard, metrics, tools, auth, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(testcases.router, prefix="/testcases", tags=["testcases"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
api_router.include_router(tools.router, prefix="/tools", tags=["tools"])
api_router.include_router(dashboard.router, tags=["dashboard"])
