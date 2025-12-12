from abc import ABC, abstractmethod
from typing import Any, List, Optional
import json

from app.schemas.metric import StructuredLLMResponse, MetricDefinitionCreate, MetricType, ScaleType, TargetDirection
from app.models.test_case import TestCase
from app.core.config import settings

class LLMProvider(ABC):
    @abstractmethod
    def generate_metric_proposals(self, user_intent: str, test_case: TestCase) -> StructuredLLMResponse:
        pass

    @abstractmethod
    def generate_report_narrative(self, context_data: Any) -> str:
        pass

class StubLLMProvider(LLMProvider):
    def generate_metric_proposals(self, user_intent: str, test_case: TestCase) -> StructuredLLMResponse:
        # Deterministic stub logic (moved from service)
        return StructuredLLMResponse(
            proposed_metrics=[
                MetricDefinitionCreate(
                    name="Style similarity",
                    description="Assesses if the tone matches the brand guidelines.",
                    metric_type=MetricType.LLM_JUDGE,
                    scale_type=ScaleType.BOUNDED,
                    scale_min=0,
                    scale_max=100,
                    target_direction=TargetDirection.HIGHER_IS_BETTER,
                    evaluation_prompt="Rate stylistically from 0 to 100."
                ),
                MetricDefinitionCreate(
                    name="Instruction adherence",
                    description="Checks if all constraints in the prompt were followed.",
                    metric_type=MetricType.LLM_JUDGE,
                    scale_type=ScaleType.BOUNDED,
                    scale_min=0,
                    scale_max=100,
                    target_direction=TargetDirection.HIGHER_IS_BETTER,
                    evaluation_prompt="Score adherence from 0 to 100."
                ),
                MetricDefinitionCreate(
                    name="Policy violations count",
                    description="Counts occurrences of forbidden words.",
                    metric_type=MetricType.DETERMINISTIC,
                    scale_type=ScaleType.UNBOUNDED,
                    target_direction=TargetDirection.LOWER_IS_BETTER,
                    rule_definition="Count violations of forbidden words."
                )
            ],
            gap_analysis=f"Analyzed intent: '{user_intent}'. Proposals cover style, adherence, and safety."
        )

    def generate_report_narrative(self, content: Any) -> str:
        # Deterministic stub logic (moved from service helper)
        if content.aggregated_score_direction == "improved":
            summary = f"Overall quality improved (delta: {content.aggregated_score_delta:.2f})."
        elif content.aggregated_score_direction == "worsened":
            summary = f"Overall quality worsened (delta: {content.aggregated_score_delta:.2f})."
        else:
            summary = "Overall quality remained stable."
            
        for metric in content.metric_comparison:
            if abs(metric.delta) > 0:
                summary += f" {metric.metric_name} {metric.direction} by {abs(metric.delta):.2f} points."
        return summary

class OpenAILLMProvider(LLMProvider):
    def __init__(self):
        try:
             from openai import OpenAI
             self.client = OpenAI(api_key=settings.OPENAI_API_KEY.get_secret_value() if settings.OPENAI_API_KEY else None)
             self.model = settings.OPENAI_MODEL
        except ImportError:
            raise ImportError("openai package is required for OpenAILLMProvider")

    def generate_metric_proposals(self, user_intent: str, test_case: TestCase) -> StructuredLLMResponse:
        system_prompt = """You are an expert in evaluating qualitative AI outputs.

Your task is to design evaluation metrics for a test case.
The goal is to transform subjective quality requirements into clear, measurable metrics
that can be tracked consistently over time.

You must follow these rules strictly:
1. Think step by step before producing the final output.
2. Propose metrics that are stable, comparable across versions, and non-overlapping.
3. Prefer fewer, high-signal metrics over many weak ones.
4. Each metric must measure a single, clearly defined quality dimension.
5. Metrics must be suitable for longitudinal evaluation.

Metric rules:
- Use LLM_JUDGE only for subjective qualities such as style, clarity, coherence, or reasoning quality.
- Use DETERMINISTIC only for objective rule-based checks or counts.
- Strongly prefer BOUNDED metrics with a 0–100 scale unless there is a compelling reason not to.
- Use UNBOUNDED metrics only for counts such as violations or missing elements.
- Every LLM_JUDGE metric must include a clear evaluation_prompt.
- Every DETERMINISTIC metric must include a clear rule_definition.

Output rules:
- Return a strict JSON object matching the provided schema.
- Do not include explanations outside the JSON."""

        user_content = f"""User Intent: {user_intent}
Test Case: {test_case.name}
Description: {test_case.description}
Examples: {[e.content for e in test_case.examples]}"""

        # Use Responses API as requested
        # Note: The user provided snippet uses client.responses.parse
        # input=[{"role": ...}], text_format=Model
        
        response = self.client.responses.parse(
            model=self.model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            text_format=StructuredLLMResponse
        )
        
        # event = response.output_parsed
        return response.output_parsed

    def generate_report_narrative(self, context_data: Any) -> str:
        # context_data is ReportContent pydantic model
        system_prompt = """You are a Data Analyst writing a business summary for an LLM evaluation report.
Analyze the provided metric deltas and aggregated score changes.
Write a concise, natural language paragraph explaining what improved, what worsened, and any significant trends.
Do not use markdown formatting. Keep it professional."""

        user_content = f"Report Data: {context_data.model_dump_json()}"

        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=0.2
        )
        return completion.choices[0].message.content.strip()

def get_llm_provider() -> LLMProvider:
    if settings.LLM_MODE == "openai":
        return OpenAILLMProvider()
    return StubLLMProvider()
