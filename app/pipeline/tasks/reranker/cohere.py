# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext, RetrievedChunk
from app.pipeline.registry import register

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "rerank-english-v3.0"


@register("reranker", "cohere")
class CohereRerankerTask(BaseTask):
    """Rerank retrieved chunks using the Cohere Rerank API.

    Config keys
    -----------
    model : str
        Cohere rerank model name (default: ``"rerank-english-v3.0"``).
    top_n : int | None
        Number of top chunks to keep after reranking (default: ``None`` — keep all).
    """

    async def run(self, context: PipelineContext) -> PipelineContext:
        chunks = context.retrieved_chunks
        if not chunks:
            logger.debug("CohereRerankerTask: no retrieved chunks to rerank, skipping.")
            context.reranked_chunks = []
            return context

        import cohere

        from app.core.config import get_settings

        settings = get_settings()
        model: str = self.config.get("model", _DEFAULT_MODEL)
        top_n: int | None = self.config.get("top_n", None)

        client = cohere.AsyncClient(api_key=settings.COHERE_API_KEY)

        documents = [c.content for c in chunks]

        try:
            response = await client.rerank(
                model=model,
                query=context.query,
                documents=documents,
                top_n=top_n if top_n is not None else len(documents),
            )
        except Exception as exc:
            logger.error("CohereRerankerTask: rerank failed: %s", exc)
            context.errors.append(f"CohereRerankerTask: {exc}")
            context.reranked_chunks = list(chunks)
            return context

        reranked: list[RetrievedChunk] = []
        for result in response.results:
            original = chunks[result.index]
            reranked.append(
                RetrievedChunk(
                    content=original.content,
                    metadata=original.metadata,
                    score=result.relevance_score,
                )
            )

        # Results from Cohere are already sorted best-first, but we sort
        # defensively to guarantee the contract.
        reranked.sort(key=lambda c: c.score, reverse=True)

        context.reranked_chunks = reranked
        logger.debug(
            "CohereRerankerTask: reranked %d chunks → %d kept, model=%r.",
            len(chunks),
            len(reranked),
            model,
        )
        return context
