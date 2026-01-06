from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.test_case import TestCase
    from app.models.user import User
    from app.models.project_membership import ProjectMembership

class ProjectBase(SQLModel):
    name: str = Field(index=True)
    description: Optional[str] = None

from app.models.project_membership import ProjectMembership

class Project(ProjectBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    test_cases: List["TestCase"] = Relationship(back_populates="project", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    
    # Ownership
    owner_id: Optional[int] = Field(default=None, foreign_key="user.id")
    owner: Optional["User"] = Relationship(back_populates="projects")
    
    # Members
    members: List["User"] = Relationship(link_model=ProjectMembership)
