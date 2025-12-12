from typing import List, Optional, Dict, Any
from app.models.test_case import TestCase
from app.models.metric import MetricDefinition, MetricType, ScaleType, TargetDirection
from app.schemas.evaluation import EvaluationRunPreviewResponse

def evaluate_test_case(test_case: TestCase, metrics: List[MetricDefinition], outputs: List[str]) -> EvaluationRunPreviewResponse:
    """
    Deterministic stub for evaluation.
    """
    results = []
    scores_for_aggregation = []
    warnings = []
    
    # Heuristics based on first example if available
    desired_example = test_case.examples[0].content if test_case.examples else ""
    
    for metric in metrics:
        score = 0.0
        explanation = ""
        raw_json = "{}"
        
        # Simple string processing on first output
        output_text = outputs[0] if outputs else ""
        
        if metric.metric_type == MetricType.LLM_JUDGE and metric.scale_type == ScaleType.BOUNDED:
            # Heuristic: Length similarity + "good" keyword presence
            # Length matching: 50 pts if +/- 20% length
            len_ratio = len(output_text) / len(desired_example) if desired_example and len(desired_example) > 0 else 0
            len_score = 50.0 if 0.8 <= len_ratio <= 1.2 else 25.0
            
            # Keyword: 50 pts if output contains "metrics" (just a random keyword likely in test context)
            keyword_score = 50.0 if "metrics" in output_text.lower() or "active" in output_text.lower() else 10.0
            
            score = max(0.0, min(100.0, len_score + keyword_score))
            explanation = f"Evaluated length ratio ({len_ratio:.2f}) and keywords."
            raw_json = f'{{"length_ratio": {len_ratio:.2f}}}'
            
            scores_for_aggregation.append(score)
            
        elif metric.metric_type == MetricType.DETERMINISTIC and metric.scale_type == ScaleType.UNBOUNDED:
            # Count violations: "guaranteed", "risk-free", "100%"
            violations = 0
            blocklist = ["guaranteed", "risk-free", "100%"]
            for token in blocklist:
                violations += output_text.lower().count(token)
            
            score = float(violations)
            explanation = f"Found {violations} violations."
            # Unbounded excluded from aggregate
            warnings.append(f"Metric '{metric.name}' excluded from aggregate (unbounded).")
            
        else:
            # Default fallback for coverage
            score = 0.0
            explanation = "Stub default."
            if metric.scale_type == ScaleType.BOUNDED:
                 scores_for_aggregation.append(score)
        
        results.append({
            "metric_definition_id": metric.id,
            "metric_name": metric.name,
            "score": score,
            "explanation": explanation,
            "raw_json": raw_json
        })
    
    aggregated_score = sum(scores_for_aggregation) / len(scores_for_aggregation) if scores_for_aggregation else None
    
    return EvaluationRunPreviewResponse(
        metric_results=results,
        aggregated_score=aggregated_score,
        warnings=warnings
    )
