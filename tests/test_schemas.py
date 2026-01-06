import pytest
from app.schemas.project import ProjectCreate, TestCaseCreate
from app.schemas.metric import MetricDefinitionCreate, MetricType, ScaleType, TargetDirection

def test_project_create_schema():
    project = ProjectCreate(name="Test Project", description="A test project")
    assert project.name == "Test Project"
    assert project.description == "A test project"

def test_metric_definition_create_schema():
    metric = MetricDefinitionCreate(
        name="Accuracy",
        description="Measures accuracy",
        metric_type=MetricType.DETERMINISTIC,
        scale_type=ScaleType.BOUNDED,
        scale_min=0.0,
        scale_max=100.0,
        target_direction=TargetDirection.HIGHER_IS_BETTER,
        rule_definition="Rule"
    )
    assert metric.name == "Accuracy"
    assert metric.metric_type == MetricType.DETERMINISTIC
    assert metric.target_direction == TargetDirection.HIGHER_IS_BETTER

    # Invalid: Unbounded with bounds
    # Valid: Unbounded with bounds (auto-fixed)
    m_unbounded = MetricDefinitionCreate(
        name="Test", description="Desc", metric_type=MetricType.DETERMINISTIC,
        scale_type=ScaleType.UNBOUNDED,
        scale_min=0, scale_max=100,
        target_direction=TargetDirection.HIGHER_IS_BETTER,
        rule_definition="Rule"
    )
    assert m_unbounded.scale_min is None
    assert m_unbounded.scale_max is None
        
    # Valid: LLM_JUDGE with prompt
    MetricDefinitionCreate(
        name="Test", description="Desc", metric_type=MetricType.LLM_JUDGE,
        scale_type=ScaleType.BOUNDED, scale_min=1, scale_max=5,
        target_direction=TargetDirection.HIGHER_IS_BETTER,
        evaluation_prompt="Prompt"
    )

    # Invalid: LLM_JUDGE without prompt
    with pytest.raises(ValueError, match="evaluation_prompt"):
        MetricDefinitionCreate(
            name="Test", description="Desc", metric_type=MetricType.LLM_JUDGE,
            scale_type=ScaleType.BOUNDED, scale_min=1, scale_max=5,
            target_direction=TargetDirection.HIGHER_IS_BETTER
        )

    # Valid: DETERMINISTIC with rule
    MetricDefinitionCreate(
        name="Test", description="Desc", metric_type=MetricType.DETERMINISTIC,
        scale_type=ScaleType.UNBOUNDED,
        target_direction=TargetDirection.LOWER_IS_BETTER,
        rule_definition="Rule"
    )

    # Invalid: DETERMINISTIC without rule
    with pytest.raises(ValueError, match="rule_definition"):
        MetricDefinitionCreate(
            name="Test", description="Desc", metric_type=MetricType.DETERMINISTIC,
            scale_type=ScaleType.UNBOUNDED,
            target_direction=TargetDirection.LOWER_IS_BETTER
        )

    # Invalid: Weird scale range
    with pytest.raises(ValueError, match="scale_max"):
        MetricDefinitionCreate(
            name="Test", description="Desc", metric_type=MetricType.LLM_JUDGE,
            scale_type=ScaleType.BOUNDED, scale_min=0, scale_max=42,
            target_direction=TargetDirection.HIGHER_IS_BETTER,
            evaluation_prompt="Prompt"
        )

def test_metric_invalid_enum():
    with pytest.raises(ValueError):
        MetricDefinitionCreate(
            name="Bad Metric",
            description="Invalid type",
            metric_type="INVALID_TYPE", # type: ignore
            scale_type=ScaleType.BOUNDED,
            target_direction=TargetDirection.HIGHER_IS_BETTER
        )
