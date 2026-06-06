# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from typing import Optional

import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.core.config import get_settings

_redis_pool: Optional[Redis] = None  # type: ignore[type-arg]


async def init_redis() -> None:
    global _redis_pool
    settings = get_settings()
    _redis_pool = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )


async def get_redis() -> Redis:  # type: ignore[type-arg]
    if _redis_pool is None:
        await init_redis()
    return _redis_pool  # type: ignore[return-value]


async def close_redis() -> None:
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None
