// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
export type IngestionType = 'pdf' | 'docx' | 'txt' | 'md'
export type ChunkingType = 'fixed_size' | 'recursive' | 'semantic' | 'sentence_window' | 'doc_aware'
export type EmbeddingProvider = 'openai' | 'huggingface' | 'ollama'
export type VectorStoreType = 'chroma' | 'pgvector'
export type RetrieverType = 'similarity' | 'mmr' | 'hybrid' | 'multi_query'
export type RerankerType = 'cohere' | 'huggingface' | 'llm'
export type LLMProvider = 'openai' | 'anthropic' | 'ollama'

export interface SystemPromptConfig {
  mode: 'append' | 'replace'
  content: string
}

export interface GuardrailsConfig {
  topic_restrictions: string
  forbidden_content: string[]
  format_rules: string
  confidence_threshold: number
  history_retention: number
}

export interface PipelineConfig {
  ingestion: { type: IngestionType }
  chunking: { type: ChunkingType; params: Record<string, number> }
  embedding: { provider: EmbeddingProvider; model: string; params?: Record<string, unknown> }
  vector_store: { type: VectorStoreType; params?: Record<string, unknown> }
  retriever: { type: RetrieverType; params: Record<string, number> }
  reranker: { type: RerankerType; params: Record<string, number> } | null
  llm: { provider: LLMProvider; model: string; params: Record<string, number> }
  system_prompt?: SystemPromptConfig | null
  guardrails?: GuardrailsConfig | null
}

export interface Agent {
  id: string
  name: string
  description: string | null
  pipeline: PipelineConfig
  created_at: string
  updated_at: string | null
  document_count: number
}

export interface AgentListResponse {
  items: Agent[]
  total: number
}

export type DocumentStatus = 'pending' | 'ingesting' | 'ready' | 'failed'
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface Document {
  id: string
  agent_id: string
  filename: string
  file_type: string
  status: DocumentStatus
  chunk_count: number
  error_message: string | null
  created_at: string
  ingestion_steps: Record<string, StepStatus>
}

export interface DocumentListResponse {
  items: Document[]
  total: number
}

export interface QueryRequest {
  question: string
  stream: boolean
  document_ids?: string[]
}

export interface WizardForm {
  name: string
  description: string
  pipeline: PipelineConfig
}

export interface ChunkOverview {
  index: number
  content: string
  char_count: number
  metadata: Record<string, unknown>
}

export interface ChunksResponse {
  chunks: ChunkOverview[]
  total: number
}

export interface RechunkResponse {
  strategy: string
  chunks: Array<{ index: number; content: string; char_count: number }>
  total: number
}

export interface RetrievalResult {
  rank: number
  content: string
  score: number
  metadata: Record<string, unknown>
}

export interface RetrievalResponse {
  strategy: string
  query: string
  results: RetrievalResult[]
}

export interface ScatterPoint {
  x: number
  y: number
  label: string
  chunk_index: number
}

export interface EmbeddingsResponse {
  scatter: ScatterPoint[]
  heatmap: number[][]
  labels: string[]
}

export interface HistoryChunk {
  doc_id: string
  filename: string
  chunk_index: number
  score: number
  content: string
}

export interface QueryHistoryEntry {
  id: string
  agent_id: string
  question: string
  answer: string
  retrieval_strategy: string
  document_filter: string[] | null
  retrieved_chunks: HistoryChunk[]
  reranked_chunks: HistoryChunk[] | null
  created_at: string
}

export interface QueryHistoryListResponse {
  items: QueryHistoryEntry[]
  total: number
}
