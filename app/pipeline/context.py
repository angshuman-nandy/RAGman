# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Document:
    content: str          # raw text content
    metadata: dict        # filename, file_type, page, etc.


@dataclass
class Chunk:
    content: str
    metadata: dict        # chunk_index, source_doc, etc.
    embedding: list[float] | None = None


@dataclass
class RetrievedChunk:
    content: str
    metadata: dict
    score: float


@dataclass
class PipelineContext:
    # shared config (set before pipeline runs)
    agent_id: str
    pipeline_config: dict   # the full PipelineConfig as dict

    # ingestion phase
    documents: list[Document] = field(default_factory=list)
    chunks: list[Chunk] = field(default_factory=list)

    # query phase
    query: str = ""
    retrieved_chunks: list[RetrievedChunk] = field(default_factory=list)
    reranked_chunks: list[RetrievedChunk] = field(default_factory=list)
    answer: str = ""
    sources: list[dict] = field(default_factory=list)

    # optional retrieval filter — source filenames to restrict vector search to
    document_filter: list[str] | None = None

    # runtime state
    errors: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)   # arbitrary extras
