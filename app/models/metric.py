from datetime import datetime
from enum import Enum
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
# from app.models.test_case import TestCase # Circular import avoidance

class MetricType(str, Enum):
    LLM_JUDGE = "LLM_JUDGE"
    DETERMINISTIC = "DETERMINISTIC"

class ScaleType(str, Enum):
    BOUNDED = "bounded"
    UNBOUNDED = "unbounded"
    BOOLEAN = "boolean" # Added for completeness, though requirements said numeric score 0-100 mostly.

class TargetDirection(str, Enum):
    HIGHER_IS_BETTER = "higher_is_better"
    LOWER_IS_BETTER = "lower_is_better"
    NEUTRAL = "neutral"

class MetricDefinitionBase(SQLModel):
    name: str
    description: str
    metric_type: MetricType
    scale_type: ScaleType
    scale_min: Optional[float] = None
    scale_max: Optional[float] = None
    target_direction: TargetDirection
    evaluation_prompt: Optional[str] = None
    rule_definition: Optional[str] = None

class MetricDefinition(MetricDefinitionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    test_case_id: int = Field(foreign_key="testcase.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)
    
    test_case: "TestCase" = Relationship(back_populates="metrics") 

class MetricDesignIterationBase(SQLModel):
    user_intent: str
    feedback: Optional[str] = None
    llm_proposed_metrics: Optional[str] = None # JSON string or text representation
    gap_analysis: Optional[str] = None

class MetricDesignIteration(MetricDesignIterationBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    test_case_id: int = Field(foreign_key="testcase.id")
    iteration_number: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    confirmed_at: Optional[datetime] = None
