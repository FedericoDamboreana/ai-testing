from typing import List, Optional
from pydantic import BaseModel
from app.schemas.metric import MetricDefinitionRead

class MetricResultRead(BaseModel):
    id: int
    evaluation_run_id: int
    metric_definition_id: int
    metric_name: str
    score: float
    explanation: Optional[str] = None
    reasoning: Optional[str] = None
    raw_json: Optional[str] = None
    metric_definition: Optional[MetricDefinitionRead] = None

class EvaluationRunCommitRequest(BaseModel):
    outputs: List[str]
    notes: Optional[str] = None

class EvaluationRunPreviewRequest(BaseModel):
    outputs: List[str]
    notes: Optional[str] = None

class EvaluationRunPreviewResponse(BaseModel):
    metric_results: List[dict] # Simplified list of results (definition_id, name, score, explanation)
    aggregated_score: Optional[float]
    gap_analysis: Optional[str] = None
    warnings: List[str]

class AggregatedScoreRead(BaseModel):
    metric_id: int
    metric_name: str
    average_score: float
    version: int

class EvaluationRunRead(BaseModel):
    id: int
    test_case_id: int
    version_number: int
    status: str
    aggregated_score: Optional[float] = None
    gap_analysis: Optional[str] = None
    notes: Optional[str] = None
    metric_results: List[MetricResultRead] = []
