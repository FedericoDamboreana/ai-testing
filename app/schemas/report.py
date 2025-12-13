from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel
from app.models.report import ReportScope

class ReportRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    start_version: Optional[int] = None
    end_version: Optional[int] = None

class ReportContentMetricDelta(BaseModel):
    metric_name: str
    previous_score: float
    current_score: float
    delta: float
    direction: str # "improved", "worsened", "stable"

class ReportContent(BaseModel):
    test_case_id: int
    test_case_name: Optional[str] = None
    metric_comparison: List[ReportContentMetricDelta]
    aggregated_score_delta: Optional[float] = None
    aggregated_score_direction: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    scope_type: ReportScope
    scope_id: int
    start_date: datetime
    end_date: datetime
    created_at: datetime
    summary_text: str
    report_content: Any # Parsed JSON of ReportContent (or dict/list depending on scope)
