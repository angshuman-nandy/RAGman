# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import asyncio
import logging

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext, RetrievedChunk
from app.pipeline.registry import register

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


@register("reranker", "huggingface")
class HuggingFaceRerankerTask(BaseTask):
    """Rerank retrieved chunks using a local CrossEncoder model.

    Config keys
    -----------
    model : str
        HuggingFace cross-encoder model name or local path
        (default: ``"cross-encoder/ms-marco-MiniLM-L-6-v2"``).
    top_n : int | None
        Number of top chunks to keep after reranking (default: ``None`` — keep all).
    """

    def __init__(self, config: dict | None = None) -> None:
        super().__init__(config)
        # Model is loaded lazily on first call to avoid paying the load cost
        # at import / construction time.
        self._cross_encoder = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_model(self):
        """Return the cached CrossEncoder, loading it on first call."""
        if self._cross_encoder is None:
            from sentence_transformers import CrossEncoder

            model_name: str = self.config.get("model", _DEFAULT_MODEL)
            logger.info(
                "HuggingFaceRerankerTask: loading cross-encoder %r.", model_name
            )
            self._cross_encoder = CrossEncoder(model_name)
        return self._cross_encoder

    def _predict_sync(self, pairs: list[tuple[str, str]]) -> list[float]:
        """Synchronous predict — runs inside a thread executor."""
        model = self._get_model()
        scores = model.predict(pairs)
        # scores may be a numpy array; convert to a plain Python list of floats.
        return [float(s) for s in scores]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def run(self, context: PipelineContext) -> PipelineContext:
        chunks = context.retrieved_chunks
        if not chunks:
            logger.debug(
                "HuggingFaceRerankerTask: no retrieved chunks to rerank, skipping."
            )
            context.reranked_chunks = []
            return context

        top_n: int | None = self.config.get("top_n", None)

        pairs = [(context.query, c.content) for c in chunks]

        loop = asyncio.get_event_loop()
        try:
            scores: list[float] = await loop.run_in_executor(
                None, self._predict_sync, pairs
            )
        except Exception as exc:
            logger.error(
                "HuggingFaceRerankerTask: cross-encoder predict failed: %s", exc
            )
            context.errors.append(f"HuggingFaceRerankerTask: {exc}")
            context.reranked_chunks = list(chunks)
            return context

        scored: list[tuple[float, RetrievedChunk]] = [
            (score, RetrievedChunk(content=chunk.content, metadata=chunk.metadata, score=score))
            for score, chunk in zip(scores, chunks)
        ]
        scored.sort(key=lambda t: t[0], reverse=True)

        if top_n is not None:
            scored = scored[:top_n]

        context.reranked_chunks = [chunk for _, chunk in scored]

        logger.debug(
            "HuggingFaceRerankerTask: reranked %d chunks → %d kept, model=%r.",
            len(chunks),
            len(context.reranked_chunks),
            self.config.get("model", _DEFAULT_MODEL),
        )
        return context
