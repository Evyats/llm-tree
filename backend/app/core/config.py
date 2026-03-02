from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "chat-tree-api"
    api_prefix: str = "/api"
    cors_origins: str = "http://localhost:5173"
    database_url: str = "postgresql+psycopg://chat_tree:chat_tree@localhost:5432/chat_tree"
    default_model: str = "gpt-4o-mini"
    openai_api_key: str | None = None
    fallback_enabled: bool = True
    openai_timeout_seconds: float = 20.0
    log_level: str = "INFO"
    log_file: str = "logs/app.log"
    log_per_run: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
