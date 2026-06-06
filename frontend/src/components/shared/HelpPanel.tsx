// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useEffect } from 'react'

interface HelpPanelProps {
  open: boolean
  onClose: () => void
}

interface Section {
  icon: string
  title: string
  items: { label: string; desc: string }[]
}

const SECTIONS: Section[] = [
  {
    icon: '✂️',
    title: 'Chunking strategies',
    items: [
      { label: 'Fixed size', desc: 'Split by exact character count — fast, predictable.' },
      { label: 'Recursive', desc: 'Splits at paragraphs → sentences → words. Best default.' },
      { label: 'Semantic', desc: 'Groups text at meaning boundaries using embeddings.' },
      { label: 'Sentence window', desc: 'One sentence per chunk with surrounding context.' },
      { label: 'Document-aware', desc: 'Respects doc structure: Markdown headers, PDF page boundaries, DOCX paragraphs.' },
    ],
  },
  {
    icon: '🔍',
    title: 'Retrieval strategies',
    items: [
      { label: 'Similarity search', desc: 'Fast cosine similarity over your vector store.' },
      { label: 'MMR', desc: 'Balances relevance with diversity — avoids redundant chunks.' },
      { label: 'Hybrid BM25 + Vector', desc: 'Keyword + semantic search combined. Usually wins.' },
      { label: 'Multi-query', desc: 'Generates multiple query variants to improve recall.' },
    ],
  },
  {
    icon: '⚡',
    title: 'Reranking',
    items: [
      { label: 'Cohere Rerank', desc: 'Cloud API — great accuracy, requires key.' },
      { label: 'HuggingFace cross-encoder', desc: 'Runs locally, no API key needed.' },
      { label: 'LLM-based', desc: 'Uses your chosen LLM to score and reorder results.' },
    ],
  },
  {
    icon: '🧠',
    title: 'Prompting & guardrails',
    items: [
      { label: 'System prompt', desc: 'Append to or fully replace the default RAG prompt per agent.' },
      { label: 'Topic restrictions', desc: 'Instruct the agent to stay within defined subject areas.' },
      { label: 'Forbidden content', desc: 'Tag words or phrases the agent should never output.' },
      { label: 'Confidence threshold', desc: 'Suppress answers below a retrieval score cutoff.' },
    ],
  },
]

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="help-panel"
        role="dialog"
        aria-modal="true"
        aria-label="RAGman help"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="help-header">
          <div>
            <div className="help-title">What is RAGman?</div>
            <div className="help-subtitle">
              A local-first experiment lab for building document Q&amp;A agents.
              Compose a pipeline, ingest your docs, then iterate until the answers are exactly right.
            </div>
          </div>
          <button className="navbar-icon-btn" onClick={onClose} aria-label="Close help">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tip banner */}
        <div className="help-tip">
          <span>💡</span>
          <span>
            The real power: create multiple agents with the same docs but different pipeline configs,
            then compare their answers side-by-side to find what works best for your content.
          </span>
        </div>

        {/* Sections */}
        <div className="help-sections">
          {SECTIONS.map((sec) => (
            <div key={sec.title} className="help-section">
              <div className="help-section-title">
                <span>{sec.icon}</span>
                <span>{sec.title}</span>
              </div>
              <div className="help-items">
                {sec.items.map((item) => (
                  <div key={item.label} className="help-item">
                    <span className="help-item-label">{item.label}</span>
                    <span className="help-item-desc">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="help-footer">
          Each agent is fully independent — swap any stage, re-ingest, and ask the same question again.
        </div>
      </div>
    </div>
  )
}
