from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship

class ProjectBase(SQLModel):
    name: str = Field(index=True)
    description: Optional[str] = None

class Project(ProjectBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    test_cases: List["TestCase"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
