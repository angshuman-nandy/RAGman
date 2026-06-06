// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { ChunksResponse, RechunkResponse, RetrievalResponse, EmbeddingsResponse, Document } from '../types'

const BASE = (agentId: string, docId: string) => `/agents/${agentId}/documents/${docId}`

export function useDocumentChunks(agentId: string, docId: string) {
  return useQuery<ChunksResponse>({
    queryKey: ['doc-chunks', agentId, docId],
    queryFn: () => apiFetch<ChunksResponse>(`${BASE(agentId, docId)}/chunks`),
    enabled: Boolean(agentId && docId),
  })
}

export function useRechunk(agentId: string, docId: string) {
  return useMutation<RechunkResponse, Error, { strategy: string; params: Record<string, number> }>({
    mutationFn: (body) =>
      apiFetch<RechunkResponse>(`${BASE(agentId, docId)}/rechunk`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  })
}

export function useRetrieve(agentId: string, docId: string) {
  return useMutation<RetrievalResponse, Error, { query: string; strategy: string; params: Record<string, number> }>({
    mutationFn: (body) =>
      apiFetch<RetrievalResponse>(`${BASE(agentId, docId)}/retrieve`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  })
}

export function useReprocessDocument(agentId: string, docId: string) {
  return useMutation<Document, Error, { chunking: { type: string; params: Record<string, number> } }>({
    mutationFn: (body) =>
      apiFetch<Document>(`/agents/${agentId}/documents/${docId}/reprocess`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  })
}

export interface RerankResult {
  rank: number
  content: string
  score: number
  metadata: Record<string, unknown>
}

export interface RerankResponse {
  query: string
  reranker_type: string
  before: RerankResult[]
  after: RerankResult[]
}

export function useRerank(agentId: string, docId: string) {
  return useMutation<
    RerankResponse,
    Error,
    { query: string; reranker_type: string; top_n: number; retriever_top_k: number }
  >({
    mutationFn: (body) =>
      apiFetch<RerankResponse>(`${BASE(agentId, docId)}/rerank`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  })
}

export function useEmbeddings(agentId: string, docId: string) {
  return useQuery<EmbeddingsResponse>({
    queryKey: ['doc-embeddings', agentId, docId],
    queryFn: () => apiFetch<EmbeddingsResponse>(`${BASE(agentId, docId)}/embeddings`),
    enabled: Boolean(agentId && docId),
    staleTime: 5 * 60 * 1000, // UMAP is expensive — cache 5 min
  })
}
