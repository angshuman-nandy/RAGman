# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Pipeline sub-configs
# ---------------------------------------------------------------------------


class IngestionConfig(BaseModel):
    type: Literal["pdf", "docx", "txt", "md"]


class ChunkingConfig(BaseModel):
    type: Literal["fixed_size", "recursive", "semantic", "sentence_window", "doc_aware"]
    params: dict = {}


class EmbeddingConfig(BaseModel):
    provider: Literal["openai", "huggingface", "ollama"]
    model: str  # e.g. "text-embedding-3-small", "sentence-transformers/all-MiniLM-L6-v2"
    params: dict = {}


class VectorStoreConfig(BaseModel):
    type: Literal["chroma", "pgvector"]
    params: dict = {}


class RetrieverConfig(BaseModel):
    type: Literal["similarity", "mmr", "hybrid", "multi_query"]
    params: dict = {}  # top_k, bm25_weight, num_queries, etc.


class RerankerConfig(BaseModel):
    type: Literal["cohere", "huggingface", "llm"]
    model: str = ""
    params: dict = {}


class LLMConfig(BaseModel):
    provider: Literal["openai", "anthropic", "ollama"]
    model: str
    params: dict = {}  # temperature, max_tokens, etc.


class SystemPromptConfig(BaseModel):
    mode: Literal["append", "replace"] = "append"
    content: str = ""

class GuardrailsConfig(BaseModel):
    topic_restrictions: str = ""
    forbidden_content: list[str] = []
    format_rules: str = ""
    confidence_threshold: float = 0.0
    history_retention: int = 25


class PipelineConfig(BaseModel):
    ingestion: IngestionConfig
    chunking: ChunkingConfig
    embedding: EmbeddingConfig
    vector_store: VectorStoreConfig
    retriever: RetrieverConfig
    reranker: RerankerConfig | None = None
    llm: LLMConfig
    system_prompt: SystemPromptConfig | None = None
    guardrails: GuardrailsConfig | None = None


# ---------------------------------------------------------------------------
# Agent schemas
# ---------------------------------------------------------------------------


class AgentCreate(BaseModel):
    name: str
    description: str | None = None
    pipeline: PipelineConfig


class AgentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    pipeline: PipelineConfig | None = None


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    pipeline: PipelineConfig
    created_at: datetime
    updated_at: datetime | None
    document_count: int = 0


class AgentListResponse(BaseModel):
    items: list[AgentResponse]
    total: int


# ---------------------------------------------------------------------------
# Document schemas
# ---------------------------------------------------------------------------


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID
    filename: str
    file_type: str
    status: str
    chunk_count: int
    error_message: str | None
    ingestion_steps: dict = {}
    created_at: datetime


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int


# ---------------------------------------------------------------------------
# Query schemas
# ---------------------------------------------------------------------------


class QueryRequest(BaseModel):
    question: str
    stream: bool = True
    document_ids: list[uuid.UUID] | None = None


class QueryResponse(BaseModel):
    """Non-streaming fallback response."""

    answer: str
    sources: list[dict]


# ---------------------------------------------------------------------------
# History schemas
# ---------------------------------------------------------------------------


class HistoryChunk(BaseModel):
    doc_id: str
    filename: str
    chunk_index: int
    score: float
    content: str


class QueryHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID
    question: str
    answer: str
    retrieval_strategy: str
    document_filter: list[str] | None
    retrieved_chunks: list[HistoryChunk]
    reranked_chunks: list[HistoryChunk] | None
    created_at: datetime


class QueryHistoryListResponse(BaseModel):
    items: list[QueryHistoryResponse]
    total: int
