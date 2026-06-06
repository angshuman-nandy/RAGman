# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging
import re

from app.pipeline.base import BaseTask
from app.pipeline.context import Chunk, PipelineContext
from app.pipeline.registry import register

logger = logging.getLogger(__name__)

_SENTENCE_PATTERN = re.compile(r"(?<=[.!?])\s+")


def _split_sentences(text: str) -> list[str]:
    """Split *text* into sentences using punctuation as delimiters."""
    sentences = _SENTENCE_PATTERN.split(text.strip())
    return [s.strip() for s in sentences if s.strip()]


@register("chunking", "sentence_window")
class SentenceWindowChunkingTask(BaseTask):
    """
    Sentence-window chunking.

    Each sentence becomes its own Chunk (for tight embedding/indexing), but
    ``chunk.metadata["window_text"]`` holds *window_size* surrounding sentences
    on each side — this wider context is what the generator sees at query time.

    Config keys
    -----------
    window_size : int — number of sentences on each side of the target sentence
                        to include in window_text (default 3)
    """

    async def run(self, context: PipelineContext) -> PipelineContext:
        window_size: int = self.config.get("window_size", 3)

        chunk_index: int = 0

        for doc in context.documents:
            sentences = _split_sentences(doc.content)

            for i, sentence in enumerate(sentences):
                lo = max(0, i - window_size)
                hi = min(len(sentences), i + window_size + 1)
                window_text = " ".join(sentences[lo:hi])

                chunk = Chunk(
                    content=sentence,
                    metadata={
                        **doc.metadata,
                        "chunk_index": chunk_index,
                        "sentence_index": i,
                        "window_text": window_text,
                        "chunking": "sentence_window",
                    },
                )
                context.chunks.append(chunk)
                chunk_index += 1

        logger.debug(
            "SentenceWindowChunkingTask: produced %d chunks from %d documents "
            "(window_size=%d)",
            len(context.chunks),
            len(context.documents),
            window_size,
        )
        return context

    async def validate_config(self, config: dict) -> None:
        if "window_size" in config:
            val = config["window_size"]
            if not isinstance(val, int) or val < 1:
                raise ValueError("window_size must be a positive integer")
