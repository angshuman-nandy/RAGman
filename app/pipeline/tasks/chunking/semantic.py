# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import asyncio
import logging
import math
import re
from functools import partial
from typing import TYPE_CHECKING

from app.pipeline.base import BaseTask
from app.pipeline.context import Chunk, Document, PipelineContext
from app.pipeline.registry import register

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SENTENCE_PATTERN = re.compile(r"(?<=[.!?])\s+")


def _split_sentences(text: str) -> list[str]:
    """Split *text* into sentences using punctuation as delimiters."""
    sentences = _SENTENCE_PATTERN.split(text.strip())
    return [s.strip() for s in sentences if s.strip()]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def _get_embed_func(pipeline_config: dict):
    """
    Return a synchronous callable ``embed(texts) -> list[list[float]]``
    backed by the agent's configured embedding provider.
    """
    embedding_cfg: dict = pipeline_config.get("embedding", {})
    provider: str = (
        embedding_cfg.get("provider") or embedding_cfg.get("type") or "openai"
    ).lower()

    if provider == "openai":
        from app.pipeline.tasks.embedding.openai_embed import OpenAIEmbeddingTask  # type: ignore

        task = OpenAIEmbeddingTask(config=embedding_cfg)
    elif provider == "ollama":
        from app.pipeline.tasks.embedding.ollama_embed import OllamaEmbeddingTask  # type: ignore

        task = OllamaEmbeddingTask(config=embedding_cfg)
    else:
        from app.pipeline.tasks.embedding.huggingface_embed import HuggingFaceEmbeddingTask  # type: ignore

        task = HuggingFaceEmbeddingTask(config=embedding_cfg)

    def embed_texts(texts: list[str]) -> list[list[float]]:
        """Synchronous wrapper — safe to call inside run_in_executor."""
        # Both embedding tasks expose a synchronous _embed_texts() or we call
        # their internal helpers.  As a resilient fallback we use asyncio.run()
        # on a new event loop if necessary.
        if hasattr(task, "_embed_texts_sync"):
            return task._embed_texts_sync(texts)

        # Build a temporary event loop for the sync context.
        import asyncio as _asyncio

        loop = _asyncio.new_event_loop()
        try:
            dummy_ctx = type("_Ctx", (), {"chunks": [], "pipeline_config": pipeline_config})()  # type: ignore[call-arg]
            # If the task has an embed helper, use it directly; otherwise
            # create minimal chunk objects and run the task.
            if hasattr(task, "embed_texts"):
                return loop.run_until_complete(task.embed_texts(texts))
            # Last resort: compute via the OpenAI / HF client directly.
            raise AttributeError("No known embed helper on task")
        finally:
            loop.close()

    return embed_texts


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------


def _chunk_document_semantically(
    doc: Document,
    pipeline_config: dict,
    chunk_size: int,
    similarity_threshold: float,
) -> list[str]:
    """
    Pure-sync semantic chunking — suitable for run_in_executor.

    Algorithm
    ---------
    1. Split the document into sentences.
    2. Embed every sentence in one batch call.
    3. Walk through sentences; start a new chunk when cosine similarity to the
       previous sentence drops below *similarity_threshold* OR the running
       character count would exceed *chunk_size*.
    """
    sentences = _split_sentences(doc.content)
    if not sentences:
        return []

    if len(sentences) == 1:
        return [sentences[0]]

    embed = _get_embed_func(pipeline_config)
    embeddings: list[list[float]] = embed(sentences)

    chunks: list[str] = []
    current_sentences: list[str] = [sentences[0]]
    current_len: int = len(sentences[0])

    for idx in range(1, len(sentences)):
        sentence = sentences[idx]
        sim = _cosine_similarity(embeddings[idx - 1], embeddings[idx])
        would_exceed = (current_len + 1 + len(sentence)) > chunk_size

        if sim < similarity_threshold or would_exceed:
            # Flush current chunk and start a new one.
            chunks.append(" ".join(current_sentences))
            current_sentences = [sentence]
            current_len = len(sentence)
        else:
            current_sentences.append(sentence)
            current_len += 1 + len(sentence)

    # Flush the last chunk.
    if current_sentences:
        chunks.append(" ".join(current_sentences))

    return chunks


@register("chunking", "semantic")
class SemanticChunkingTask(BaseTask):
    """
    Semantic chunking: split at points where consecutive-sentence embedding
    cosine similarity drops below a configurable threshold.

    Config keys
    -----------
    chunk_size           : int   — maximum characters per chunk (default 500)
    chunk_overlap        : int   — ignored (kept for API consistency)
    similarity_threshold : float — cosine-sim boundary for a new chunk (default 0.8)
    """

    async def run(self, context: PipelineContext) -> PipelineContext:
        chunk_size: int = self.config.get("chunk_size", 500)
        similarity_threshold: float = self.config.get("similarity_threshold", 0.8)

        loop = asyncio.get_event_loop()

        for doc in context.documents:
            texts: list[str] = await loop.run_in_executor(
                None,
                partial(
                    _chunk_document_semantically,
                    doc,
                    context.pipeline_config,
                    chunk_size,
                    similarity_threshold,
                ),
            )
            for i, text in enumerate(texts):
                chunk = Chunk(
                    content=text,
                    metadata={
                        **doc.metadata,
                        "chunk_index": i,
                        "chunking": "semantic",
                    },
                )
                context.chunks.append(chunk)

        logger.debug(
            "SemanticChunkingTask: produced %d chunks from %d documents",
            len(context.chunks),
            len(context.documents),
        )
        return context

    async def validate_config(self, config: dict) -> None:
        if "similarity_threshold" in config:
            val = config["similarity_threshold"]
            if not isinstance(val, (int, float)) or not (0.0 <= float(val) <= 1.0):
                raise ValueError("similarity_threshold must be a float in [0, 1]")
        if "chunk_size" in config and not isinstance(config["chunk_size"], int):
            raise ValueError("chunk_size must be an integer")
