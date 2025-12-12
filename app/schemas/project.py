from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectRead(ProjectCreate):
    id: int
    created_at: datetime

class TestCaseCreate(BaseModel):
    name: str
    description: Optional[str] = None

class TestCaseRead(TestCaseCreate):
    id: int
    project_id: int
    created_at: datetime

class ExampleCreate(BaseModel):
    content: str

class ExampleRead(ExampleCreate):
    id: int
    test_case_id: int
    created_at: datetime
