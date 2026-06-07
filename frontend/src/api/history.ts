// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { QueryHistoryListResponse } from '../types'

const historyKey = (agentId: string, page: number) =>
  ['agents', agentId, 'history', page] as const

const historyRootKey = (agentId: string) => ['agents', agentId, 'history'] as const

export function useHistory(agentId: string, page: number = 1, limit: number = 25) {
  return useQuery<QueryHistoryListResponse>({
    queryKey: historyKey(agentId, page),
    queryFn: () =>
      apiFetch<QueryHistoryListResponse>(
        `/agents/${agentId}/history?page=${page}&limit=${limit}`,
      ),
    enabled: Boolean(agentId),
    refetchOnMount: 'always',
  })
}

export function useDeleteHistoryEntry(agentId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { historyId: string }>({
    mutationFn: ({ historyId }) =>
      apiFetch<void>(`/agents/${agentId}/history/${historyId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: historyRootKey(agentId) })
    },
  })
}

export function useClearHistory(agentId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, void>({
    mutationFn: () =>
      apiFetch<void>(`/agents/${agentId}/history`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: historyRootKey(agentId) })
    },
  })
}
