# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.ollama_utils import ensure_ollama_model
from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext
from app.pipeline.registry import register

logger = logging.getLogger(__name__)


@register("embedding", "ollama")
class OllamaEmbeddingTask(BaseTask):
    """Embed text using a locally-running Ollama model.

    Config keys
    -----------
    model : str
        Ollama model name (default: ``"nomic-embed-text"``).
    batch_size : int
        Number of texts to embed per API call (default: ``32``).
    """

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding vector per input text."""
        if not texts:
            return []

        model: str = self.config.get("model", "nomic-embed-text")
        batch_size: int = int(self.config.get("batch_size", 32))
        settings = get_settings()
        base_url = settings.OLLAMA_BASE_URL

        await ensure_ollama_model(model)

        all_embeddings: list[list[float]] = []

        async with httpx.AsyncClient(timeout=120.0) as client:
            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                # Ollama /api/embed accepts a list of prompts in one call.
                resp = await client.post(
                    f"{base_url}/api/embed",
                    json={"model": model, "input": batch},
                )
                resp.raise_for_status()
                data: dict[str, Any] = resp.json()
                # Response: {"embeddings": [[...], [...], ...]}
                all_embeddings.extend(data["embeddings"])

        return all_embeddings

    async def run(self, context: PipelineContext) -> PipelineContext:
        if not context.chunks:
            return context

        texts = [c.content for c in context.chunks]
        embeddings = await self.embed_texts(texts)

        for chunk, embedding in zip(context.chunks, embeddings):
            chunk.embedding = embedding

        logger.debug(
            "OllamaEmbeddingTask: embedded %d chunks with model %r.",
            len(context.chunks),
            self.config.get("model", "nomic-embed-text"),
        )
        return context
