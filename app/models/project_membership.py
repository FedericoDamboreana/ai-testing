from typing import Optional
from sqlmodel import Field, SQLModel

class ProjectMembership(SQLModel, table=True):
    project_id: int = Field(foreign_key="project.id", primary_key=True)
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    role: str = Field(default="viewer") # viewer, editor
