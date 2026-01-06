from typing import Optional
from pydantic import BaseModel

class UserRead(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    preferred_model: Optional[str] = "gpt-5"
    profile_picture_url: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    preferred_model: Optional[str] = None
    profile_picture_url: Optional[str] = None
