# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Required ──────────────────────────────────────────────────────────────
    DATABASE_URL: str
    REDIS_URL: str

    # ── Optional / defaulted ──────────────────────────────────────────────────
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
    LITE_MODE: bool = False

    # ── Validators ────────────────────────────────────────────────────────────

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalise_database_url(cls, v: Any) -> str:
        """Rewrite postgres:// / postgresql:// → postgresql+asyncpg://.

        SQLAlchemy's async engine requires the asyncpg driver suffix.
        Railway (and many other cloud providers) inject a plain
        ``postgresql://`` URL, so we normalise it here so that neither
        the app nor Alembic needs to handle the conversion separately.
        """
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            if v.startswith("postgresql://") and "+asyncpg" not in v:
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
