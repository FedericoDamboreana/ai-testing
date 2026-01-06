from datetime import datetime
from fastapi.testclient import TestClient
from sqlmodel import Session
from app.models.project import Project
from app.models.test_case import TestCase, Example
from app.models.metric import MetricDefinition, MetricType, ScaleType, TargetDirection
from app.models.evaluation import EvaluationRun, MetricResult
from app.models.report import Report
import pytest

def test_report_workflow(auth_client: TestClient, session: Session):
    # Setup
    project = Project(name="Report Project")
    session.add(project)
    session.commit()
    test_case = TestCase(name="Report TC", project_id=project.id)
    session.add(test_case)
    session.commit()
    
    # Metrics
    m1 = MetricDefinition(test_case_id=test_case.id, name="Score", metric_type=MetricType.DETERMINISTIC, scale_type=ScaleType.BOUNDED, scale_min=0, scale_max=100, target_direction=TargetDirection.HIGHER_IS_BETTER, description="test")
    session.add(m1)
    session.commit()
    
    # Run 1 (Earlier)
    run1 = EvaluationRun(test_case_id=test_case.id, version_number=1, aggregated_score=50.0, created_at=datetime(2023, 1, 1))
    session.add(run1)
    session.commit()
    res1 = MetricResult(evaluation_run_id=run1.id, metric_definition_id=m1.id, score=50.0, metric_name="Score")
    session.add(res1)
    
    # Run 2 (Later)
    run2 = EvaluationRun(test_case_id=test_case.id, version_number=2, aggregated_score=60.0, created_at=datetime(2023, 2, 1))
    session.add(run2)
    session.commit()
    res2 = MetricResult(evaluation_run_id=run2.id, metric_definition_id=m1.id, score=60.0, metric_name="Score")
    session.add(res2)
    session.commit()
    
    # 1. Generate Test Case Report
    response = auth_client.post(
        f"/api/v1/testcases/{test_case.id}/report",
        json={"start_date": "2022-12-31T00:00:00", "end_date": "2023-03-01T00:00:00"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scope_type"] == "test_case"
    assert "Deterministic narrative" in data["summary_text"]
    
    content = data["report_content"]
    assert content["aggregated_score_delta"] == 10.0
    assert len(content["metric_comparison"]) == 1
    assert content["metric_comparison"][0]["delta"] == 10.0
    
    # 2. Generate Project Report
    response = auth_client.post(
        f"/api/v1/projects/{project.id}/report",
        json={"start_date": "2022-12-31T00:00:00", "end_date": "2023-03-01T00:00:00"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scope_type"] == "project"
    content = data["report_content"]
    assert content["improving_count"] == 1
    assert "Deterministic narrative" in data["summary_text"]

    # 3. Insufficient data
    test_case_empty = TestCase(name="Empty TC", project_id=project.id)
    session.add(test_case_empty)
    session.commit()
    response = auth_client.post(
        f"/api/v1/testcases/{test_case_empty.id}/report",
        json={"start_date": "2022-12-31T00:00:00", "end_date": "2023-03-01T00:00:00"}
    )
    assert response.status_code == 400
