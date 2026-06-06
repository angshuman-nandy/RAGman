# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import asyncio
import logging
from functools import partial

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext, RetrievedChunk
from app.pipeline.registry import register

logger = logging.getLogger(__name__)

# Standard RRF constant (Cormack et al. 2009)
_RRF_K = 60


def _get_embedder(embedding_config: dict):
    provider = embedding_config["provider"]
    if provider == "openai":
        from app.pipeline.tasks.embedding.openai_embed import OpenAIEmbeddingTask

        return OpenAIEmbeddingTask(config=embedding_config)
    elif provider == "ollama":
        from app.pipeline.tasks.embedding.ollama_embed import OllamaEmbeddingTask

        return OllamaEmbeddingTask(config=embedding_config)
    else:
        from app.pipeline.tasks.embedding.huggingface_embed import HuggingFaceEmbeddingTask

        return HuggingFaceEmbeddingTask(config=embedding_config)


def _get_vector_store(vs_config: dict):
    vs_type = vs_config["type"]
    if vs_type == "chroma":
        from app.pipeline.tasks.vector_store.chroma import ChromaVectorStoreTask

        return ChromaVectorStoreTask(config=vs_config)
    else:
        from app.pipeline.tasks.vector_store.pgvector import PGVectorStoreTask

        return PGVectorStoreTask(config=vs_config)


# ---------------------------------------------------------------------------
# Corpus fetching helpers (one per supported vector-store backend)
# ---------------------------------------------------------------------------

async def _fetch_all_chroma(
    vs_config: dict, agent_id: str, sources: list[str] | None = None
) -> list[dict]:
    """Return documents from a Chroma collection for this agent, optionally filtered by source."""
    import chromadb

    from app.core.config import get_settings

    settings = get_settings()
    client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
    collection_name = f"agent_{agent_id}"
    try:
        collection = client.get_collection(collection_name)
    except Exception:
        logger.warning("HybridRetrieverTask: Chroma collection %r not found.", collection_name)
        return []

    get_kwargs: dict = {"include": ["documents", "metadatas"]}
    if sources:
        if len(sources) == 1:
            get_kwargs["where"] = {"source": sources[0]}
        else:
            get_kwargs["where"] = {"$or": [{"source": s} for s in sources]}

    result = await asyncio.get_event_loop().run_in_executor(
        None,
        partial(collection.get, **get_kwargs),
    )

    docs: list[dict] = []
    for content, meta in zip(
        result.get("documents") or [],
        result.get("metadatas") or [],
    ):
        docs.append({"content": content, "metadata": meta or {}})
    return docs


async def _fetch_all_pgvector(
    vs_config: dict, agent_id: str, sources: list[str] | None = None
) -> list[dict]:
    """Return up to 1 000 rows from the pgvector table for this agent, optionally filtered."""
    import asyncpg

    from app.core.config import get_settings
    from app.pipeline.tasks.vector_store.pgvector import _table_name

    settings = get_settings()
    table = _table_name(agent_id)

    from app.pipeline.tasks.vector_store.pgvector import _dsn
    conn = await asyncpg.connect(_dsn(settings.DATABASE_URL))
    try:
        if sources:
            rows = await conn.fetch(
                f"SELECT content, metadata FROM {table} "
                f"WHERE metadata->>'source' = ANY($1::text[]) LIMIT 1000",
                sources,
            )
        else:
            rows = await conn.fetch(
                f"SELECT content, metadata FROM {table} LIMIT 1000",
            )
    finally:
        await conn.close()

    import json

    def _parse(raw) -> dict:
        if not raw:
            return {}
        if isinstance(raw, str):
            return json.loads(raw)
        return dict(raw)

    return [{"content": row["content"], "metadata": _parse(row["metadata"])} for row in rows]


async def _fetch_corpus(
    vs_config: dict, agent_id: str, sources: list[str] | None = None
) -> list[dict]:
    """Dispatch corpus retrieval to the correct backend."""
    if vs_config["type"] == "chroma":
        return await _fetch_all_chroma(vs_config, agent_id, sources=sources)
    return await _fetch_all_pgvector(vs_config, agent_id, sources=sources)


# ---------------------------------------------------------------------------
# BM25 helper (runs in a thread-pool to avoid blocking the event loop)
# ---------------------------------------------------------------------------

def _bm25_search(corpus_texts: list[str], query: str, top_k: int) -> list[int]:
    """Return the indices of the top-k BM25-scored documents.

    Tokenisation: lowercase + whitespace split (simple but effective for English).
    """
    from rank_bm25 import BM25Okapi

    tokenised_corpus = [t.lower().split() for t in corpus_texts]
    bm25 = BM25Okapi(tokenised_corpus)
    tokenised_query = query.lower().split()
    scores = bm25.get_scores(tokenised_query)

    # argsort descending, take top_k
    ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    return ranked[:top_k]


# ---------------------------------------------------------------------------
# RRF merger
# ---------------------------------------------------------------------------

