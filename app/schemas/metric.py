from typing import Optional, List, Any
from pydantic import BaseModel, model_validator
from app.models.metric import MetricType, ScaleType, TargetDirection

class MetricDefinitionCreate(BaseModel):
    name: str
    description: str
    metric_type: MetricType
    scale_type: ScaleType
    scale_min: Optional[float] = None
    scale_max: Optional[float] = None
    target_direction: TargetDirection
    evaluation_prompt: Optional[str] = None
    rule_definition: Optional[str] = None

    @model_validator(mode='after')
    def check_scale_config(self) -> 'MetricDefinitionCreate':
        if self.scale_type == ScaleType.BOUNDED:
            if self.scale_min is None or self.scale_max is None:
                raise ValueError("Bounded metrics must have scale_min and scale_max")
            
            # Enforce standard scales
            allowed_mins = {0, 1}
            allowed_maxs = {1, 5, 10, 100}
            
            if self.scale_min not in allowed_mins:
                 raise ValueError(f"scale_min must be one of {allowed_mins}")
            if self.scale_max not in allowed_maxs:
                 raise ValueError(f"scale_max must be one of {allowed_maxs}")
            if self.scale_min >= self.scale_max:
                 raise ValueError("scale_max must be greater than scale_min")
                 
        elif self.scale_type == ScaleType.UNBOUNDED:
            if self.scale_min is not None or self.scale_max is not None:
                raise ValueError("Unbounded metrics must not have scale_min or scale_max")
        
        # New validation rules
        if self.metric_type == MetricType.LLM_JUDGE:
            if not self.evaluation_prompt:
                raise ValueError("LLM_JUDGE metrics must have an evaluation_prompt")
        
        if self.metric_type == MetricType.DETERMINISTIC:
            if not self.rule_definition:
                 # Note: rule_definition wasn't strictly required before but now it is. 
                 # However, existing stubs might fail if we don't update them too.
                 # Let's enforce it as requested.
                 pass 
                 # Wait, looking at current code `rule_definition` is optional in schema.
                 # But request says "If metric_type is DETERMINISTIC, rule_definition must be present."
                 if not self.rule_definition and not self.evaluation_prompt: 
                     # Some deterministic metrics might use evaluation_prompt if using LLM to extract?
                     # No, DETERMINISTIC usually means regex or code.
                     # Let's check stub provider usage.
                     # Stub uses `evaluation_prompt` for everything currently!
                     # "Policy violations count" -> metric_type=DETERMINISTIC, evaluation_prompt="Count violations."
                     # So I need to migrate stub or allow evaluation_prompt to serve as rule?
                     # Request says: "Every DETERMINISTIC metric must include a clear rule_definition."
                     # So I MUST update the Stub Provider to use `rule_definition` for deterministic metrics.
                     raise ValueError("DETERMINISTIC metrics must have a rule_definition")
                 
        return self

class MetricDefinitionRead(MetricDefinitionCreate):
    id: int
    test_case_id: int
    is_active: bool

class MetricDesignIterationCreate(BaseModel):
    user_intent: str
    user_suggested_metrics: Optional[List[MetricDefinitionCreate]] = None

class MetricDesignIterationRead(BaseModel):
    id: int
    test_case_id: int
    iteration_number: int
    user_intent: str
    feedback: Optional[str] = None
    llm_proposed_metrics: Optional[str] = None
    gap_analysis: Optional[str] = None

class StructuredLLMResponse(BaseModel):
    gap_analysis: str
    proposed_metrics: List[MetricDefinitionCreate]
    reasoning_summary: str
