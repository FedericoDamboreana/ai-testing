import pytest
from unittest.mock import MagicMock, patch
from pydantic import SecretStr
from app.core.config import Settings
from app.providers.llm import OpenAILLMProvider, get_llm_provider, StubLLMProvider
from app.models.test_case import TestCase
from app.schemas.metric import StructuredLLMResponse

def test_default_is_stub():
    # settings.LLM_MODE default is "stub"
    with patch("app.core.config.settings.LLM_MODE", "stub"):
        provider = get_llm_provider()
        assert isinstance(provider, StubLLMProvider)

def test_config_validation_fail_fast():
    # If LLM_MODE is openai but no key
    with pytest.raises(ValueError):
        # We need to bypass the singleton settings if possible or create a new one
        # But settings is instantiated at module level.
        # We can try to instantiate Settings directly.
        Settings(LLM_MODE="openai", OPENAI_API_KEY=None, _env_file=None)

def test_openai_provider_initialization():
    # Mock settings to allow init
    with patch("app.core.config.settings.OPENAI_API_KEY", SecretStr("test-key")):
        with patch("app.core.config.settings.LLM_MODE", "openai"):
            # Also need to mock openai module import or client
            with patch("openai.OpenAI") as mock_openai:
                provider = OpenAILLMProvider()
                assert provider.client is not None
                mock_openai.assert_called_once()

def test_openai_metric_design_mock_call():
    # Test that prompt construction and client call uses structured output (chat.completions.create)
    with patch("app.core.config.settings.OPENAI_API_KEY", SecretStr("test-key")):
        with patch("openai.OpenAI") as mock_openai_cls:
            mock_client = MagicMock()
            mock_openai_cls.return_value = mock_client
            
            # Mock chat.completions.create -> responses.parse
            mock_responses = MagicMock()
            mock_client.responses = mock_responses
            mock_parse = MagicMock()
            mock_responses.parse = mock_parse
            
            # Mock return value
            mock_response = MagicMock()
            # Must return valid parsed object
            mock_response.output_parsed = StructuredLLMResponse(
                 proposed_metrics=[], 
                 gap_analysis="Mock analysis", 
                 reasoning_summary="Mock summary"
            )
            mock_parse.return_value = mock_response
            
            provider = OpenAILLMProvider()
            test_case = TestCase(name="Test", description="Desc", project_id=1)
            
            provider.generate_metric_proposals("Intent", test_case)
            
            mock_parse.assert_called_once()
            call_kwargs = mock_parse.call_args[1]
            assert "input" in call_kwargs
            assert "text_format" in call_kwargs
            assert call_kwargs["text_format"] == StructuredLLMResponse

def test_openai_report_narrative_mock_call():
    with patch("app.core.config.settings.OPENAI_API_KEY", SecretStr("test-key")):
        with patch("openai.OpenAI") as mock_openai_cls:
            mock_client = MagicMock()
            mock_openai_cls.return_value = mock_client
            
            mock_create = MagicMock()
            mock_client.chat.completions.create = mock_create
            
            mock_response = MagicMock()
            mock_response.choices[0].message.content = "Mock narrative"
            mock_create.return_value = mock_response
            
            provider = OpenAILLMProvider()
            
            # Need a model that has .model_dump_json() usually, but provider accepts Any and calls .model_dump_json found on input
            class MockContent:
                def model_dump_json(self):
                    return "{}"
            
            provider.generate_report_narrative(MockContent())
            
            mock_create.assert_called_once()
