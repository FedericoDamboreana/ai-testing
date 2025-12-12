from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
# from app.models.test_case import TestCase
# from app.models.metric import MetricDefinition

class EvaluationRunBase(SQLModel):
    status: str = Field(default="pending")

class EvaluationRun(EvaluationRunBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    test_case_id: int = Field(foreign_key="testcase.id")
    version_number: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    aggregated_score: Optional[float] = None
    notes: Optional[str] = None
    
    test_case: "TestCase" = Relationship(back_populates="runs")
    metric_results: List["MetricResult"] = Relationship(back_populates="evaluation_run")

class MetricResultBase(SQLModel):
    score: float
    reasoning: Optional[str] = None
    metric_name: str # Snapshot of metric name at run time
    explanation: Optional[str] = None
    raw_json: Optional[str] = None

class MetricResult(MetricResultBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    evaluation_run_id: int = Field(foreign_key="evaluationrun.id")
    metric_definition_id: int = Field(foreign_key="metricdefinition.id")
    
    evaluation_run: EvaluationRun = Relationship(back_populates="metric_results")
    metric_definition: "MetricDefinition" = Relationship()
