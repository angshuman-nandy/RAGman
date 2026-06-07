# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.models.agent import Document
from app.pipeline.executor import PipelineExecutor

logger = logging.getLogger(__name__)

INGESTION_STEPS = ["ingestion", "chunking", "embedding", "vector_store"]


async def _update_step(
    session: AsyncSession, doc_id: uuid.UUID, step: str, status: str
) -> None:
    """Update a single ingestion step status and flush (no commit yet)."""
    result = await session.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is not None:
        steps = dict(doc.ingestion_steps or {})
        steps[step] = status
        doc.ingestion_steps = steps
        await session.flush()


async def run_ingestion_job(
    ctx,
    *,
    doc_id: str,
    agent_id: str,
    pipeline_config: dict,
    file_path: str,
    filename: str,
    file_type: str,
) -> None:
    """ARQ job: run the full ingestion pipeline for a single document.

    pipeline_config arrives as a plain dict (JSON-decoded by ARQ) — that is
    exactly what PipelineExecutor expects, so no conversion is needed.
    """
    logger.info("Starting ingestion job for doc=%s agent=%s", doc_id, agent_id)

    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True, echo=False)
    session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )

    doc_uuid = uuid.UUID(doc_id)

    try:
        async with session_factory() as session:
            # Fetch the document and initialise progress tracking.
            result = await session.execute(select(Document).where(Document.id == doc_uuid))
            doc = result.scalar_one_or_none()
            if doc is None:
                logger.error("run_ingestion_job: Document %s not found; aborting.", doc_id)
                return

            doc.status = "ingesting"
            doc.ingestion_steps = {step: "pending" for step in INGESTION_STEPS}
            await session.commit()

            # Build executor and seed context.
            executor = PipelineExecutor(agent_id=agent_id, pipeline_config=pipeline_config)
            from app.pipeline.context import PipelineContext

            context = PipelineContext(
                agent_id=agent_id,
                pipeline_config=pipeline_config,
            )
            context.metadata.update(
                {
                    "file_path": file_path,
                    "filename": filename,
                    "file_type": file_type,
                    "doc_id": doc_id,
                }
            )

            # Run each step individually so we can record fine-grained progress.
            for step in INGESTION_STEPS:
                await _update_step(session, doc_uuid, step, "in_progress")
                await session.commit()

                try:
                    context = await executor._run_task(step, context)
                    await _update_step(session, doc_uuid, step, "completed")
                    await session.commit()
                except Exception as exc:
                    logger.exception(
                        "run_ingestion_job: step=%s failed for doc=%s: %s", step, doc_id, exc
                    )
                    await _update_step(session, doc_uuid, step, "failed")

                    # Re-fetch to avoid stale state after the flush above.
                    fail_result = await session.execute(
                        select(Document).where(Document.id == doc_uuid)
                    )
                    fail_doc = fail_result.scalar_one_or_none()
                    if fail_doc is not None:
                        fail_doc.status = "failed"
                        fail_doc.error_message = f"[{step}] {type(exc).__name__}: {exc}"
                    await session.commit()
                    return

            # All steps succeeded — mark document as ready.
            done_result = await session.execute(
                select(Document).where(Document.id == doc_uuid)
            )
            done_doc = done_result.scalar_one_or_none()
            if done_doc is not None:
                done_doc.status = "ready"
                done_doc.chunk_count = len(context.chunks)
            await session.commit()
            logger.info(
                "run_ingestion_job: complete for doc=%s: %d chunks", doc_id, len(context.chunks)
            )
    finally:
        await engine.dispose()


async def run_deletion_job(
    ctx,
    *,
    doc_id: str,
    agent_id: str,
    pipeline_config: dict,
    file_path: str,
) -> None:
    """ARQ job: delete all chunks and vectors belonging to a document."""
    logger.info("Starting deletion job for doc=%s agent=%s", doc_id, agent_id)

    vs_type: str = (pipeline_config.get("vector_store") or {}).get("type", "chroma")

    try:
        if vs_type == "pgvector":
            from app.pipeline.tasks.vector_store.pgvector import PGVectorStoreTask
            deleted = await PGVectorStoreTask().delete_chunks_for_doc(agent_id, doc_id)
        else:
            from app.pipeline.tasks.vector_store.chroma import ChromaVectorStoreTask
            deleted = await ChromaVectorStoreTask().delete_chunks_for_doc(agent_id, doc_id)

        logger.info(
            "run_deletion_job: removed %d vectors for doc=%s (store=%s)", deleted, doc_id, vs_type
        )
    except Exception as exc:
        logger.exception("run_deletion_job: vector deletion failed for doc=%s: %s", doc_id, exc)

    # Remove the uploaded file from disk
    import os
    try:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            logger.info("run_deletion_job: deleted file %s", file_path)
    except Exception as exc:
        logger.warning("run_deletion_job: could not delete file %s: %s", file_path, exc)
