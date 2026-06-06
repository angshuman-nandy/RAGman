# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import asyncio
import logging
from functools import partial

from app.pipeline.base import BaseTask
from app.pipeline.context import Document, PipelineContext
from app.pipeline.registry import register

logger = logging.getLogger(__name__)


def _extract_pages(file_path: str) -> list[tuple[int, str]]:
    """Open a PDF with PyMuPDF and return [(page_number, text), ...]."""
    import fitz  # type: ignore[import-untyped]  # pymupdf ships as fitz

    pages: list[tuple[int, str]] = []
    with fitz.open(file_path) as doc:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text()
            pages.append((page_num, text))
    return pages


@register("ingestion", "pdf")
class PDFIngestionTask(BaseTask):
    """Ingest a PDF file, yielding one Document per page."""

    async def run(self, context: PipelineContext) -> PipelineContext:
        file_path: str = context.metadata["file_path"]
        filename: str = context.metadata.get("filename", file_path)

        loop = asyncio.get_event_loop()
        pages = await loop.run_in_executor(None, partial(_extract_pages, file_path))

        for page_num, text in pages:
            doc = Document(
                content=text,
                metadata={
                    "source": filename,
                    "page": page_num,
                    "file_type": "pdf",
                },
            )
            context.documents.append(doc)

        logger.debug(
            "PDFIngestionTask: extracted %d pages from %r", len(pages), filename
        )
        return context
