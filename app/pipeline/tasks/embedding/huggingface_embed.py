# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import asyncio
import logging

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext
from app.pipeline.registry import register

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


@register("embedding", "huggingface")
class HuggingFaceEmbeddingTask(BaseTask):
    """Embed chunks locally using a SentenceTransformer model.

    Config keys
    -----------
    model : str
        HuggingFace model name or local path
        (default: ``"sentence-transformers/all-MiniLM-L6-v2"``).
    device : str
        Torch device string — e.g. ``"cpu"``, ``"cuda"``, ``"mps"``
        (default: ``"cpu"``).
    batch_size : int
        Number of texts encoded per call to ``model.encode()``
        (default: ``32``).
    """

    def __init__(self, config: dict | None = None) -> None:
        super().__init__(config)
        # Model is loaded lazily on first call so the class can be instantiated
        # without incurring the download/load cost upfront.
        self._model = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_model(self):
        """Return the cached SentenceTransformer, loading it on first call."""
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            model_name: str = self.config.get("model", _DEFAULT_MODEL)
            device: str = self.config.get("device", "cpu")
            logger.info(
                "HuggingFaceEmbeddingTask: loading model %r on device %r.",
                model_name,
                device,
            )
            self._model = SentenceTransformer(model_name, device=device)
        return self._model

    def _encode_sync(self, texts: list[str], batch_size: int) -> list[list[float]]:
        """Synchronous encode — runs inside a thread executor."""
        model = self._get_model()
        # encode() returns a numpy ndarray; convert to plain Python lists.
        vectors = model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        return [v.tolist() for v in vectors]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of raw strings and return their vectors.

        Shared entry-point used by semantic chunking and the multi-query
        retriever in addition to ``run()``.
        """
        if not texts:
            return []

        batch_size: int = int(self.config.get("batch_size", 32))

        loop = asyncio.get_event_loop()
        try:
            embeddings: list[list[float]] = await loop.run_in_executor(
                None, self._encode_sync, texts, batch_size
            )
        except Exception as exc:
            logger.error(
                "HuggingFaceEmbeddingTask: encode failed: %s", exc
            )
            raise

        return embeddings

    async def run(self, context: PipelineContext) -> PipelineContext:
        if not context.chunks:
            logger.debug("HuggingFaceEmbeddingTask: no chunks to embed, skipping.")
            return context

        texts = [c.content for c in context.chunks]
        embeddings = await self.embed_texts(texts)

        for chunk, embedding in zip(context.chunks, embeddings):
            chunk.embedding = embedding

        logger.debug(
            "HuggingFaceEmbeddingTask: embedded %d chunks with model %r.",
            len(context.chunks),
            self.config.get("model", _DEFAULT_MODEL),
        )
        return context

    async def validate_config(self, config: dict) -> None:
        batch_size = config.get("batch_size", 32)
        if not isinstance(batch_size, int) or batch_size < 1:
            raise ValueError(
                f"HuggingFaceEmbeddingTask: batch_size must be a positive integer, got {batch_size!r}."
            )
        device = config.get("device", "cpu")
        if not isinstance(device, str):
            raise ValueError(
                f"HuggingFaceEmbeddingTask: device must be a string, got {device!r}."
            )
