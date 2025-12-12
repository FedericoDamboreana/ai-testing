from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from app.core.db import get_session
from app.models.project import Project
from app.models.test_case import TestCase
from app.schemas.project import ProjectRead, ProjectCreate, TestCaseRead, TestCaseCreate
from app.schemas.report import ReportRequest, ReportResponse

router = APIRouter()

@router.post("/", response_model=ProjectRead)
def create_project(project: ProjectCreate, session: Session = Depends(get_session)):
    db_project = Project.model_validate(project)
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project

@router.get("/", response_model=List[ProjectRead])
def read_projects(offset: int = 0, limit: int = 100, session: Session = Depends(get_session)):
    projects = session.exec(select(Project).offset(offset).limit(limit)).all()
    return projects

@router.get("/{id}", response_model=ProjectRead)
def read_project(id: int, session: Session = Depends(get_session)):
    project = session.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/{id}/testcases", response_model=TestCaseRead)
def create_project_testcase(id: int, testcase: TestCaseCreate, session: Session = Depends(get_session)):
    project = session.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_testcase = TestCase.model_validate(testcase, update={"project_id": id})
    session.add(db_testcase)
    session.commit()
    session.refresh(db_testcase)
    return db_testcase

@router.get("/{id}/testcases", response_model=List[TestCaseRead])
def read_project_testcases(id: int, session: Session = Depends(get_session)):
    project = session.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    testcases = session.exec(select(TestCase).where(TestCase.project_id == id)).all()
    return testcases

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
