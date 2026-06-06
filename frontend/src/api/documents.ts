// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { Document, DocumentListResponse } from '../types'

const BASE = '/api/v1'

const docsKey = (agentId: string) => ['agents', agentId, 'documents'] as const

// GET /api/v1/agents/:id/documents
export function useDocuments(agentId: string) {
  return useQuery<DocumentListResponse>({
    queryKey: docsKey(agentId),
    queryFn: () => apiFetch<DocumentListResponse>(`/agents/${agentId}/documents`),
    enabled: Boolean(agentId),
    refetchOnMount: 'always',
  })
}

// POST /api/v1/agents/:id/documents (multipart/form-data)
export function useUploadDocuments(agentId: string) {
  const queryClient = useQueryClient()
  return useMutation<Document[], Error, File[]>({
    mutationFn: async (files) => {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      const res = await fetch(`${BASE}/agents/${agentId}/documents`, {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type — let the browser set multipart boundary
      })
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        throw new Error(`API ${res.status}: ${text}`)
      }
      return res.json() as Promise<Document[]>
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: docsKey(agentId) })
    },
  })
}

interface DeleteDocumentArgs {
  docId: string
}

// DELETE /api/v1/agents/:id/documents/:docId
export function useDeleteDocument(agentId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, DeleteDocumentArgs>({
    mutationFn: ({ docId }) =>
      apiFetch<void>(`/agents/${agentId}/documents/${docId}`, { method: 'DELETE' }),
    onSuccess: (_data, { docId }) => {
      // Instantly remove from cache so the UI doesn't flash the deleted document
      queryClient.setQueryData<DocumentListResponse>(docsKey(agentId), (old) =>
        old
          ? { items: old.items.filter((d) => d.id !== docId), total: old.total - 1 }
          : old,
      )
      void queryClient.invalidateQueries({ queryKey: docsKey(agentId) })
    },
  })
}
