# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_settings_dep
from app.core.config import Settings
from app.models.agent import Agent, Document
from app.models.schemas import DocumentListResponse, DocumentResponse
from app.pipeline.context import PipelineContext, Document as PipelineDocument
from app.pipeline.registry import get_task_class, load_all_tasks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents/{agent_id}/documents", tags=["documents"])

ALLOWED_EXTENSIONS: frozenset[str] = frozenset({"pdf", "docx", "txt", "md"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _doc_to_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        agent_id=doc.agent_id,
        filename=doc.filename,
        file_type=doc.file_type,
        status=doc.status,
        chunk_count=doc.chunk_count,
        error_message=doc.error_message,
        ingestion_steps=doc.ingestion_steps or {},
        created_at=doc.created_at,
    )


async def _get_agent_or_404(agent_id: uuid.UUID, db: AsyncSession) -> Agent:
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found.",
        )
    return agent


async def _get_agent_and_doc(agent_id, doc_id, db):
    """Return (Agent, Document) or raise 404."""
    from app.models.agent import Agent as AgentModel

    result = await db.execute(select(AgentModel).where(AgentModel.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found.")

    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.agent_id == agent_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found.")

    return agent, doc


async def _fetch_chunks_from_store(vs_type: str, agent_id: str, filename: str) -> list[dict]:
    """Fetch all chunks for *filename* from the configured vector store."""
    if vs_type == "chroma":
        from app.pipeline.tasks.vector_store.chroma import ChromaVectorStoreTask
        return await ChromaVectorStoreTask().fetch_all_chunks(agent_id, filename)
    else:
        from app.pipeline.tasks.vector_store.pgvector import PGVectorStoreTask
        return await PGVectorStoreTask().fetch_all_chunks(agent_id, filename)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    agent_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db_session),
) -> DocumentListResponse:
    """List all documents belonging to an agent."""
    await _get_agent_or_404(agent_id, db)

    total_result = await db.execute(
        select(func.count()).select_from(Document).where(Document.agent_id == agent_id)
    )
    total: int = total_result.scalar_one()

    result = await db.execute(
        select(Document)
        .where(Document.agent_id == agent_id)
        .order_by(Document.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    docs = list(result.scalars().all())

    return DocumentListResponse(
        items=[_doc_to_response(d) for d in docs],
        total=total,
    )


@router.post("/", response_model=list[DocumentResponse], status_code=status.HTTP_201_CREATED)
async def upload_documents(
    agent_id: uuid.UUID,
    files: list[UploadFile],
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings_dep),
) -> list[DocumentResponse]:
    """
    Upload one or more files and enqueue an ARQ ingestion job for each.

    Validation:
    - File extension must be one of: pdf, docx, txt, md
    - File size must not exceed MAX_UPLOAD_SIZE_MB from settings
    """
    agent = await _get_agent_or_404(agent_id, db)

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    upload_dir = Path(settings.UPLOAD_DIR) / str(agent_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    created_docs: list[DocumentResponse] = []

    for upload in files:
        # --- extension check ---
        original_filename = upload.filename or "unknown"
        ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"File '{original_filename}' has unsupported extension '.{ext}'. "
                    f"Allowed: {sorted(ALLOWED_EXTENSIONS)}."
                ),
            )

        # --- size check ---
        contents = await upload.read()
        if len(contents) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"File '{original_filename}' exceeds the maximum allowed size "
                    f"of {settings.MAX_UPLOAD_SIZE_MB} MB."
                ),
            )

        # --- save to disk ---
        dest_path = upload_dir / original_filename
        # Avoid clobbering existing files with the same name.
        if dest_path.exists():
            stem, suffix = os.path.splitext(original_filename)
            dest_path = upload_dir / f"{stem}_{uuid.uuid4().hex[:8]}{suffix}"

        dest_path.write_bytes(contents)

        # --- create DB record ---
        doc = Document(
            agent_id=agent_id,
            filename=original_filename,
            file_type=ext,
            file_path=str(dest_path),
            status="pending",
            chunk_count=0,
        )
        db.add(doc)
        await db.flush()
        await db.refresh(doc)

        # --- enqueue ARQ ingestion job ---
        arq_pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
        try:
            await arq_pool.enqueue_job(
                "run_ingestion_job",
                doc_id=str(doc.id),
                agent_id=str(agent_id),
                pipeline_config=agent.pipeline_config,
                file_path=str(dest_path),
                filename=original_filename,
                file_type=ext,
            )
        finally:
            await arq_pool.aclose()

        created_docs.append(_doc_to_response(doc))

    await db.commit()
    return created_docs


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    agent_id: uuid.UUID,
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a document record and remove associated data from the vector store.

    The physical file on disk is left in place intentionally — it can be
    cleaned up by a separate maintenance job.
    """
    agent = await _get_agent_or_404(agent_id, db)

    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.agent_id == agent_id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {doc_id} not found for agent {agent_id}.",
        )

    # Remove the document's chunks from the vector store.
    # Currently ChromaDB does not offer per-document deletion without
    # storing custom metadata, so we log a warning and skip for now.
    # Implementations that tag chunks with `doc_id` in metadata can add
    # targeted deletion here.
    vector_store_type: str = agent.pipeline_config.get("vector_store", {}).get("type", "")
    if vector_store_type == "chroma":
        logger.info(
            "delete_document: ChromaDB per-document vector deletion not yet "
            "implemented — orphaned chunks will remain until the agent is deleted."
        )

    await db.delete(doc)
    await db.commit()


@router.get("/{doc_id}/chunks")
async def get_document_chunks(
    agent_id: uuid.UUID,
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
):
    """Return all stored chunks for this document from the vector store."""
    agent, doc = await _get_agent_and_doc(agent_id, doc_id, db)

    vs_type = agent.pipeline_config.get("vector_store", {}).get("type", "chroma")
    chunks = await _fetch_chunks_from_store(vs_type, str(agent_id), doc.filename)

    return {
        "chunks": [
            {
                "index": c["metadata"].get("chunk_index", i),
                "content": c["content"],
                "char_count": len(c["content"]),
                "metadata": c["metadata"],
            }
            for i, c in enumerate(chunks)
        ],
        "total": len(chunks),
    }


@router.post("/{doc_id}/rechunk")
async def rechunk_document(
    agent_id: uuid.UUID,
    doc_id: uuid.UUID,
    body: dict,   # { strategy: str, params: dict }
    db: AsyncSession = Depends(get_db_session),
):
    """Re-chunk the document with a different strategy — preview only, nothing stored."""
    agent, doc = await _get_agent_and_doc(agent_id, doc_id, db)

    strategy = body.get("strategy", "recursive")
    params = body.get("params", {})

    load_all_tasks()

    # Run ingestion to get document text
    ingestion_cls = get_task_class("ingestion", doc.file_type)
    ctx = PipelineContext(agent_id=str(agent_id), pipeline_config=agent.pipeline_config)
    ctx.metadata.update({
        "file_path": doc.file_path,
        "filename": doc.filename,
        "file_type": doc.file_type,
    })
    ctx = await ingestion_cls(config={}).run(ctx)

    # Run chosen chunking strategy
    chunking_cls = get_task_class("chunking", strategy)
    ctx = await chunking_cls(config=params).run(ctx)

    return {
        "strategy": strategy,
        "chunks": [
            {
                "index": i,
                "content": c.content,
                "char_count": len(c.content),
            }
            for i, c in enumerate(ctx.chunks)
        ],
        "total": len(ctx.chunks),
    }


@router.post("/{doc_id}/reprocess")
async def reprocess_document(
    agent_id: uuid.UUID,
    doc_id: uuid.UUID,
    body: dict,  # { chunking: { type: str, params: dict } }
    db: AsyncSession = Depends(get_db_session),
):
    """Re-ingest a document with a new chunking strategy.

    Deletes existing vectors for this document, resets status to pending,
    then enqueues a full ingestion job with the modified pipeline config.
    """
    from app.models.schemas import DocumentResponse
    from arq import create_pool
    from arq.connections import RedisSettings
    from app.core.config import get_settings

    agent, doc = await _get_agent_and_doc(agent_id, doc_id, db)

    chunking_config = body.get("chunking", {})
    if not chunking_config:
        raise HTTPException(status_code=422, detail="chunking config is required")

    # Build modified pipeline config with new chunking
    modified_pipeline = dict(agent.pipeline_config)
    modified_pipeline["chunking"] = chunking_config

    # Delete existing vectors for this document
    vs_type = agent.pipeline_config.get("vector_store", {}).get("type", "chroma")
    try:
        if vs_type == "chroma":
            from app.pipeline.tasks.vector_store.chroma import ChromaVectorStoreTask
            await ChromaVectorStoreTask().delete_chunks_for_source(str(agent_id), doc.filename)
        else:
            from app.pipeline.tasks.vector_store.pgvector import PGVectorStoreTask
            await PGVectorStoreTask().delete_chunks_for_source(str(agent_id), doc.filename)
    except Exception as exc:
        logger.warning("reprocess: could not delete existing vectors: %s", exc)

    # Reset document status
    doc.status = "pending"
    doc.chunk_count = 0
    doc.error_message = None
    doc.ingestion_steps = {}
    await db.commit()
    await db.refresh(doc)

    # Enqueue ingestion job with modified pipeline
    settings = get_settings()
    arq_pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    await arq_pool.enqueue_job(
        "run_ingestion_job",
        doc_id=str(doc.id),
        agent_id=str(agent_id),
        pipeline_config=modified_pipeline,
        file_path=doc.file_path,
        filename=doc.filename,
        file_type=doc.file_type,
    )
    await arq_pool.aclose()

    return _doc_to_response(doc)


@router.post("/{doc_id}/retrieve")
async def retrieve_for_document(
    agent_id: uuid.UUID,
    doc_id: uuid.UUID,
    body: dict,   # { query: str, strategy: str, params: dict }
    db: AsyncSession = Depends(get_db_session),
):
    """Run a retrieval strategy and return ranked results."""
    agent, doc = await _get_agent_and_doc(agent_id, doc_id, db)

    query = body.get("query", "")
    strategy = body.get("strategy", "similarity")
    params = body.get("params", {})

    if not query:
        raise HTTPException(status_code=422, detail="query is required")

    load_all_tasks()

    # Build a full pipeline context for the retriever
    pipeline_config = dict(agent.pipeline_config)
    pipeline_config["retriever"] = {"type": strategy, "params": params}

    ctx = PipelineContext(
        agent_id=str(agent_id),
        pipeline_config=pipeline_config,
        query=query,
    )

    retriever_cls = get_task_class("retriever", strategy)
    ctx = await retriever_cls(config=params).run(ctx)

    return {
        "strategy": strategy,
        "query": query,
        "results": [
            {
                "rank": i + 1,
                "content": r.content,
                "score": round(r.score, 4),
                "metadata": r.metadata,
            }
            for i, r in enumerate(ctx.retrieved_chunks)
        ],
    }


@router.post("/{doc_id}/rerank")
async def rerank_for_document(
    agent_id: uuid.UUID,
    doc_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieve chunks then rerank them; returns before/after for comparison."""
    agent, _doc = await _get_agent_and_doc(agent_id, doc_id, db)

    query: str = body.get("query", "")
    if not query:
        raise HTTPException(status_code=422, detail="query is required")

    from app.core.config import get_settings as _get_settings
    _settings = _get_settings()

    reranker_cfg = agent.pipeline_config.get("reranker") or {}
    reranker_type: str = body.get("reranker_type") or reranker_cfg.get("type", "cohere")
    top_n: int = int(body.get("top_n") or reranker_cfg.get("params", {}).get("top_n", 5))
    retriever_top_k: int = int(body.get("retriever_top_k", 10))

    if reranker_type == "cohere" and not _settings.COHERE_API_KEY:
        raise HTTPException(status_code=422, detail="COHERE_API_KEY is not configured on the server")

    load_all_tasks()

    retriever_config = agent.pipeline_config.get("retriever", {"type": "similarity", "params": {}})
    retriever_type: str = retriever_config.get("type", "similarity")
    retriever_params = {**retriever_config.get("params", {}), "top_k": retriever_top_k}

    ctx = PipelineContext(
        agent_id=str(agent_id),
        pipeline_config=dict(agent.pipeline_config),
        query=query,
    )

    retriever_cls = get_task_class("retriever", retriever_type)
    ctx = await retriever_cls(config=retriever_params).run(ctx)

    before = [
        {"rank": i + 1, "content": r.content, "score": round(r.score, 4), "metadata": r.metadata}
        for i, r in enumerate(ctx.retrieved_chunks)
    ]

    reranker_cls = get_task_class("reranker", reranker_type)
    ctx = await reranker_cls(config={"top_n": top_n}).run(ctx)

    after_chunks = ctx.reranked_chunks or ctx.retrieved_chunks
    after = [
        {"rank": i + 1, "content": r.content, "score": round(r.score, 4), "metadata": r.metadata}
        for i, r in enumerate(after_chunks)
    ]

    return {
        "query": query,
        "reranker_type": reranker_type,
        "before": before,
        "after": after,
    }


