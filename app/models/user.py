from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.project import Project

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    full_name: Optional[str] = None
    hashed_password: str
    preferred_model: Optional[str] = Field(default="gpt-5")

    projects: List["Project"] = Relationship(back_populates="owner")
    # memberships: List["ProjectMembership"] = Relationship(back_populates="user")
