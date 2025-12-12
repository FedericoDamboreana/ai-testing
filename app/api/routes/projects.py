from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session
from app.core.db import get_session
from app.schemas.project import ProjectRead, ProjectCreate, TestCaseRead, TestCaseCreate
from app.schemas.report import ReportRequest, ReportResponse

router = APIRouter()

@router.post("/", response_model=ProjectRead)
def create_project(project: ProjectCreate):
    # Stub
    raise HTTPException(status_code=501, detail="Not implemented")

@router.get("/", response_model=List[ProjectRead])
def read_projects():
    # Stub
    return []

@router.get("/{id}", response_model=ProjectRead)
def read_project(id: int):
    # Stub
    raise HTTPException(status_code=501, detail="Not implemented")

@router.post("/{id}/testcases", response_model=TestCaseRead)
def create_project_testcase(id: int, testcase: TestCaseCreate):
    # Stub
    raise HTTPException(status_code=501, detail="Not implemented")

@router.get("/{id}/testcases", response_model=List[TestCaseRead])
def read_project_testcases(id: int):
    # Stub
    return []

@router.post("/{id}/report", response_model=ReportResponse)
def generate_project_report_endpoint(id: int, request: ReportRequest, session: Session = Depends(get_session)):
    try:
        from app.services.report import create_project_report
        report = create_project_report(session, id, request.start_date, request.end_date)
        import json
        return ReportResponse(
            id=report.id,
            scope_type=report.scope_type,
            scope_id=report.scope_id,
            start_date=report.start_date,
            end_date=report.end_date,
            created_at=report.created_at,
            summary_text=report.summary_text,
            report_content=json.loads(report.content_json)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
