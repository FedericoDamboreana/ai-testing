from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from app.models.project import Project

from enum import Enum

class ExampleType(str, Enum):
    DESIRED = "desired"
    CURRENT = "current"

class TestCaseBase(SQLModel):
    name: str
    description: Optional[str] = None
    user_intent: Optional[str] = None
    
class TestCase(TestCaseBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    project: Project = Relationship(back_populates="test_cases")
    examples: List["Example"] = Relationship(back_populates="test_case", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    metrics: List["MetricDefinition"] = Relationship(back_populates="test_case", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    runs: List["EvaluationRun"] = Relationship(back_populates="test_case", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class ExampleBase(SQLModel):
    content: str # Plain text only as per requirements
    type: ExampleType = Field(default=ExampleType.CURRENT)

class Example(ExampleBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    test_case_id: int = Field(foreign_key="testcase.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    test_case: TestCase = Relationship(back_populates="examples")
