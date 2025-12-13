from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from app.schemas.metric import MetricDefinitionRead

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectRead(ProjectCreate):
    id: int
    created_at: datetime

class TestCaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    user_intent: Optional[str] = None

class TestCaseRead(TestCaseCreate):
    id: int
    project_id: int
    created_at: datetime
    examples: List["ExampleRead"] = []
    metrics: List["MetricDefinitionRead"] = []

class ExampleCreate(BaseModel):
    content: str
    type: str = "current"

class ExampleRead(ExampleCreate):
    id: int
    test_case_id: int
    created_at: datetime
