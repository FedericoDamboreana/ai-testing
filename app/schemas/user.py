from typing import Optional
from pydantic import BaseModel

class UserRead(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
