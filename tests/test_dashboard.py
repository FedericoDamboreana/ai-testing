from datetime import datetime, timedelta
import pytest
from sqlmodel import Session
from app.models.project import Project
from app.models.test_case import TestCase
from app.models.evaluation import EvaluationRun, MetricResult
from app.models.metric import MetricDefinition, MetricType, ScaleType, TargetDirection
from app.services.dashboard import get_test_case_dashboard, get_project_dashboard

def test_test_case_dashboard(session: Session):
    # Setup
    proj = Project(name="P1")
    session.add(proj)
    session.commit()
    
    tc = TestCase(name="TC1", project_id=proj.id, description="Desc")
    session.add(tc)
    session.commit()
    session.refresh(tc)
    
    m1 = MetricDefinition(
        name="M1", description="D", test_case_id=tc.id,
        metric_type=MetricType.DETERMINISTIC,
        scale_type=ScaleType.BOUNDED, scale_min=0, scale_max=100,
        target_direction=TargetDirection.HIGHER_IS_BETTER
    )
    session.add(m1)
    session.commit()
    
    # Run 1
    r1 = EvaluationRun(
        test_case_id=tc.id, version_number=1, status="completed",
        aggregated_score=50.0, created_at=datetime.utcnow() - timedelta(days=2)
    )
    session.add(r1)
    session.commit()
    session.add(MetricResult(evaluation_run_id=r1.id, metric_definition_id=m1.id, score=50.0))
    
    # Run 2
    r2 = EvaluationRun(
        test_case_id=tc.id, version_number=2, status="completed",
        aggregated_score=80.0, created_at=datetime.utcnow() - timedelta(days=1)
    )
    session.add(r2)
    session.commit()
    session.add(MetricResult(evaluation_run_id=r2.id, metric_definition_id=m1.id, score=80.0))
    session.commit()
    
    # Test Service
    dash = get_test_case_dashboard(session, tc.id)
    
    assert dash.test_case_name == "TC1"
    assert len(dash.aggregated_score_points) == 2
    assert dash.aggregated_score_points[0].score == 50.0
    assert dash.aggregated_score_points[0].version_number == 1
    assert dash.aggregated_score_points[1].score == 80.0
    
    assert len(dash.metrics) == 1
    series = dash.metrics[0]
    assert series.metric_name == "M1"
    assert len(series.points) == 2
    assert series.points[1].score == 80.0

def test_project_dashboard(session: Session):
    # Setup
    proj = Project(name="ProDash")
    session.add(proj)
    session.commit()
    session.refresh(proj)
    
    # TC with runs
    tc1 = TestCase(name="TC_Active", project_id=proj.id, description="Desc")
    session.add(tc1)
    session.commit()
    
    # Run for TC1
    r1 = EvaluationRun(
        test_case_id=tc1.id, version_number=5, status="completed",
        aggregated_score=90.0
    )
    session.add(r1)
    
    # TC without runs
    tc2 = TestCase(name="TC_Empty", project_id=proj.id, description="Desc")
    session.add(tc2)
    session.commit()
    
    dash = get_project_dashboard(session, proj.id)
    
    assert dash.project_name == "ProDash"
    assert dash.summary.total_test_cases == 2
    assert dash.summary.test_cases_with_runs == 1
    assert dash.summary.avg_latest_aggregated_score == 90.0
    
    assert len(dash.test_cases) == 2
    # Check ordering or specific checks
    active = next(t for t in dash.test_cases if t.test_case_name == "TC_Active")
    assert active.latest_run.aggregated_score == 90.0
    
    empty = next(t for t in dash.test_cases if t.test_case_name == "TC_Empty")
    assert empty.latest_run is None
