from typing import List, Optional
from app.schemas.metric import StructuredLLMResponse, MetricDefinitionCreate, MetricType, ScaleType, TargetDirection
from app.models.test_case import TestCase
from app.providers.llm import get_llm_provider

def generate_metric_proposals(user_intent: str, test_case: TestCase, model_name: Optional[str] = None) -> StructuredLLMResponse:
    provider = get_llm_provider(override_model=model_name)
    return provider.generate_metric_proposals(user_intent, test_case)