def _rrf_merge(
    dense_results: list[dict],
    bm25_indices: list[int],
    corpus: list[dict],
    top_k: int,
    bm25_weight: float,
    dense_weight: float,
) -> list[dict]:
    """Merge dense and BM25 ranked lists with Reciprocal Rank Fusion.

    Each result is keyed by its content string so duplicates between
    the two lists are merged rather than double-counted.
    """
    rrf_scores: dict[str, float] = {}
    rrf_docs: dict[str, dict] = {}

    # Dense list contribution
    for rank, r in enumerate(dense_results, start=1):
        key = r["content"]
        contribution = dense_weight * (1.0 / (_RRF_K + rank))
        rrf_scores[key] = rrf_scores.get(key, 0.0) + contribution
        if key not in rrf_docs:
            rrf_docs[key] = r

    # BM25 list contribution
    for rank, idx in enumerate(bm25_indices, start=1):
        doc = corpus[idx]
        key = doc["content"]
        contribution = bm25_weight * (1.0 / (_RRF_K + rank))
        rrf_scores[key] = rrf_scores.get(key, 0.0) + contribution
        if key not in rrf_docs:
            rrf_docs[key] = {
                "content": doc["content"],
                "metadata": doc.get("metadata", {}),
                "score": 0.0,
            }

    # Sort by fused score descending
    sorted_keys = sorted(rrf_scores, key=lambda k: rrf_scores[k], reverse=True)

    merged: list[dict] = []
    for key in sorted_keys[:top_k]:
        entry = dict(rrf_docs[key])
        entry["score"] = rrf_scores[key]  # overwrite with fused RRF score
        merged.append(entry)

    return merged


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

@register("retriever", "hybrid")
class HybridRetrieverTask(BaseTask):
    """Retrieve chunks using a hybrid BM25 + dense vector approach with RRF.

    Config keys
    -----------
    top_k : int
        Number of final chunks to return (default: ``5``).
    bm25_weight : float
        Weight applied to the BM25 RRF contribution (default: ``0.3``).
    dense_weight : float
        Weight applied to the dense-vector RRF contribution (default: ``0.7``).
    """

    async def run(self, context: PipelineContext) -> PipelineContext:
        top_k: int = int(self.config.get("top_k", 5))
        bm25_weight: float = float(self.config.get("bm25_weight", 0.3))
        dense_weight: float = float(self.config.get("dense_weight", 0.7))
        fetch_k: int = 50  # number of candidates fetched from the dense index

        embedding_config: dict = context.pipeline_config["embedding"]
        vs_config: dict = context.pipeline_config["vector_store"]

        # --- 1. Embed the query ---
        embedder = _get_embedder(embedding_config)
        query_embeddings = await embedder.embed_texts([context.query])
        query_embedding: list[float] = query_embeddings[0]

        # --- 2. Dense search + corpus fetch (run concurrently) ---
        vector_store = _get_vector_store(vs_config)
        dense_task = asyncio.create_task(
            vector_store.similarity_search(
                agent_id=context.agent_id,
                query_embedding=query_embedding,
                top_k=fetch_k,
                source_filter=context.document_filter,
            )
        )
        corpus_task = asyncio.create_task(
            _fetch_corpus(vs_config, context.agent_id, sources=context.document_filter)
        )

        dense_results, corpus = await asyncio.gather(dense_task, corpus_task)

        if not corpus:
            # Fallback: if corpus is empty, use dense results only
            logger.warning(
                "HybridRetrieverTask: empty corpus for agent %r; falling back to dense search.",
                context.agent_id,
            )
            context.retrieved_chunks = [
                RetrievedChunk(
                    content=r["content"],
                    metadata=r.get("metadata", {}),
                    score=float(r.get("score", 0.0)),
                )
                for r in dense_results[:top_k]
            ]
            return context

        # --- 3. BM25 search (blocking, offloaded to thread pool) ---
        corpus_texts = [d["content"] for d in corpus]
        loop = asyncio.get_event_loop()
        bm25_indices: list[int] = await loop.run_in_executor(
            None,
            partial(_bm25_search, corpus_texts, context.query, fetch_k),
        )

        # --- 4. RRF merge ---
        merged = _rrf_merge(
            dense_results=dense_results,
            bm25_indices=bm25_indices,
            corpus=corpus,
            top_k=top_k,
            bm25_weight=bm25_weight,
            dense_weight=dense_weight,
        )

        # --- 5. Populate context ---
        context.retrieved_chunks = [
            RetrievedChunk(
                content=r["content"],
                metadata=r.get("metadata", {}),
                score=float(r.get("score", 0.0)),
            )
            for r in merged
        ]

        logger.debug(
            "HybridRetrieverTask: retrieved %d chunks (dense=%d, corpus=%d) for agent %r.",
            len(context.retrieved_chunks),
            len(dense_results),
            len(corpus),
            context.agent_id,
        )
        return context

    async def validate_config(self, config: dict) -> None:
        if "top_k" in config and (not isinstance(config["top_k"], int) or config["top_k"] < 1):
            raise ValueError("top_k must be a positive integer.")
        for key in ("bm25_weight", "dense_weight"):
            if key in config:
                val = config[key]
                if not isinstance(val, (int, float)) or float(val) < 0.0:
                    raise ValueError(f"{key} must be a non-negative float.")
