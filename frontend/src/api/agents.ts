// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { Agent, AgentListResponse, PipelineConfig } from '../types'

// Query keys
const AGENTS_KEY = ['agents'] as const
const agentKey = (id: string) => ['agents', id] as const

// GET /api/v1/agents?skip=0&limit=100
export function useAgents() {
  return useQuery<AgentListResponse>({
    queryKey: AGENTS_KEY,
    queryFn: () => apiFetch<AgentListResponse>('/agents?skip=0&limit=100'),
    refetchOnMount: 'always',
  })
}

// GET /api/v1/agents/:id
export function useAgent(id: string) {
  return useQuery<Agent>({
    queryKey: agentKey(id),
    queryFn: () => apiFetch<Agent>(`/agents/${id}`),
    enabled: Boolean(id),
  })
}

interface CreateAgentPayload {
  name: string
  description?: string | null
  pipeline: PipelineConfig
}

// POST /api/v1/agents
export function useCreateAgent() {
  const queryClient = useQueryClient()
  return useMutation<Agent, Error, CreateAgentPayload>({
    mutationFn: (payload) =>
      apiFetch<Agent>('/agents', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AGENTS_KEY })
    },
  })
}

interface UpdateAgentPayload {
  id: string
  name?: string
  description?: string | null
  pipeline?: PipelineConfig
}

// PUT /api/v1/agents/:id
export function useUpdateAgent() {
  const queryClient = useQueryClient()
  return useMutation<Agent, Error, UpdateAgentPayload>({
    mutationFn: ({ id, ...payload }) =>
      apiFetch<Agent>(`/agents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(agentKey(data.id), data)
      void queryClient.invalidateQueries({ queryKey: AGENTS_KEY })
    },
  })
}

// DELETE /api/v1/agents/:id
export function useDeleteAgent() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetch<void>(`/agents/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: agentKey(id) })
      // Instantly remove from cache so the UI doesn't flash the deleted agent
      queryClient.setQueryData<AgentListResponse>(AGENTS_KEY, (old) =>
        old
          ? { items: old.items.filter((a) => a.id !== id), total: old.total - 1 }
          : old,
      )
      void queryClient.invalidateQueries({ queryKey: AGENTS_KEY })
    },
  })
}
