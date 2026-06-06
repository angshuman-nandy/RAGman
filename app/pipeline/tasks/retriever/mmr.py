# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging

import numpy as np

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext, RetrievedChunk
from app.pipeline.registry import register

logger = logging.getLogger(__name__)


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


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two 1-D vectors."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _apply_mmr(
    query_embedding: list[float],
    candidates: list[dict],
    top_k: int,
    lambda_mult: float,
) -> list[dict]:
    """Select top_k diverse results from candidates using Max Marginal Relevance.

    Parameters
    ----------
    query_embedding : list[float]
        Embedding of the user query.
    candidates : list[dict]
        Each dict must have ``"embedding"`` (list[float]), ``"content"``,
        ``"metadata"``, and ``"score"``.
    top_k : int
        Number of results to return.
    lambda_mult : float
        Trade-off between relevance (1.0) and diversity (0.0).
    """
    if not candidates:
        return []

    top_k = min(top_k, len(candidates))

    q_vec = np.array(query_embedding, dtype=float)
    # Pre-compute embeddings matrix
    cand_vecs: list[np.ndarray] = [np.array(c["embedding"], dtype=float) for c in candidates]

    # Relevance scores of each candidate to the query
    relevance: list[float] = [_cosine_similarity(q_vec, v) for v in cand_vecs]

    selected_indices: list[int] = []
    remaining_indices: list[int] = list(range(len(candidates)))

    while len(selected_indices) < top_k and remaining_indices:
        if not selected_indices:
            # Bootstrap with the most relevant candidate
            best_idx = max(remaining_indices, key=lambda i: relevance[i])
        else:
            best_idx = -1
            best_score = float("-inf")
            for i in remaining_indices:
                # Maximum similarity to any already-selected document
                max_sim_to_selected = max(
                    _cosine_similarity(cand_vecs[i], cand_vecs[j])
                    for j in selected_indices
                )
                mmr_score = (
                    lambda_mult * relevance[i]
                    - (1.0 - lambda_mult) * max_sim_to_selected
                )
                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = i

        selected_indices.append(best_idx)
        remaining_indices.remove(best_idx)

    return [candidates[i] for i in selected_indices]


@register("retriever", "mmr")
class MMRRetrieverTask(BaseTask):
    """Retrieve chunks using Max Marginal Relevance (relevance + diversity).

    Config keys
    -----------
    top_k : int
        Number of final chunks to return (default: ``5``).
    fetch_k : int
        Number of candidates to retrieve from the vector store before MMR
        re-ranking (default: ``20``).
    lambda_mult : float
        MMR trade-off parameter. 1.0 = pure relevance, 0.0 = pure diversity
        (default: ``0.5``).
    """

    async def run(self, context: PipelineContext) -> PipelineContext:
        top_k: int = int(self.config.get("top_k", 5))
        fetch_k: int = int(self.config.get("fetch_k", 20))
        lambda_mult: float = float(self.config.get("lambda_mult", 0.5))

        embedding_config: dict = context.pipeline_config["embedding"]
        vs_config: dict = context.pipeline_config["vector_store"]

        # --- 1. Embed the query ---
        embedder = _get_embedder(embedding_config)
        query_embeddings = await embedder.embed_texts([context.query])
        query_embedding: list[float] = query_embeddings[0]

        # --- 2. Fetch fetch_k candidates from the vector store ---
        vector_store = _get_vector_store(vs_config)
        raw_results: list[dict] = await vector_store.similarity_search(
            agent_id=context.agent_id,
            query_embedding=query_embedding,
            top_k=fetch_k,
            source_filter=context.document_filter,
        )

        # The vector store may not return embeddings; ask it to include them.
        # Fallback: if embedding is absent, use the query embedding (degrades MMR
        # to pure relevance ranking), which is still safe.
        for r in raw_results:
            if "embedding" not in r or r["embedding"] is None:
                r["embedding"] = query_embedding

        # --- 3. Apply MMR ---
        mmr_results = _apply_mmr(
            query_embedding=query_embedding,
            candidates=raw_results,
            top_k=top_k,
            lambda_mult=lambda_mult,
        )

        # --- 4. Populate context ---
        context.retrieved_chunks = [
            RetrievedChunk(
                content=r["content"],
                metadata=r.get("metadata", {}),
                score=float(r.get("score", 0.0)),
            )
            for r in mmr_results
        ]

        logger.debug(
            "MMRRetrieverTask: selected %d/%d candidates (lambda=%.2f) for agent %r.",
            len(context.retrieved_chunks),
            len(raw_results),
            lambda_mult,
            context.agent_id,
        )
        return context

    async def validate_config(self, config: dict) -> None:
        for key in ("top_k", "fetch_k"):
            if key in config and (not isinstance(config[key], int) or config[key] < 1):
                raise ValueError(f"{key} must be a positive integer.")
        if "lambda_mult" in config:
            lm = config["lambda_mult"]
            if not isinstance(lm, (int, float)) or not (0.0 <= float(lm) <= 1.0):
                raise ValueError("lambda_mult must be a float in [0.0, 1.0].")
