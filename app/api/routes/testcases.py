from datetime import datetime
from typing import List
import json
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from app.core.db import get_session
from app.models.test_case import TestCase, Example
from app.models.metric import MetricDesignIteration, MetricDefinition
from app.schemas.project import TestCaseRead, ExampleCreate, ExampleRead
from app.schemas.metric import MetricDesignIterationCreate, MetricDesignIterationRead, MetricDefinitionCreate
from app.schemas.evaluation import EvaluationRunPreviewRequest, EvaluationRunPreviewResponse, EvaluationRunCommitRequest, EvaluationRunRead
from app.schemas.report import ReportRequest, ReportResponse
from app.services.llm import generate_metric_proposals

router = APIRouter()

@router.get("/{id}", response_model=TestCaseRead)
def read_testcase(id: int, session: Session = Depends(get_session)):
    test_case = session.get(TestCase, id)
    if not test_case:
        raise HTTPException(status_code=404, detail="TestCase not found")
    return test_case

@router.post("/{id}/examples", response_model=ExampleRead)
def create_example(id: int, example: ExampleCreate, session: Session = Depends(get_session)):
    test_case = session.get(TestCase, id)
    if not test_case:
        raise HTTPException(status_code=404, detail="TestCase not found")
    db_example = Example.model_validate(example, update={"test_case_id": id})
    session.add(db_example)
    session.commit()
    session.refresh(db_example)
    return db_example

@router.post("/{id}/metric-design", response_model=MetricDesignIterationRead)
def start_metric_design(id: int, design: MetricDesignIterationCreate, session: Session = Depends(get_session)):
    test_case = session.get(TestCase, id)
    if not test_case:
        raise HTTPException(status_code=404, detail="TestCase not found")
    
    # Check if metrics are already active
    # We can check if any MetricDefinition exists for this test case
    existing_metrics = session.exec(select(MetricDefinition).where(MetricDefinition.test_case_id == id)).first()
    if existing_metrics:
        raise HTTPException(status_code=409, detail="Metrics already confirmed for this test case")
    
    # Call LLM Stub
    llm_response = generate_metric_proposals(design.user_intent, test_case)

    # Persist user_intent on TestCase if not already set or if updated
    if test_case.user_intent != design.user_intent:
        test_case.user_intent = design.user_intent
        session.add(test_case)
    
    # Calculate iteration number
    last_iteration = session.exec(select(MetricDesignIteration).where(MetricDesignIteration.test_case_id == id).order_by(MetricDesignIteration.iteration_number.desc())).first()
    iteration_number = (last_iteration.iteration_number + 1) if last_iteration else 1
    
    # Save Iteration
    # We serialize proposed_metrics to JSON string for storage
    proposed_metrics_json = json.dumps([m.model_dump() for m in llm_response.proposed_metrics])
    
    iteration = MetricDesignIteration(
        test_case_id=id,
        iteration_number=iteration_number,
        user_intent=design.user_intent,
        llm_proposed_metrics=proposed_metrics_json,
        gap_analysis=llm_response.gap_analysis,
        feedback=None # Initial iteration has no feedback usually, or maybe from previous? Simplified for now.
    )
    session.add(iteration)
    session.commit()
    session.refresh(iteration)
    
    return iteration

@router.post("/{id}/metric-design/{iteration_id}/confirm", response_model=List[MetricDefinitionCreate]) # returning the created metrics
def confirm_metric_design(id: int, iteration_id: int, session: Session = Depends(get_session)):
    test_case = session.get(TestCase, id)
    if not test_case:
        raise HTTPException(status_code=404, detail="TestCase not found")

    # Check lock again
    existing_metrics = session.exec(select(MetricDefinition).where(MetricDefinition.test_case_id == id)).first()
    if existing_metrics:
        raise HTTPException(status_code=409, detail="Metrics already confirmed for this test case")

    iteration = session.get(MetricDesignIteration, iteration_id)
    if not iteration:
        raise HTTPException(status_code=404, detail="Iteration not found")
    if iteration.test_case_id != id:
        raise HTTPException(status_code=400, detail="Iteration does not belong to this test case")
    
    if iteration.confirmed_at:
        raise HTTPException(status_code=409, detail="Iteration already confirmed")

    # Create Metrics
    proposed_metrics_data = json.loads(iteration.llm_proposed_metrics or "[]")
    created_metrics = []
    
    for metric_data in proposed_metrics_data:
        # Validate via schema first
        metric_create = MetricDefinitionCreate(**metric_data)
        db_metric = MetricDefinition.model_validate(metric_create, update={"test_case_id": id, "is_active": True})
        session.add(db_metric)
        created_metrics.append(metric_create)
    
    # Mark iteration confirmed
    iteration.confirmed_at = datetime.utcnow()
    session.add(iteration)
    
    session.commit()
    
    return created_metrics

