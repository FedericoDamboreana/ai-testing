from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session
from app.core.db import get_session
from app.models.evaluation import EvaluationRun
from app.schemas.evaluation import EvaluationRunRead

router = APIRouter()

@router.get("/{id}", response_model=EvaluationRunRead)
def read_run(id: int, session: Session = Depends(get_session)):
    run = session.get(EvaluationRun, id)
    if not run:
        raise HTTPException(status_code=404, detail="EvaluationRun not found")
    return run
