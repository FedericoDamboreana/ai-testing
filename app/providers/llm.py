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

    @abstractmethod
    def analyze_evaluation_results(self, test_case: TestCase, metric_results: List[Any]) -> str:
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
                    metric_type=MetricType.DETERMINISTIC,
                    scale_type=ScaleType.UNBOUNDED,
                    target_direction=TargetDirection.LOWER_IS_BETTER,
                    evaluation_prompt="Count violations.", # Stub legacy
                    rule_definition="Count violations."
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

    def analyze_evaluation_results(self, test_case: TestCase, metric_results: List[Any]) -> str:
        return f"Stub Gap Analysis for {test_case.name}: Performance is consistent with expectations based on {len(metric_results)} metrics."

class OpenAILLMProvider(LLMProvider):
    def __init__(self, override_model: Optional[str] = None):
        # Fail fast if key missing
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is required for OpenAILLMProvider")
        try:
             from openai import OpenAI
             self.client = OpenAI(api_key=settings.OPENAI_API_KEY.get_secret_value())
             # Use override if provided, else settings default
             self.model = override_model if override_model else settings.OPENAI_MODEL
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
- Use LLM_JUDGE for ANY check involving meaning, semantics, tone, creativity, or complex reasoning.
- Use DETERMINISTIC ONLY for simple, objective rule-based checks:
  - Exact substring presence/absence.
  - Regex pattern matching.
  - Numeric constraints (word count, character count, sentence length).
- If a metric requires understanding the *context* or *intent* of a word (e.g., "uses action verbs", "references specific assets"), it MUST be LLM_JUDGE.
- Strongly prefer BOUNDED metrics with a 0–100 scale unless there is a compelling reason not to.
- Use UNBOUNDED metrics only for raw counts (e.g., violations, words).
- Every LLM_JUDGE metric must include a clear evaluation_prompt.
- Every DETERMINISTIC metric must include a clear rule_definition (regex or logic).

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
        # context_data is now expected to be a dict with 'test_case_name', 'history': [{version, score, gap_analysis}]
        
        system_prompt = """You are a lead Data Analyst. 
Your goal is to write a cohesive 'Story of Progress' for an executive report.

Input: A chronological list of evaluation versions, each with a score and a detailed gap analysis.
Task: Synthesize these inputs into a single, flowing narrative that analyzes the **overall trajectory** from the first version to the last.
- IGNORE intermediate version details unless they represent a critical turning point.
- Focus strictly on comparing the STARTING STATE vs the ENDING STATE.
- What specific flaws were present initially?
- How were they resolved (or not) by the final version?

Style Guidelines:
- Write in a professional, reporting tone.
- Do NOT output a chronological list (e.g., "Version 1... Version 2..."). Focus on the net evolution.
- Round all scores to 1 decimal place.
- Do NOT use em-dashes (—). Use normal dashes (-) or colons (:) instead.
- Use bolding (**) for key terms or metrics for readability.
- Do NOT include any "[End of Report]" text.
"""

        if hasattr(context_data, "model_dump_json"):
             user_content = f"Report Data: {context_data.model_dump_json()}"
        else:
             user_content = f"Report Data: {json.dumps(context_data, indent=2)}"

        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        )
        return completion.choices[0].message.content.strip()

    def analyze_evaluation_results(self, test_case: TestCase, metric_results: List[Any]) -> str:
        system_prompt = """You are a QA Analyst suitable for analyzing the results of a specific test case evaluation.
Review the scores and explanations for each metric. Identify the main performance gap or success.
Provide a short, 1-2 sentence "Gap Analysis" summarizing the model's current performance state on this test case.
"""
        # simplified serialization
        results_summary = [{"name": r.get('metric_name'), "score": r.get('score'), "explanation": r.get('explanation')} for r in metric_results]
        
        user_content = f"Test Case: {test_case.name}\nResults: {json.dumps(results_summary, indent=2)}"

        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],

        )
        return completion.choices[0].message.content.strip()

def get_llm_provider(override_model: Optional[str] = None) -> LLMProvider:
    if settings.LLM_MODE == "openai":
        return OpenAILLMProvider(override_model=override_model)
    return StubLLMProvider()