@router.post("/{id}/evaluate/preview", response_model=EvaluationRunPreviewResponse)
def preview_evaluation(id: int, request: EvaluationRunPreviewRequest, session: Session = Depends(get_session)):
    test_case = session.get(TestCase, id)
    if not test_case:
        raise HTTPException(status_code=404, detail="TestCase not found")
        
    metrics = session.exec(select(MetricDefinition).where(MetricDefinition.test_case_id == id, MetricDefinition.is_active == True)).all()
    if not metrics:
        raise HTTPException(status_code=409, detail="No active metrics for this test case")
        
    from app.services.evaluation import evaluate_test_case
    return evaluate_test_case(test_case, metrics, request.outputs)

@router.post("/{id}/evaluate/commit", response_model=EvaluationRunRead)
def commit_evaluation(id: int, request: EvaluationRunCommitRequest, session: Session = Depends(get_session)):
    test_case = session.get(TestCase, id)
    if not test_case:
        raise HTTPException(status_code=404, detail="TestCase not found")
        
    metrics = session.exec(select(MetricDefinition).where(MetricDefinition.test_case_id == id, MetricDefinition.is_active == True)).all()
    if not metrics:
        raise HTTPException(status_code=409, detail="No active metrics for this test case")

    # Run evaluation
    from app.services.evaluation import evaluate_test_case
    eval_response = evaluate_test_case(test_case, metrics, request.outputs)
    
    # Get next version number
    from app.models.evaluation import EvaluationRun, MetricResult
    last_run = session.exec(select(EvaluationRun).where(EvaluationRun.test_case_id == id).order_by(EvaluationRun.version_number.desc())).first()
    version_number = (last_run.version_number + 1) if last_run else 1
    
    # Create Run
    run = EvaluationRun(
        test_case_id=id,
        version_number=version_number,
        status="completed",
        aggregated_score=eval_response.aggregated_score,
        gap_analysis=eval_response.gap_analysis,
        notes=request.notes
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    
    # Create Results
    for res in eval_response.metric_results:
        metric_result = MetricResult(
            evaluation_run_id=run.id,
            metric_definition_id=res["metric_definition_id"],
            score=res["score"],
            reasoning=res["explanation"], # Mapping explanation to reasoning
            metric_name=res["metric_name"],
            explanation=res["explanation"],
            raw_json=res["raw_json"]
        )
        session.add(metric_result)
    
    session.commit()
    session.refresh(run)
    
    return run

@router.get("/{id}/runs", response_model=List[EvaluationRunRead])
def read_testcase_runs(id: int, session: Session = Depends(get_session)):
    from app.models.evaluation import EvaluationRun
    test_case = session.get(TestCase, id)
    if not test_case:
         raise HTTPException(status_code=404, detail="TestCase not found")
         
    runs = session.exec(select(EvaluationRun).where(EvaluationRun.test_case_id == id).order_by(EvaluationRun.version_number.desc())).all()
    return runs

@router.post("/{id}/report", response_model=ReportResponse)
def generate_report(id: int, request: ReportRequest, session: Session = Depends(get_session)):
    try:
        from app.services.report import create_test_case_report, ReportResponse as SvcResp
        report = create_test_case_report(session, id, request.start_date, request.end_date, request.start_version, request.end_version)
        # Parse content_json back for response
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

@router.get("/{id}/dashboard")
def get_testcase_dashboard(id: int, session: Session = Depends(get_session)):
    from app.models.evaluation import EvaluationRun, MetricResult
    from sqlalchemy import func
    
    test_case = session.get(TestCase, id)
    if not test_case:
        raise HTTPException(status_code=404, detail="TestCase not found")
        
    runs = session.exec(select(EvaluationRun).where(EvaluationRun.test_case_id == id).order_by(EvaluationRun.version_number.asc())).all()
    
    aggregated_score_points = [
        {"version_number": r.version_number, "score": r.aggregated_score, "created_at": r.created_at} 
        for r in runs if r.aggregated_score is not None
    ]
    
    # Get all metric results for these runs
    run_ids = [r.id for r in runs]
    if not run_ids:
         return {"aggregated_score_points": [], "metrics": []}
         
    results = session.exec(select(MetricResult).where(MetricResult.evaluation_run_id.in_(run_ids))).all()
    
    # Group by metric_definition_id
    metrics_map = {}
    for res in results:
        mid = res.metric_definition_id
        if mid not in metrics_map:
            # Find definition name if possible, or use res.metric_name
            metrics_map[mid] = {
                "metric_definition_id": mid,
                "metric_name": res.metric_name,
                "points": []
            }
        
        # Find run to get version number
        run = next((r for r in runs if r.id == res.evaluation_run_id), None)
        if run:
            metrics_map[mid]["points"].append({
                "version_number": run.version_number,
                "score": res.score,
                "created_at": run.created_at
            })
            
    # Sort points
    for m in metrics_map.values():
        m["points"].sort(key=lambda x: x["version_number"])
        
    return {
        "aggregated_score_points": aggregated_score_points,
        "metrics": list(metrics_map.values())
    }

@router.delete("/{id}", status_code=204)
def delete_testcase(id: int, session: Session = Depends(get_session)):
    test_case = session.get(TestCase, id)
    if not test_case:
        raise HTTPException(status_code=404, detail="TestCase not found")
    session.delete(test_case)
    session.commit()
    return None
