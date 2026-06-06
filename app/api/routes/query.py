# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import hashlib
import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_redis_client, get_settings_dep
from app.core.config import Settings
from app.models.agent import Agent, Document as DocumentModel
from app.models.schemas import QueryRequest, QueryResponse
from app.pipeline.executor import PipelineExecutor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents/{agent_id}", tags=["query"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _cache_key(agent_id: uuid.UUID, question: str, document_ids: list[uuid.UUID] | None = None) -> str:
    suffix = "," + ",".join(sorted(str(i) for i in document_ids)) if document_ids else ""
    question_hash = hashlib.md5((question + suffix).encode()).hexdigest()
    return f"query:{agent_id}:{question_hash}"


async def _get_agent_or_404(agent_id: uuid.UUID, db: AsyncSession) -> Agent:
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found.",
        )
    return agent


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


@router.post("/query")
async def query_agent(
    agent_id: uuid.UUID,
    body: QueryRequest,
    db: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis_client),  # type: ignore[type-arg]
    settings: Settings = Depends(get_settings_dep),
):
    """
    Run a RAG query against an agent's document collection.

    - If ``stream=True`` (default): returns a Server-Sent Events stream.
      Each event carries a JSON object with a ``token`` key, and the final
      event carries ``{"done": true}``.

    - If ``stream=False``: collects all tokens, caches the result in Redis,
      and returns a ``QueryResponse`` JSON body.

    Cache behaviour (non-streaming only):
      Cache key: ``query:<agent_id>:<md5(question)>``
      TTL: ``settings.QUERY_CACHE_TTL`` seconds
    """
    agent = await _get_agent_or_404(agent_id, db)
    question = body.question

    # --- Resolve document_ids → source filenames ---------------------------
    source_filenames: list[str] | None = None
    if body.document_ids:
        rows = await db.execute(
            select(DocumentModel.filename)
            .where(DocumentModel.agent_id == agent_id)
            .where(DocumentModel.id.in_(body.document_ids))
        )
        source_filenames = [r for (r,) in rows.all()] or None

    cache_key = _cache_key(agent_id, question, body.document_ids)

    # --- Cache look-up (non-streaming only) --------------------------------
    if not body.stream:
        try:
            cached = await redis.get(cache_key)
            if cached is not None:
                logger.debug("query_agent: cache hit for key %r", cache_key)
                payload = json.loads(cached)
                return QueryResponse(**payload)
        except Exception as exc:
            # Redis errors are non-fatal — fall through to live query.
            logger.warning("query_agent: Redis get failed (%s); bypassing cache.", exc)

    # --- Build executor ----------------------------------------------------
    executor = PipelineExecutor(
        agent_id=str(agent_id),
        pipeline_config=agent.pipeline_config,
    )

    # --- Streaming response ------------------------------------------------
    if body.stream:
        async def event_generator():
            try:
                async for token in executor.run_query(question, document_filter=source_filenames):
                    yield f"data: {json.dumps({'token': token})}\n\n"
            except Exception as exc:
                logger.exception("query_agent: streaming generator raised: %s", exc)
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            finally:
                yield f"data: {json.dumps({'done': True})}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    # --- Non-streaming: collect tokens, cache, return ----------------------
    tokens: list[str] = []
    try:
        async for token in executor.run_query(question, document_filter=source_filenames):
            tokens.append(token)
    except Exception as exc:
        logger.exception("query_agent: non-streaming query failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Pipeline execution failed: {exc}",
        )

    # The PipelineContext.sources are not directly accessible from the token
    # stream, so we reconstruct a best-effort QueryResponse from tokens.
    # A richer approach would have run_query() optionally yield a final
    # metadata event; for now the sources list is left empty for the
    # streaming-collected path and populated from context when available.
    answer = "".join(tokens)
    response = QueryResponse(answer=answer, sources=[])

    # Cache the result.
    try:
        await redis.set(
            cache_key,
            json.dumps(response.model_dump()),
            ex=settings.QUERY_CACHE_TTL,
        )
        logger.debug("query_agent: cached result under key %r (TTL=%ds)", cache_key, settings.QUERY_CACHE_TTL)
    except Exception as exc:
        logger.warning("query_agent: Redis set failed (%s); result not cached.", exc)

    return response
