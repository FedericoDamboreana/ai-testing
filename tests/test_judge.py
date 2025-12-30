from unittest.mock import MagicMock, patch
import pytest
from app.providers.llm import OpenAILLMProvider, StubLLMProvider
from app.schemas.llm_validation import JudgeResult
from app.models.metric import MetricDefinition, MetricType, ScaleType, TargetDirection
from app.schemas.metric import MetricDefinitionCreate
from app.models.test_case import TestCase
from sqlmodel import Session, SQLModel, create_engine
from app.core import config
from app.services.evaluation import evaluate_test_case

def test_stub_judge():
    provider = StubLLMProvider()
    metric = MetricDefinition(
        name="Test", description="Desc", metric_type=MetricType.LLM_JUDGE,
        scale_type=ScaleType.BOUNDED, scale_min=0, scale_max=100,
        target_direction=TargetDirection.HIGHER_IS_BETTER
    )
    result = provider.judge_metric(metric, "Candidate text", "Context")
    assert isinstance(result, JudgeResult)
    assert result.score is not None
    assert "Stub judged" in result.explanation

def test_openai_judge_mock():
    with patch("app.core.config.settings.OPENAI_API_KEY", config.SecretStr("test")):
        with patch("openai.OpenAI") as mock_openai:
            mock_client = MagicMock()
            mock_openai.return_value = mock_client
            mock_responses = MagicMock()
            mock_client.responses = mock_responses
            mock_parse = MagicMock()
            mock_responses.parse = mock_parse
            
            mock_res = MagicMock()
            mock_res.output_parsed = JudgeResult(score=95.0, explanation="Excellent.")
            mock_parse.return_value = mock_res
            
            provider = OpenAILLMProvider()
            metric = MetricDefinition(
                name="Test", description="Desc", metric_type=MetricType.LLM_JUDGE,
                scale_type=ScaleType.BOUNDED, scale_min=0, scale_max=100,
                target_direction=TargetDirection.HIGHER_IS_BETTER,
                evaluation_prompt="Score it."
            )
            
            result = provider.judge_metric(metric, "Text", "Ctx")
            assert result.score == 95.0
            assert result.explanation == "Excellent."
            
            mock_parse.assert_called_once()
            kwargs = mock_parse.call_args[1]
            assert "input" in kwargs
            assert kwargs["text_format"] == JudgeResult

from app.models.project import Project

def test_evaluation_fallback(session: Session):
    # Create project
    proj = Project(name="P_Judge")
    session.add(proj)
    session.commit()
    session.refresh(proj)

    # Create test case and metric
    tc = TestCase(name="T1", description="Intent", project_id=proj.id)
    session.add(tc)
    session.commit()
    session.refresh(tc)
    
    metric = MetricDefinition(
        name="JudgeMetric", description="Desc",
        test_case_id=tc.id,
        metric_type=MetricType.LLM_JUDGE,
        scale_type=ScaleType.BOUNDED, scale_min=0, scale_max=100,
        target_direction=TargetDirection.HIGHER_IS_BETTER,
        evaluation_prompt="Prompt"
    )
    session.add(metric)
    session.commit()
    
    # Force OpenAI mode but mock it to fail
    with patch("app.core.config.settings.LLM_MODE", "openai"):
        with patch("app.core.config.settings.OPENAI_API_KEY", config.SecretStr("test")):
             with patch("app.providers.llm.OpenAILLMProvider") as MockProvider:
                instance = MockProvider.return_value
                instance.judge_metric.side_effect = Exception("API Error")
                instance.analyze_evaluation_results.return_value = "Mock gap analysis"
                
                # We need to patch get_llm_provider to return our MockProvider instance
                with patch("app.services.evaluation.get_llm_provider", return_value=instance):
                    run = evaluate_test_case(tc, [metric], ["Candidate text"])
                    
                    assert len(run.metric_results) == 1
                    res = run.metric_results[0]
                    assert "Error during LLM judgment" in res["explanation"]
                    # assert res["score"] is not None # Stub score (it is 0.0)
