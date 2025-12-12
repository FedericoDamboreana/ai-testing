from pydantic import BaseModel

class JudgeResult(BaseModel):
    score: float
    explanation: str
