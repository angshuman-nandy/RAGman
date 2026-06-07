// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

export interface Capabilities {
  cohere: boolean
  openai: boolean
  anthropic: boolean
  lite_mode: boolean
}

export function useCapabilities() {
  return useQuery<Capabilities>({
    queryKey: ['capabilities'],
    queryFn: () => apiFetch<Capabilities>('/capabilities'),
    staleTime: 5 * 60 * 1000,
  })
}
