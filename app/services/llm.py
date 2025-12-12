from typing import List, Optional
from app.schemas.metric import StructuredLLMResponse, MetricDefinitionCreate, MetricType, ScaleType, TargetDirection
from app.models.test_case import TestCase

def generate_metric_proposals(user_intent: str, test_case: TestCase) -> StructuredLLMResponse:
    """
    Deterministic stub for LLM metric generation.
    """
    
    proposed_metrics = [
        MetricDefinitionCreate(
            name="Style similarity",
            description="Evaluates if the style matches the reference.",
            metric_type=MetricType.LLM_JUDGE,
            scale_type=ScaleType.BOUNDED,
            scale_min=0.0,
            scale_max=100.0,
            target_direction=TargetDirection.HIGHER_IS_BETTER,
            evaluation_prompt="Analyze the style similarity..."
        ),
        MetricDefinitionCreate(
            name="Instruction adherence",
            description="Checks if all instructions were followed.",
            metric_type=MetricType.LLM_JUDGE,
            scale_type=ScaleType.BOUNDED,
            scale_min=0.0,
            scale_max=100.0,
            target_direction=TargetDirection.HIGHER_IS_BETTER,
            evaluation_prompt="Check instruction adherence..."
        ),
        MetricDefinitionCreate(
            name="Policy violations count",
            description="Count of privacy or content policy violations.",
            metric_type=MetricType.DETERMINISTIC,
            scale_type=ScaleType.UNBOUNDED,
            scale_min=None,
            scale_max=None,
            target_direction=TargetDirection.LOWER_IS_BETTER,
            rule_definition="count_violations(text)"
        )
    ]

    return StructuredLLMResponse(
        gap_analysis=f"Analyzed intent: '{user_intent}'. Found {len(test_case.examples)} examples. Gaps identified: None.",
        proposed_metrics=proposed_metrics,
        reasoning_summary="Proposed standard metrics based on intent."
    )
