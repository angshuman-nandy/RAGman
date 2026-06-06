# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from typing import AsyncGenerator

from fastapi import Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_redis
from app.core.config import Settings, get_settings
from app.core.database import AsyncSessionLocal


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_redis_client() -> Redis:  # type: ignore[type-arg]
    return await get_redis()


async def get_settings_dep(
    settings: Settings = Depends(get_settings),
) -> Settings:
    return settings
