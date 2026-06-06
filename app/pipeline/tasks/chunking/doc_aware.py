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


def _split_markdown(doc: Document, chunk_size: int, chunk_overlap: int) -> list[tuple[str, dict]]:
    """Split a Markdown document on headers, then sub-split oversized sections."""
    from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")],
        strip_headers=False,
    )
    recursive_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )

    header_docs = header_splitter.split_text(doc.content)
    results: list[tuple[str, dict]] = []

    for hd in header_docs:
        text = hd.page_content
        header_meta = {k: v for k, v in hd.metadata.items() if v}
        if len(text) <= chunk_size:
            results.append((text, header_meta))
        else:
            sub_texts = recursive_splitter.split_text(text)
            for sub in sub_texts:
                results.append((sub, header_meta))

    return results


def _split_structured(doc: Document, chunk_size: int, chunk_overlap: int) -> list[str]:
    """Split DOCX/TXT with paragraph-aware separators."""
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        separators=["\n\n\n", "\n\n", "\n", ". ", " ", ""],
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )
    return splitter.split_text(doc.content)


def _split_pdf_page(doc: Document, chunk_size: int, chunk_overlap: int) -> list[str]:
    """Recursive split within a single PDF page (each doc is already one page)."""
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )
    return splitter.split_text(doc.content)


@register("chunking", "doc_aware")
class DocAwareChunkingTask(BaseTask):
    """Document-structure-aware chunking.

    Splits each document according to its file type:
    - Markdown  : splits on ``#``/``##``/``###`` headers (preserving hierarchy
                  in chunk metadata), then recursively sub-splits large sections.
    - PDF       : each Document is already a single page; applies recursive
                  splitting within the page to stay within chunk_size.
    - DOCX/TXT  : recursive splitting with paragraph-level separators
                  (triple-newline → double-newline → newline → sentence → word).

    Config keys
    -----------
    chunk_size    : int — maximum characters per chunk (default 500)
    chunk_overlap : int — character overlap between chunks (default 50)
    """

    async def run(self, context: PipelineContext) -> PipelineContext:
        chunk_size: int = self.config.get("chunk_size", 500)
        chunk_overlap: int = self.config.get("chunk_overlap", 50)

        loop = asyncio.get_event_loop()
        chunk_index = 0

        for doc in context.documents:
            file_type = doc.metadata.get("file_type", "txt")

            if file_type == "md":
                pairs: list[tuple[str, dict]] = await loop.run_in_executor(
                    None,
                    partial(_split_markdown, doc, chunk_size, chunk_overlap),
                )
                for text, header_meta in pairs:
                    context.chunks.append(Chunk(
                        content=text,
                        metadata={
                            **doc.metadata,
                            **header_meta,
                            "chunk_index": chunk_index,
                            "chunking": "doc_aware",
                        },
                    ))
                    chunk_index += 1

            elif file_type == "pdf":
                texts: list[str] = await loop.run_in_executor(
                    None,
                    partial(_split_pdf_page, doc, chunk_size, chunk_overlap),
                )
                for text in texts:
                    context.chunks.append(Chunk(
                        content=text,
                        metadata={
                            **doc.metadata,
                            "chunk_index": chunk_index,
                            "chunking": "doc_aware",
                        },
                    ))
                    chunk_index += 1

            else:
                texts = await loop.run_in_executor(
                    None,
                    partial(_split_structured, doc, chunk_size, chunk_overlap),
                )
                for text in texts:
                    context.chunks.append(Chunk(
                        content=text,
                        metadata={
                            **doc.metadata,
                            "chunk_index": chunk_index,
                            "chunking": "doc_aware",
                        },
                    ))
                    chunk_index += 1

        logger.debug(
            "DocAwareChunkingTask: produced %d chunks from %d documents",
            len(context.chunks),
            len(context.documents),
        )
        return context

    async def validate_config(self, config: dict) -> None:
        if "chunk_size" in config and not isinstance(config["chunk_size"], int):
            raise ValueError("chunk_size must be an integer")
        if "chunk_overlap" in config and not isinstance(config["chunk_overlap"], int):
            raise ValueError("chunk_overlap must be an integer")
