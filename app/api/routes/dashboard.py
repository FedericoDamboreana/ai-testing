from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.core.db import get_session
from app.schemas.dashboard import TestCaseDashboardResponse, ProjectDashboardResponse
from app.services import dashboard as dashboard_service

router = APIRouter()

@router.get("/testcases/{id}/dashboard", response_model=TestCaseDashboardResponse)
def read_test_case_dashboard(id: int, session: Session = Depends(get_session)):
    dashboard = dashboard_service.get_test_case_dashboard(session, id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Test case not found")
    return dashboard

@router.get("/projects/{id}/dashboard", response_model=ProjectDashboardResponse)
def read_project_dashboard(id: int, session: Session = Depends(get_session)):
    dashboard = dashboard_service.get_project_dashboard(session, id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Project not found")
    return dashboard
