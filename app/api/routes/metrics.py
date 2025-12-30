from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session
from app.core.db import get_session
from app.models.metric import MetricDefinition

router = APIRouter()

@router.delete("/{id}", status_code=204)
def delete_metric(id: int, session: Session = Depends(get_session)):
    metric = session.get(MetricDefinition, id)
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    
    session.delete(metric)
    session.commit()
    return None
