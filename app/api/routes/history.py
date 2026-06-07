# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.models.agent import Agent, QueryHistory
from app.models.schemas import QueryHistoryListResponse, QueryHistoryResponse

router = APIRouter(prefix="/agents/{agent_id}", tags=["history"])


async def _get_agent_or_404(agent_id: uuid.UUID, db: AsyncSession) -> Agent:
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found.")
    return agent


@router.get("/history", response_model=QueryHistoryListResponse)
async def list_history(
    agent_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> QueryHistoryListResponse:
    await _get_agent_or_404(agent_id, db)

    offset = (page - 1) * limit

    total_result = await db.execute(
        select(func.count()).select_from(QueryHistory).where(QueryHistory.agent_id == agent_id)
    )
    total = total_result.scalar_one()

    rows_result = await db.execute(
        select(QueryHistory)
        .where(QueryHistory.agent_id == agent_id)
        .order_by(QueryHistory.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = rows_result.scalars().all()

    return QueryHistoryListResponse(
        items=[QueryHistoryResponse.model_validate(h) for h in items],
        total=total,
    )


@router.delete("/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_history_entry(
    agent_id: uuid.UUID,
    history_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    await _get_agent_or_404(agent_id, db)

    result = await db.execute(
        select(QueryHistory).where(
            QueryHistory.id == history_id, QueryHistory.agent_id == agent_id
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="History entry not found.")

    await db.delete(entry)
    await db.commit()


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_history(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    await _get_agent_or_404(agent_id, db)
    await db.execute(delete(QueryHistory).where(QueryHistory.agent_id == agent_id))
    await db.commit()
