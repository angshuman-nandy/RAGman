# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext
from app.pipeline.registry import register

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


@register("embedding", "openai")
class OpenAIEmbeddingTask(BaseTask):
    """Embed chunks using the OpenAI Embeddings API.

    Config keys
    -----------
    model : str
        Embedding model name (default: ``"text-embedding-3-small"``).
    batch_size : int
        Number of texts sent per API call (default: ``100``).
    """

    async def run(self, context: PipelineContext) -> PipelineContext:
        if not context.chunks:
            logger.debug("OpenAIEmbeddingTask: no chunks to embed, skipping.")
            return context

        texts = [c.content for c in context.chunks]
        embeddings = await self.embed_texts(texts)

        for chunk, embedding in zip(context.chunks, embeddings):
            chunk.embedding = embedding

        logger.debug(
            "OpenAIEmbeddingTask: embedded %d chunks with model %r.",
            len(context.chunks),
            self.config.get("model", "text-embedding-3-small"),
        )
        return context

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of raw strings and return their vectors.

        This is the shared entry-point used by semantic chunking and
        the multi-query retriever, as well as ``run()``.
        """
        import openai

        from app.core.config import get_settings

        settings = get_settings()
        model: str = self.config.get("model", "text-embedding-3-small")
        batch_size: int = int(self.config.get("batch_size", 100))

        client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        all_embeddings: list[list[float]] = []

        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            try:
                response = await client.embeddings.create(
                    input=batch,
                    model=model,
                )
                # The API returns items sorted by index, but we sort defensively.
                sorted_data = sorted(response.data, key=lambda d: d.index)
                all_embeddings.extend([item.embedding for item in sorted_data])
            except openai.OpenAIError as exc:
                logger.error(
                    "OpenAIEmbeddingTask: API error on batch [%d:%d]: %s",
                    start,
                    start + batch_size,
                    exc,
                )
                raise

        return all_embeddings

    async def validate_config(self, config: dict) -> None:
        batch_size = config.get("batch_size", 100)
        if not isinstance(batch_size, int) or batch_size < 1:
            raise ValueError(
                f"OpenAIEmbeddingTask: batch_size must be a positive integer, got {batch_size!r}."
            )
