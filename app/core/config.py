# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    REDIS_URL: str
    CHROMA_HOST: str = "chroma"
    CHROMA_PORT: int = 8000
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    COHERE_API_KEY: str = ""
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    QUERY_CACHE_TTL: int = 3600
    QUERY_CACHE_MAX_PER_AGENT: int = 100


@lru_cache
def get_settings() -> Settings:
    return Settings()
