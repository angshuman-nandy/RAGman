// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { PIPELINE_META } from '../../data/pipeline'
import type { PipelineConfig } from '../../types'

interface PipelineChipsProps {
  pipeline: PipelineConfig
  max?: number
}

export function PipelineChips({ pipeline, max = 5 }: PipelineChipsProps) {
  const all: { key: string; cls: string; label: string }[] = [
    {
      key: 'ingestion',
      cls: PIPELINE_META.ingestion.chipClass,
      label: PIPELINE_META.ingestion.options[pipeline.ingestion.type]?.label ?? pipeline.ingestion.type,
    },
    {
      key: 'chunking',
      cls: PIPELINE_META.chunking.chipClass,
      label: PIPELINE_META.chunking.options[pipeline.chunking.type]?.label ?? pipeline.chunking.type,
    },
    {
      key: 'embedding',
      cls: PIPELINE_META.embedding.chipClass,
      label: PIPELINE_META.embedding.options[pipeline.embedding.provider]?.label ?? pipeline.embedding.provider,
    },
    {
      key: 'vector_store',
      cls: PIPELINE_META.vector_store.chipClass,
      label: PIPELINE_META.vector_store.options[pipeline.vector_store.type]?.label ?? pipeline.vector_store.type,
    },
    {
      key: 'retriever',
      cls: PIPELINE_META.retriever.chipClass,
      label: PIPELINE_META.retriever.options[pipeline.retriever.type]?.label ?? pipeline.retriever.type,
    },
  ]

  if (pipeline.reranker) {
    all.push({
      key: 'reranker',
      cls: PIPELINE_META.reranker.chipClass,
      label: PIPELINE_META.reranker.options[pipeline.reranker.type]?.label ?? pipeline.reranker.type,
    })
  }

  all.push({
    key: 'llm',
    cls: PIPELINE_META.llm.chipClass,
    label: PIPELINE_META.llm.options[pipeline.llm.provider]?.label ?? pipeline.llm.provider,
  })

  const shown = all.slice(0, max)
  const hiddenCount = all.length - shown.length

  // Feature chips — always shown (not subject to the max slice) so users can
  // see at a glance whether an agent has a custom prompt or guardrails.
  const hasSystemPrompt = Boolean(pipeline.system_prompt?.content?.trim())
  const g = pipeline.guardrails
  const hasGuardrails = Boolean(
    g && (g.topic_restrictions || g.forbidden_content?.length || g.format_rules || (g.confidence_threshold ?? 0) > 0)
  )

  return (
    <>
      {shown.map((c) => (
        <span key={c.key} className={`chip ${c.cls}`}>
          <span className="dot" />
          {c.label}
        </span>
      ))}
      {hiddenCount > 0 && <span className="chip">+{hiddenCount}</span>}
      {hasSystemPrompt && (
        <span className="chip indigo">
          <span className="dot" />
          Custom prompt
        </span>
      )}
      {hasGuardrails && (
        <span className="chip rose">
          <span className="dot" />
          Guardrails
        </span>
      )}
    </>
  )
}
