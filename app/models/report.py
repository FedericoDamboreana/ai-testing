from datetime import datetime
from enum import Enum
from typing import Optional
from sqlmodel import Field, SQLModel

class ReportScope(str, Enum):
    TEST_CASE = "test_case"
    PROJECT = "project"

class ReportBase(SQLModel):
    scope_type: ReportScope
    scope_id: int
    start_date: datetime
    end_date: datetime
    content_json: str # JSON storage for comparisons
    summary_text: str # Natural language summary

class Report(ReportBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
