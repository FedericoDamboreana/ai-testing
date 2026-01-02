from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr, field_validator

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "LLM Eval Tool"
    VERSION: str = "0.4.11"
    DATABASE_URL: str = "sqlite:///./test.db"
    
    # LLM Settings
    LLM_MODE: Literal["stub", "openai"] = "stub"
    OPENAI_API_KEY: SecretStr | None = None
    OPENAI_MODEL: str = "gpt-5"
    
    # Custom SQLite path
    SQLITE_PATH: str | None = None
    
    # GCS Bootstrap
    GCS_DB_BUCKET: str | None = None
    GCS_DB_OBJECT: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_ignore_empty=True, 
        extra="ignore"
    )
    
    @field_validator("OPENAI_API_KEY")
    @classmethod
    def validate_api_key(cls, v: SecretStr | None, info) -> SecretStr | None:
        return v
    
    def model_post_init(self, __context):
        if self.LLM_MODE == "openai" and not self.OPENAI_API_KEY:
             raise ValueError("OPENAI_API_KEY must be set when LLM_MODE is 'openai'")
        
        # Override DATABASE_URL if SQLITE_PATH is provided
        if self.SQLITE_PATH:
            self.DATABASE_URL = f"sqlite:///{self.SQLITE_PATH}"

settings = Settings()
