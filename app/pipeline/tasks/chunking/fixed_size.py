# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import asyncio
import logging
from functools import partial

from app.pipeline.base import BaseTask
from app.pipeline.context import Chunk, Document, PipelineContext
from app.pipeline.registry import register

logger = logging.getLogger(__name__)


def _split_document(doc: Document, chunk_size: int, chunk_overlap: int) -> list[str]:
    """Run CharacterTextSplitter synchronously."""
    from langchain_text_splitters import CharacterTextSplitter

    splitter = CharacterTextSplitter(
        separator="\n",
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        is_separator_regex=False,
    )
    return splitter.split_text(doc.content)


@register("chunking", "fixed_size")
class FixedSizeChunkingTask(BaseTask):
    """Split documents into fixed-size character chunks."""

    async def run(self, context: PipelineContext) -> PipelineContext:
        chunk_size: int = self.config.get("chunk_size", 500)
        chunk_overlap: int = self.config.get("chunk_overlap", 50)

        loop = asyncio.get_event_loop()

        for doc in context.documents:
            texts: list[str] = await loop.run_in_executor(
                None,
                partial(_split_document, doc, chunk_size, chunk_overlap),
            )
            for i, text in enumerate(texts):
                chunk = Chunk(
                    content=text,
                    metadata={
                        **doc.metadata,
                        "chunk_index": i,
                        "chunking": "fixed_size",
                    },
                )
                context.chunks.append(chunk)

        logger.debug(
            "FixedSizeChunkingTask: produced %d chunks from %d documents",
            len(context.chunks),
            len(context.documents),
        )
        return context

    async def validate_config(self, config: dict) -> None:
        if "chunk_size" in config and not isinstance(config["chunk_size"], int):
            raise ValueError("chunk_size must be an integer")
        if "chunk_overlap" in config and not isinstance(config["chunk_overlap"], int):
            raise ValueError("chunk_overlap must be an integer")
