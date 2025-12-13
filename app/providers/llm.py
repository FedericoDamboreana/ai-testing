from abc import ABC, abstractmethod
from typing import Any, List, Optional
import json

from app.models.metric import MetricDefinition, MetricType, ScaleType, TargetDirection, MetricDesignIteration
from app.models.test_case import TestCase
from app.schemas.metric import MetricDefinitionCreate, StructuredLLMResponse
from app.schemas.llm_validation import JudgeResult
from app.core.config import settings

class LLMProvider(ABC):
    @abstractmethod
    def generate_metric_proposals(self, intent: str, test_case: TestCase) -> StructuredLLMResponse:
        pass

    @abstractmethod
    def generate_report_narrative(self, context_data: Any) -> str:
        pass

    @abstractmethod
    def judge_metric(self, metric: MetricDefinition, candidate_text: str, test_case_context: str) -> JudgeResult:
        pass

class StubLLMProvider(LLMProvider):
    def generate_metric_proposals(self, intent: str, test_case: TestCase) -> StructuredLLMResponse:
        # Deterministic stub returning 5 metrics
        return StructuredLLMResponse(
            reasoning_summary="Stable deterministic reasoning.",
            gap_analysis="No gaps found in stub mode.",
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
                    description="Counts the number of policy violations in the response.",
                    metric_type=MetricType.LLM_JUDGE,
                    scale_type=ScaleType.UNBOUNDED,
                    target_direction=TargetDirection.LOWER_IS_BETTER,
                    evaluation_prompt="Count violations."
                ),
                MetricDefinitionCreate(
                    name="Response latency",
                    description="Measures the time taken to generate the response.",
                    metric_type=MetricType.DETERMINISTIC,
                    scale_type=ScaleType.UNBOUNDED,
                    target_direction=TargetDirection.LOWER_IS_BETTER,
                    rule_definition="Measure time."
                ),
                MetricDefinitionCreate(
                    name="Token count",
                    description="Counts the total number of tokens in the response.",
                    metric_type=MetricType.DETERMINISTIC,
                    scale_type=ScaleType.UNBOUNDED,
                    target_direction=TargetDirection.LOWER_IS_BETTER,
                    rule_definition="Count tokens."
                )
            ]
        )

    def generate_report_narrative(self, content: Any) -> str:
        return "Deterministic narrative based on stub data."
        
    def judge_metric(self, metric: MetricDefinition, candidate_text: str, test_case_context: str) -> JudgeResult:
        # Deterministic scoring based on hash of text
        score = float(len(candidate_text) % 100)
        return JudgeResult(
            score=score,
            explanation=f"Stub judged based on length ({len(candidate_text)} chars)."
        )

class OpenAILLMProvider(LLMProvider):
    def __init__(self):
        # Fail fast if key missing
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is required for OpenAILLMProvider")
        try:
             from openai import OpenAI
             self.client = OpenAI(api_key=settings.OPENAI_API_KEY.get_secret_value())
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

        desired_examples = [e.content for e in test_case.examples if e.type == "desired"]
        current_examples = [e.content for e in test_case.examples if e.type == "current"]
        
        user_content = f"""User Intent: {user_intent}
Test Case: {test_case.name}
Description: {test_case.description}

Desired Output Examples (Target):
{json.dumps(desired_examples, indent=2)}

Current Output Examples (Baseline - flawed):
{json.dumps(current_examples, indent=2)}

Analyze the gap between Desired and Current examples given the User Intent.
Design metrics that specifically measure this gap."""

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

    def judge_metric(self, metric: MetricDefinition, candidate_text: str, test_case_context: str) -> JudgeResult:
        system_prompt = f"""You are an AI Judge evaluating an LLM response.
        
Metric Name: {metric.name}
Metric Description: {metric.description}
Evaluation Prompt: {metric.evaluation_prompt}

Context:
{test_case_context}

Constraint:
Output must be in JSON format with 'score' (float) and 'explanation' (short English text).
"""
        user_content = f"Evaluate this Text:\n---\n{candidate_text}\n---"

        response = self.client.responses.parse(
            model=self.model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            text_format=JudgeResult
        )
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
