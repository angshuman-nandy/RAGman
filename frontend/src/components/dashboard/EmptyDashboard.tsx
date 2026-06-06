// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { Icon } from '../icons/Icon'

interface EmptyDashboardProps {
  onCreate: () => void
}

export function EmptyDashboard({ onCreate }: EmptyDashboardProps) {
  return (
    <div className="empty-state">
      <div className="empty-illustration">
        <Icon name="bot" size={44} strokeWidth={1.5} />
      </div>
      <h3>No agents yet</h3>
      <p>
        Your local RAG experiment lab. Build a pipeline, ingest your docs, then
        iterate — swap chunking strategies, try different retrievers, add reranking,
        tune system prompts, and lock in guardrails. No code. Just results.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
        <span className="empty-tag">Recursive · Semantic · Sentence Window</span>
        <span className="empty-tag">Hybrid BM25 · MMR · Multi-query</span>
        <span className="empty-tag">System Prompts · Guardrails</span>
      </div>
      <button className="btn primary lg" onClick={onCreate} style={{ marginTop: 8 }}>
        <Icon name="plus" size={16} /> Build your first agent
      </button>
    </div>
  )
}
