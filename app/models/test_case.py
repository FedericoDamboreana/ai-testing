from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from app.models.project import Project

class TestCaseBase(SQLModel):
    name: str
    description: Optional[str] = None
    
class TestCase(TestCaseBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    project: Project = Relationship(back_populates="test_cases")
    examples: List["Example"] = Relationship(back_populates="test_case")
    metrics: List["MetricDefinition"] = Relationship(back_populates="test_case")
    runs: List["EvaluationRun"] = Relationship(back_populates="test_case")

class ExampleBase(SQLModel):
    content: str # Plain text only as per requirements

class Example(ExampleBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    test_case_id: int = Field(foreign_key="testcase.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    test_case: TestCase = Relationship(back_populates="examples")
