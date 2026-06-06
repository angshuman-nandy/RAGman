# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging

import aiofiles

from app.pipeline.base import BaseTask
from app.pipeline.context import Document, PipelineContext
from app.pipeline.registry import register

logger = logging.getLogger(__name__)


@register("ingestion", "txt")
@register("ingestion", "md")
class TextIngestionTask(BaseTask):
    """Ingest a plain-text or Markdown file as a single Document."""

    async def run(self, context: PipelineContext) -> PipelineContext:
        file_path: str = context.metadata["file_path"]
        filename: str = context.metadata.get("filename", file_path)
        file_type: str = context.metadata.get("file_type", "txt")

        async with aiofiles.open(file_path, mode="r", encoding="utf-8", errors="replace") as fh:
            text = await fh.read()

        doc = Document(
            content=text,
            metadata={
                "source": filename,
                "file_type": file_type,
            },
        )
        context.documents.append(doc)

        logger.debug(
            "TextIngestionTask: read %d chars from %r (type=%r)",
            len(text),
            filename,
            file_type,
        )
        return context

    async def validate_config(self, config: dict) -> None:
        pass
