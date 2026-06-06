// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import type { PipelineConfig } from '../types'

export interface StepMeta {
  key: string
  label: string
  icon: string
  optional?: boolean
}

export interface OptionMeta {
  label: string
  sub: string
  icon?: string
  rec?: boolean
  default?: string
}

export interface StageMeta {
  title: string
  chipClass: string
  options: Record<string, OptionMeta>
}

export const PIPELINE_META: Record<string, StageMeta> = {
  ingestion: {
    title: 'Ingestion',
    chipClass: 'sky',
    options: {
      pdf:  { label: 'PDF',        sub: 'Portable Document Format',  icon: '📄' },
      docx: { label: 'DOCX',       sub: 'Microsoft Word documents',  icon: '📝' },
      txt:  { label: 'Plain text', sub: 'Raw .txt files',            icon: '🗒️' },
      md:   { label: 'Markdown',   sub: 'GitHub-flavored .md',       icon: '#'  },
    },
  },
  chunking: {
    title: 'Chunking',
    chipClass: 'violet',
    options: {
      fixed_size:      { label: 'Fixed size',        sub: 'Split by exact character count' },
      recursive:       { label: 'Recursive',         sub: 'Smart split by paragraphs → sentences → words', rec: true },
      semantic:        { label: 'Semantic',          sub: 'Split at meaning boundaries via embeddings' },
      sentence_window: { label: 'Sentence window',   sub: 'One sentence per chunk + context window' },
      doc_aware:       { label: 'Document-aware',    sub: 'Respects structure: headers for Markdown, pages for PDFs, paragraphs for DOCX' },
    },
  },
  embedding: {
    title: 'Embedding',
    chipClass: 'indigo',
    options: {
      openai:      { label: 'OpenAI',      sub: 'Requires API key',        default: 'text-embedding-3-small' },
      huggingface: { label: 'HuggingFace', sub: 'Runs locally',             default: 'sentence-transformers/all-MiniLM-L6-v2' },
      ollama:      { label: 'Ollama',      sub: 'Local via Ollama runtime', default: 'nomic-embed-text' },
    },
  },
  vector_store: {
    title: 'Vector Store',
    chipClass: 'teal',
    options: {
      chroma:   { label: 'ChromaDB',               sub: 'Lightweight, built-in',           rec: true },
      pgvector: { label: 'PostgreSQL + pgvector',   sub: 'Production-grade, SQL-compatible' },
    },
  },
  retriever: {
    title: 'Retriever',
    chipClass: 'amber',
    options: {
      similarity:  { label: 'Similarity search',    sub: 'Fast cosine similarity' },
      mmr:         { label: 'MMR — Diverse results', sub: 'Balances relevance and diversity' },
      hybrid:      { label: 'Hybrid BM25 + Vector',  sub: 'Combines keyword and semantic search', rec: true },
      multi_query: { label: 'Multi-query',           sub: 'Generates multiple query variants' },
    },
  },
  reranker: {
    title: 'Reranker',
    chipClass: 'rose',
    options: {
      cohere:      { label: 'Cohere Rerank',            sub: 'Requires API key' },
      huggingface: { label: 'HuggingFace cross-encoder', sub: 'Runs locally' },
      llm:         { label: 'LLM-based',                sub: 'Uses your chosen LLM to score' },
    },
  },
  llm: {
    title: 'LLM',
    chipClass: 'indigo',
    options: {
      openai:    { label: 'OpenAI',           sub: 'GPT-4o, GPT-4, etc.',        default: 'gpt-4o' },
      anthropic: { label: 'Anthropic Claude', sub: 'Claude Sonnet, Haiku, Opus', default: 'claude-sonnet-4-6' },
      ollama:    { label: 'Ollama',           sub: 'Local open-source models',   default: 'llama3.2' },
    },
  },
}

export const STEPS: StepMeta[] = [
  { key: 'basics',       label: 'Basics',        icon: 'sparkles' },
  { key: 'ingestion',    label: 'Ingestion',     icon: 'file-text' },
  { key: 'chunking',     label: 'Chunking',      icon: 'scissors' },
  { key: 'embedding',    label: 'Embedding',     icon: 'layers' },
  { key: 'vector_store', label: 'Vector Store',  icon: 'database' },
  { key: 'retriever',    label: 'Retriever',     icon: 'search' },
  { key: 'reranker',     label: 'Reranker',      icon: 'sliders', optional: true },
  { key: 'llm',          label: 'LLM',           icon: 'cpu' },
  { key: 'system_prompt', label: 'System Prompt', icon: 'message',      optional: true },
  { key: 'guardrails',    label: 'Guardrails',    icon: 'sliders',      optional: true },
  { key: 'review',        label: 'Review & Save', icon: 'check-circle' },
]

export const DEFAULT_PIPELINE: PipelineConfig = {
  ingestion: { type: 'pdf' },
  chunking: { type: 'recursive', params: { chunk_size: 500, chunk_overlap: 50 } },
  embedding: { provider: 'openai', model: 'text-embedding-3-small' },
  vector_store: { type: 'chroma' },
  retriever: { type: 'hybrid', params: { top_k: 5, bm25_weight: 0.3 } },
  reranker: null,
  llm: { provider: 'anthropic', model: 'claude-sonnet-4-6', params: { temperature: 0.3, max_tokens: 1024 } },
}
