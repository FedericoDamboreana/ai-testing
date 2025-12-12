from fastapi.testclient import TestClient
from sqlmodel import Session
from app.models.project import Project
from app.models.test_case import TestCase, Example
from app.models.metric import MetricDesignIteration, MetricDefinition
from app.models.evaluation import EvaluationRun
import pytest

def test_metric_design_workflow(client: TestClient, session: Session):
    # Setup: Create Project and TestCase
    project = Project(name="Test Project")
    session.add(project)
    session.commit()
    
    test_case = TestCase(name="Test Case 1", project_id=project.id)
    session.add(test_case)
    session.commit()
    
    # 1. Create Example
    response = client.post(
        f"/api/v1/testcases/{test_case.id}/examples",
        json={"content": "This is a test example."}
    )
    assert response.status_code == 200
    
    # 2. Start Metric Design Iteration
    response = client.post(
        f"/api/v1/testcases/{test_case.id}/metric-design",
        json={
            "user_intent": "I want to check tone.",
            "user_suggested_metrics": []
        }
    )
    assert response.status_code == 200
    data = response.json()
    iteration_id = data["id"]
    assert data["user_intent"] == "I want to check tone."
    assert "Style similarity" in data["llm_proposed_metrics"] # Check stub output
    
    # 3. Confirm Metric Design
    response = client.post(
        f"/api/v1/testcases/{test_case.id}/metric-design/{iteration_id}/confirm"
    )
    assert response.status_code == 200
    created_metrics = response.json()
    assert len(created_metrics) == 3 # Stub returns 3 metrics
    
    # Verify metrics in DB
    metrics = session.query(MetricDefinition).filter(MetricDefinition.test_case_id == test_case.id).all()
    assert len(metrics) == 3
    
    # 4. Enforce Immutability (Second Design Attempt)
    response = client.post(
        f"/api/v1/testcases/{test_case.id}/metric-design",
        json={"user_intent": "Attempt to change metrics"}
    )
    assert response.status_code == 409
    
    # 5. Enforce Immutability (Second Confirm Attempt - on same iteration)
    response = client.post(
        f"/api/v1/testcases/{test_case.id}/metric-design/{iteration_id}/confirm"
    )
    assert response.status_code == 409 # Metrics already confirmed (global check catches this first)

def test_metric_validation(client: TestClient):
    from app.schemas.metric import MetricDefinitionCreate, MetricType, ScaleType, TargetDirection
    
    # Helper to validate directly via pydantic
    
    # Valid
    MetricDefinitionCreate(
        name="Valid", description="desc", metric_type=MetricType.LLM_JUDGE,
        scale_type=ScaleType.BOUNDED, scale_min=0, scale_max=10,
        target_direction=TargetDirection.NEUTRAL,
        evaluation_prompt="Prompt"
    )
    
    # Invalid Bounded (missing limits)
    with pytest.raises(ValueError):
        MetricDefinitionCreate(
            name="Invalid", description="desc", metric_type=MetricType.LLM_JUDGE,
            scale_type=ScaleType.BOUNDED, scale_min=None, scale_max=None,
            target_direction=TargetDirection.NEUTRAL
        )

    # Invalid Unbounded (present limits)
    with pytest.raises(ValueError):
        MetricDefinitionCreate(
            name="Invalid", description="desc", metric_type=MetricType.LLM_JUDGE,
            scale_type=ScaleType.UNBOUNDED, scale_min=0, scale_max=None,
            target_direction=TargetDirection.NEUTRAL
        )