@router.get("/{doc_id}/embeddings")
async def get_document_embeddings(
    agent_id: uuid.UUID,
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
):
    """Return UMAP 2D projection + cosine similarity heatmap for this document's chunks."""
    import numpy as np

    agent, doc = await _get_agent_and_doc(agent_id, doc_id, db)

    vs_type = agent.pipeline_config.get("vector_store", {}).get("type", "chroma")
    chunks = await _fetch_chunks_from_store(vs_type, str(agent_id), doc.filename)

    if not chunks:
        return {"scatter": [], "heatmap": [], "labels": []}

    embeddings = [c["embedding"] for c in chunks if c["embedding"]]
    labels = [
        c["content"][:60] + ("…" if len(c["content"]) > 60 else "")
        for c in chunks if c["embedding"]
    ]

    if not embeddings:
        return {"scatter": [], "heatmap": [], "labels": []}

    mat = np.array(embeddings, dtype=float)

    # Cosine similarity heatmap
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    normed = mat / (norms + 1e-10)
    heatmap = (normed @ normed.T).tolist()

    # UMAP 2D projection
    scatter = []
    try:
        import umap
        reducer = umap.UMAP(
            n_components=2,
            random_state=42,
            n_neighbors=min(15, len(embeddings) - 1),
        )
        coords = reducer.fit_transform(mat)
        scatter = [
            {
                "x": round(float(coords[i, 0]), 4),
                "y": round(float(coords[i, 1]), 4),
                "label": labels[i],
                "chunk_index": i,
            }
            for i in range(len(coords))
        ]
    except Exception as exc:
        logger.warning("UMAP projection failed: %s", exc)

    return {
        "scatter": scatter,
        "heatmap": heatmap,
        "labels": labels,
    }
