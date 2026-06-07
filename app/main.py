# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.cache import close_redis, init_redis
from app.core.config import get_settings
from app.core.database import init_db

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Key-validation cache — avoids hammering provider APIs on every request
# ---------------------------------------------------------------------------
_key_cache: dict[str, tuple[bool, float]] = {}  # cache_key → (valid, expires_at)
_KEY_CACHE_TTL = 300.0  # 5 minutes


async def _validate_cohere(api_key: str) -> bool:
    if not api_key:
        return False
    cache_key = f"cohere:{api_key[:12]}"
    entry = _key_cache.get(cache_key)
    if entry and time.monotonic() < entry[1]:
        return entry[0]
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                "https://api.cohere.com/v1/check-api-key",
                headers={"Authorization": f"Bearer {api_key}"},
            )
        valid: bool = resp.status_code == 200 and bool(resp.json().get("valid", False))
    except Exception as exc:
        logger.warning("Cohere key validation failed: %s", exc)
        valid = False
    _key_cache[cache_key] = (valid, time.monotonic() + _KEY_CACHE_TTL)
    return valid


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()

    logging.basicConfig(level=settings.LOG_LEVEL.upper())

    logger.info("Initializing database...")
    await init_db()

    logger.info("Initializing Redis connection pool...")
    await init_redis()

    upload_dir = settings.UPLOAD_DIR
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir, exist_ok=True)
        logger.info("Created upload directory: %s", upload_dir)

    logger.info("RAGman startup complete.")
    yield

    logger.info("Shutting down RAGman...")
    await close_redis()
    logger.info("RAGman shutdown complete.")


app = FastAPI(
    title="RAGman",
    description="Agentic RAG Pipeline Builder",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.routes import agents, documents, history, query  # noqa: E402

app.include_router(agents.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(query.router, prefix="/api/v1")
app.include_router(history.router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/capabilities", tags=["meta"])
async def get_capabilities() -> dict[str, bool]:
    settings = get_settings()
    return {
        "cohere": await _validate_cohere(settings.COHERE_API_KEY),
        "openai": bool(settings.OPENAI_API_KEY),
        "anthropic": bool(settings.ANTHROPIC_API_KEY),
    }
