# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_settings_dep
from app.core.config import Settings
from app.models.agent import Agent, Document
from app.models.schemas import (
    AgentCreate,
    AgentListResponse,
    AgentResponse,
    AgentUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _agent_not_found(agent_id: uuid.UUID) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Agent {agent_id} not found.",
    )


def _agent_to_response(agent: Agent, document_count: int = 0) -> AgentResponse:
    """Map ORM Agent → AgentResponse, adapting pipeline_config key."""
    return AgentResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        pipeline=agent.pipeline_config,  # type: ignore[arg-type]
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        document_count=document_count,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/", response_model=AgentListResponse)
async def list_agents(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db_session),
) -> AgentListResponse:
    """Return a paginated list of all agents."""
    doc_count_sq = (
        select(func.count(Document.id))
        .where(Document.agent_id == Agent.id)
        .correlate(Agent)
        .scalar_subquery()
    )
    stmt = (
        select(Agent, doc_count_sq.label("doc_count"))
        .order_by(Agent.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    total_result = await db.execute(select(func.count()).select_from(Agent))
    total: int = total_result.scalar_one()

    return AgentListResponse(
        items=[_agent_to_response(agent, doc_count) for agent, doc_count in rows],
        total=total,
    )


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    body: AgentCreate,
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
) -> AgentResponse:
    """Create a new agent with the supplied pipeline configuration."""
    agent = Agent(
        name=body.name,
        description=body.description,
        pipeline_config=body.pipeline.model_dump(),
    )
    db.add(agent)
    await db.flush()  # populate agent.id before commit
    await db.refresh(agent)
    return _agent_to_response(agent)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> AgentResponse:
    """Fetch a single agent by ID."""
    doc_count_sq = (
        select(func.count(Document.id))
        .where(Document.agent_id == agent_id)
        .scalar_subquery()
    )
    result = await db.execute(
        select(Agent, doc_count_sq.label("doc_count")).where(Agent.id == agent_id)
    )
    row = result.one_or_none()
    if row is None:
        raise _agent_not_found(agent_id)
    agent, doc_count = row
    return _agent_to_response(agent, doc_count)


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: uuid.UUID,
    body: AgentUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> AgentResponse:
    """Partially update an agent's metadata or pipeline configuration."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if agent is None:
        raise _agent_not_found(agent_id)

    if body.name is not None:
        agent.name = body.name
    if body.description is not None:
        agent.description = body.description
    if body.pipeline is not None:
        agent.pipeline_config = body.pipeline.model_dump()

    await db.flush()
    await db.refresh(agent)

    count_result = await db.execute(
        select(func.count(Document.id)).where(Document.agent_id == agent_id)
    )
    doc_count: int = count_result.scalar_one()
    return _agent_to_response(agent, doc_count)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete an agent, all its document records, and its vector store collection.

    The cascade="all, delete-orphan" on Agent.documents handles the SQL rows;
    we additionally remove the vector store data before touching the DB so that
    orphaned vector data is not left behind if deletion fails.
    """
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if agent is None:
        raise _agent_not_found(agent_id)

    # Delete vector store data based on the configured provider.
    vector_store_type: str = (
        agent.pipeline_config.get("vector_store", {}).get("type", "")
    )
    agent_id_str = str(agent_id)

    if vector_store_type == "chroma":
        try:
            from app.pipeline.tasks.vector_store.chroma import ChromaVectorStoreTask

            task = ChromaVectorStoreTask(config={})
            await task.delete_collection(agent_id_str)
        except Exception as exc:
            # Log but do not abort — we still want to remove the DB record.
            logger.warning(
                "delete_agent: failed to delete Chroma collection for agent %s: %s",
                agent_id_str,
                exc,
            )
    else:
        logger.debug(
            "delete_agent: no vector-store cleanup handler for type %r.",
            vector_store_type,
        )

    await db.delete(agent)
