from fastapi.testclient import TestClient
from sqlmodel import Session
from app.models.project import Project
from app.models.test_case import TestCase, Example
from app.models.metric import MetricDefinition, MetricType, ScaleType, TargetDirection
from app.models.evaluation import EvaluationRun
import pytest

def test_evaluation_workflow(client: TestClient, session: Session):
    # Setup: Project, TestCase, and Confirmed Metrics
    project = Project(name="Test Project")
    session.add(project)
    session.commit()
    test_case = TestCase(name="Eval Test Case", project_id=project.id)
    session.add(test_case)
    session.commit()
    
    # Needs example for heuristic
    example = Example(content="Desired baseline content", test_case_id=test_case.id)
    session.add(example)
    session.commit()
    
    # Create Metrics directly (skipping iterative design for speed)
    m1 = MetricDefinition(
        test_case_id=test_case.id,
        name="Length Similarity",
        description="Checks length",
        metric_type=MetricType.LLM_JUDGE,
        scale_type=ScaleType.BOUNDED,
        scale_min=0,
        scale_max=100,
        target_direction=TargetDirection.HIGHER_IS_BETTER,
        evaluation_prompt="Score length similarity from 0 to 100."
    )
    m2 = MetricDefinition(
        name="Guaranteed Count",
        description="Counts spam words",
        test_case_id=test_case.id,
        metric_type=MetricType.DETERMINISTIC,
        scale_type=ScaleType.UNBOUNDED,
        target_direction=TargetDirection.LOWER_IS_BETTER,
        rule_definition="Count occurrences of 'spam'."
    )
    session.add(m1)
    session.add(m2)
    session.commit()
    
    # 1. Test Preview
    response = client.post(
        f"/api/v1/testcases/{test_case.id}/evaluate/preview",
        json={"outputs": ["Desired baseline content"]} # Should match length -> high score
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["metric_results"]) == 2
    assert data["aggregated_score"] is not None
    
    # Check bounded metric score (should be 50.0 based on heuristic strict match len but no "metrics" keyword)
    # Heuristic: 0.8 <= ratio <= 1.2 -> 50.0
    # ratio 1.0 -> 50.0. Keyword "metrics" not in "Desired baseline content" -> 10.0 => 60.0?
    # Wait, service logic: score = len_score + keyword_score.
    # len_score = 50.0. keyword_score = 10.0. sum = 60.0.
    bounded_result = next(r for r in data["metric_results"] if r["metric_name"] == "Length Similarity")
    assert bounded_result["score"] == 60.0
    
    # Check unbounded (should be excluded from aggregate)
    unbounded_result = next(r for r in data["metric_results"] if r["metric_name"] == "Guaranteed Count")
    assert "Guaranteed Count" in unbounded_result["metric_name"]
    warnings = data["warnings"]
    assert any("unbounded" in w for w in warnings)
    
    # 2. Test Commit
    response = client.post(
        f"/api/v1/testcases/{test_case.id}/evaluate/commit",
        json={"outputs": ["Desired baseline content"], "notes": "First run"}
    )
    assert response.status_code == 200
    run_data = response.json()
    assert run_data["version_number"] == 1
    assert run_data["aggregated_score"] == 60.0
    
    # 3. Test Commit Second Run (Version Increment)
    response = client.post(
        f"/api/v1/testcases/{test_case.id}/evaluate/commit",
        json={"outputs": ["Different content"], "notes": "Second run"}
    )
    assert response.status_code == 200
    run_data_2 = response.json()
    assert run_data_2["version_number"] == 2
    
    # 4. List Runs
    response = client.get(f"/api/v1/testcases/{test_case.id}/runs")
    assert response.status_code == 200
    runs = response.json()
    assert len(runs) == 2
    assert runs[0]["version_number"] == 2 # Descending order

    # 5. Get Run Detail
    response = client.get(f"/api/v1/runs/{run_data['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == run_data["id"]
    assert len(response.json()["metric_results"]) == 2

def test_preview_fail_no_metrics(client: TestClient, session: Session):
    project = Project(name="Test Project No Metrics")
    session.add(project)
    session.commit()
    test_case = TestCase(name="No Metrics Case", project_id=project.id)
    session.add(test_case)
    session.commit()
    
    response = client.post(
        f"/api/v1/testcases/{test_case.id}/evaluate/preview",
        json={"outputs": ["test"]}
    )
    assert response.status_code == 409
