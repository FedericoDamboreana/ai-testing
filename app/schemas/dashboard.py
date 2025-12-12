from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.models.metric import MetricType, ScaleType, TargetDirection

class MetricPoint(BaseModel):
    version_number: int
    created_at: datetime
    score: float

class MetricSeries(BaseModel):
    metric_definition_id: int
    metric_name: str
    scale_type: ScaleType
    target_direction: TargetDirection
    points: List[MetricPoint]

class TestCaseDashboardResponse(BaseModel):
    test_case_id: int
    test_case_name: str
    metrics: List[MetricSeries]
    aggregated_score_points: List[MetricPoint]

class RunSummary(BaseModel):
    version_number: int
    created_at: datetime
    aggregated_score: Optional[float] = None

class MetricScore(BaseModel):
    metric_definition_id: int
    metric_name: str
    score: float

class TestCaseSummary(BaseModel):
    test_case_id: int
    test_case_name: str
    latest_run: Optional[RunSummary] = None
    latest_metrics: List[MetricScore] = []

class ProjectSummary(BaseModel):
    total_test_cases: int
    test_cases_with_runs: int
    avg_latest_aggregated_score: Optional[float] = None

class ProjectDashboardResponse(BaseModel):
    project_id: int
    project_name: str
    summary: ProjectSummary
    test_cases: List[TestCaseSummary]
