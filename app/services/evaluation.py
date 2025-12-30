import json
from typing import List, Optional, Dict, Any
from app.models.evaluation import EvaluationRun, MetricResult
from app.models.metric import MetricDefinition, MetricType, ScaleType, TargetDirection
from app.models.test_case import TestCase
from app.services.llm import get_llm_provider
from app.providers.llm import StubLLMProvider
from app.schemas.evaluation import EvaluationRunPreviewResponse

def evaluate_test_case(test_case: TestCase, metrics: List[MetricDefinition], outputs: List[str]) -> EvaluationRunPreviewResponse:
    """
    Deterministic stub for evaluation.
    """
    results = []
    scores_for_aggregation = []
    warnings = []
    
    # Instantiate provider once
    provider = get_llm_provider()
    
    # Construct context context for judgment
    context_str = f"Test Case: {test_case.name}\nDescription: {test_case.description}\nIntent: {test_case.user_intent}"
    if test_case.examples:
        context_str += "\nExamples:\n" + "\n".join([f"- {e.type}: {e.content}" for e in test_case.examples])

    for metric in metrics:
        score = 0.0
        explanation = ""
        raw_json = "{}"
        
        # Simple string processing on first output (or join them?)
        # Requirement implies we evaluate "the output". If multiple, maybe we evaluate the set?
        # Current stub used outputs[0]. Let's stick to outputs[0] for now or join. 
        # Usually LLM eval evaluates a single response against criteria.
        candidate_text = outputs[0] if outputs else ""
        
        if metric.metric_type == MetricType.LLM_JUDGE:
            # Delegate to LLM Provider
            try:
                judge_result = provider.judge_metric(metric, candidate_text, context_str)
                score = judge_result.score
                explanation = judge_result.explanation
                raw_json = json.dumps(judge_result.model_dump())
            except Exception as e:
                explanation = f"Error during LLM judgment: {str(e)}"
                score = 0.0
            
            if metric.scale_type == ScaleType.BOUNDED:
                scores_for_aggregation.append(score)

        elif metric.metric_type == MetricType.DETERMINISTIC and metric.scale_type == ScaleType.UNBOUNDED:
            # Count violations: "guaranteed", "risk-free", "100%"
            # Keep this separate hardcoded, OR move to provider? 
            # Provider interface has `judge_metric` which returns a score.
            # But the deterministic logic (counting tokens) is currently hardcoded here.
            # Let's keep the hardcoded logic for DETERMINISTIC for now as a fallback/hybrid, 
            # unless the user wants *everything* through LLM (which might be overkill for regex).
            # But wait, `judge_metric` in StubProvider returns deterministic hash.
            # If we want REAL evaluation, we should use the provider for LLM_JUDGE.
            
            violations = 0
            blocklist = ["guaranteed", "risk-free", "100%"]
            for token in blocklist:
                violations += candidate_text.lower().count(token)
            
            score = float(violations)
            explanation = f"Found {violations} violations."
            
            if metric.target_direction == TargetDirection.LOWER_IS_BETTER:
                # Invert score: 0 violations is perfect (100)
                # Any violations is failure (0) - strict zero tolerance
                # Could be made more granular (e.g. 100 - n*10), but strict is safer for "violations"
                final_score = 100.0 if violations == 0 else 0.0
                score = final_score
                scores_for_aggregation.append(score)
            else:
                # Unbounded excluded from aggregate
                warnings.append(f"Metric '{metric.name}' excluded from aggregate (unbounded).")
            
        elif metric.metric_type == MetricType.DETERMINISTIC and metric.scale_type == ScaleType.BOUNDED:
            # Handle text length range checks with dynamic range from examples
            text_len = len(candidate_text)
            
            # Find desired examples
            desired_examples = [e for e in test_case.examples if e.type == "desired"]
            
            if desired_examples:
                lengths = [len(e.content) for e in desired_examples]
                # Calculate dynamic range with 10% buffer
                min_len = min(lengths)
                max_len = max(lengths)
                
                target_min = int(min_len * 0.9)
                target_max = int(max_len * 1.1)
                
                origin_desc = f"derived from {len(desired_examples)} desired examples"
            else:
                # Fallback to metric definition
                target_min = metric.scale_min if metric.scale_min is not None else 0
                target_max = metric.scale_max if metric.scale_max is not None else float('inf')
                origin_desc = "from metric definition"
            
            if target_min <= text_len <= target_max:
                score = 100.0
                explanation = f"Text length ({text_len} chars) is within range [{target_min}, {target_max}] ({origin_desc})."
            else:
                score = 0.0
                explanation = f"Text length ({text_len} chars) is outside range [{target_min}, {target_max}] ({origin_desc})."
                
            scores_for_aggregation.append(score)
        
        results.append({
            "metric_definition_id": metric.id,
            "metric_name": metric.name,
            "score": score,
            "explanation": explanation,
            "raw_json": raw_json
        })
    
    aggregated_score = sum(scores_for_aggregation) / len(scores_for_aggregation) if scores_for_aggregation else None
    

    # Generate Gap Analysis
    provider = get_llm_provider()
    gap_analysis = provider.analyze_evaluation_results(test_case, results)

    return EvaluationRunPreviewResponse(
        metric_results=results,
        aggregated_score=aggregated_score,
        gap_analysis=gap_analysis,
        warnings=warnings
    )
