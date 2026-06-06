# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging

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


@register("retriever", "similarity")
class SimilarityRetrieverTask(BaseTask):
    """Retrieve the top-k most similar chunks using plain vector similarity search.

    Config keys
    -----------
    top_k : int
        Number of chunks to return (default: ``5``).
    """

    async def run(self, context: PipelineContext) -> PipelineContext:
        top_k: int = int(self.config.get("top_k", 5))

        embedding_config: dict = context.pipeline_config["embedding"]
        vs_config: dict = context.pipeline_config["vector_store"]

        # --- 1. Embed the query ---
        embedder = _get_embedder(embedding_config)
        query_embeddings = await embedder.embed_texts([context.query])
        query_embedding: list[float] = query_embeddings[0]

        # --- 2. Query the vector store ---
        vector_store = _get_vector_store(vs_config)
        raw_results: list[dict] = await vector_store.similarity_search(
            agent_id=context.agent_id,
            query_embedding=query_embedding,
            top_k=top_k,
            source_filter=context.document_filter,
        )

        # --- 3. Map results to RetrievedChunk objects ---
        context.retrieved_chunks = [
            RetrievedChunk(
                content=r["content"],
                metadata=r.get("metadata", {}),
                score=float(r.get("score", 0.0)),
            )
            for r in raw_results
        ]

        logger.debug(
            "SimilarityRetrieverTask: retrieved %d chunks for agent %r.",
            len(context.retrieved_chunks),
            context.agent_id,
        )
        return context

    async def validate_config(self, config: dict) -> None:
        if "top_k" in config and (not isinstance(config["top_k"], int) or config["top_k"] < 1):
            raise ValueError("top_k must be a positive integer.")
