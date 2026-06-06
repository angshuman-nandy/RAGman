// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState, useEffect } from 'react'
import { Icon } from '../icons/Icon'
import { useRerank } from '../../api/overview'
import { useCapabilities } from '../../api/capabilities'
import { PIPELINE_META } from '../../data/pipeline'
import type { Agent } from '../../types'

export interface RerankerTabProps {
  agentId: string
  docId: string
  agent: Agent
}

const RERANKER_TYPES = ['cohere', 'huggingface', 'llm'] as const
type RerankerTypeKey = (typeof RERANKER_TYPES)[number]

const RERANKER_LABELS: Record<RerankerTypeKey, string> = {
  cohere: 'Cohere',
  huggingface: 'HuggingFace',
  llm: 'LLM-based',
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (score / max) * 100)) : score * 100
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto', width: 110 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--accent)',
            borderRadius: 3,
            transition: 'width .3s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
        {score.toFixed(3)}
      </span>
    </div>
  )
}

function ResultList({
  results,
  label,
  color,
}: {
  results: Array<{ rank: number; content: string; score: number; metadata: Record<string, unknown> }>
  label: string
  color: string
}) {
  const maxScore = Math.max(...results.map((r) => r.score), 0)
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color,
          letterSpacing: '.04em',
          textTransform: 'uppercase',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      {results.map((r) => (
        <div
          key={r.rank}
          style={{
            padding: '8px 10px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                flexShrink: 0,
                minWidth: 24,
                height: 20,
                borderRadius: 5,
                background: 'var(--accent-soft)',
                border: '1px solid rgba(99,102,241,.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--accent)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              #{r.rank}
            </span>
            <ScoreBar score={r.score} max={maxScore} />
            {typeof r.metadata?.source === 'string' && (
              <span style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.metadata.source as string}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55, wordBreak: 'break-word' }}>
            {r.content.slice(0, 200)}{r.content.length > 200 ? '…' : ''}
          </p>
        </div>
      ))}
    </div>
  )
}

export function RerankerTab({ agentId, docId, agent }: RerankerTabProps) {
  const rerankerCfg = agent.pipeline.reranker
  const configuredType = rerankerCfg?.type ?? 'cohere'

  const [query, setQuery] = useState('')
  const [rerankerType, setRerankerType] = useState<RerankerTypeKey>(configuredType as RerankerTypeKey)
  const [topN, setTopN] = useState(rerankerCfg?.params?.top_n ?? 5)
  const [retrieverTopK, setRetrieverTopK] = useState(10)

  const { data: capabilities } = useCapabilities()
  const rerankMutation = useRerank(agentId, docId)

  const cohereDisabled = capabilities !== undefined && !capabilities.cohere

  // Once capabilities load, auto-switch away from Cohere if key is missing
  useEffect(() => {
    if (cohereDisabled && rerankerType === 'cohere') {
      setRerankerType('huggingface')
    }
  }, [cohereDisabled, rerankerType])

  const handleRun = () => {
    if (!query.trim()) return
    rerankMutation.mutate({
      query: query.trim(),
      reranker_type: rerankerType,
      top_n: topN,
      retriever_top_k: retrieverTopK,
    })
  }

  const opts = PIPELINE_META.reranker.options

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Config panel */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Reranker</div>

        {/* Reranker type selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RERANKER_TYPES.map((key) => {
            const isConfigured = key === configuredType
            const isSelected = key === rerankerType
            const keyMissing = key === 'cohere' && cohereDisabled
            return (
              <button
                key={key}
                type="button"
                aria-disabled={keyMissing || undefined}
                data-tooltip={keyMissing ? 'API KEY NOT CONFIGURED' : undefined}
                onClick={() => !keyMissing && setRerankerType(key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--r-md)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  background: isSelected ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: isSelected ? 'var(--accent)' : 'var(--text-dim)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: keyMissing ? 'not-allowed' : 'pointer',
                  opacity: keyMissing ? 0.42 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'border-color .15s, background .15s, color .15s',
                }}
              >
                {opts[key]?.label ?? RERANKER_LABELS[key]}
                {isConfigured && !keyMissing && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '0 4px',
                      borderRadius: 4,
                      background: 'rgba(99,102,241,.15)',
                      color: 'var(--accent)',
                      fontWeight: 600,
                    }}
                  >
                    configured
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Params row */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 80 }}>
            <label>Retrieve top K</label>
            <input
              type="number"
              value={retrieverTopK}
              min={1}
              max={30}
              onChange={(e) => setRetrieverTopK(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </div>
          <div className="field" style={{ minWidth: 80 }}>
            <label>Keep top N</label>
            <input
              type="number"
              value={topN}
              min={1}
              max={retrieverTopK}
              onChange={(e) => setTopN(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </div>
        </div>

        {/* Query + run */}
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            placeholder="Enter a query to test reranking…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            style={{ flex: 1 }}
          />
          <button
            className="btn primary"
            onClick={handleRun}
            disabled={!query.trim() || rerankMutation.isPending}
          >
            {rerankMutation.isPending ? (
              <>
                <Icon name="loader" size={14} className="spin" />
                Reranking…
              </>
            ) : (
              <>
                <Icon name="sparkles" size={14} />
                Run
              </>
            )}
          </button>
        </div>

        {rerankMutation.isError && (
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--danger-soft)',
              border: '1px solid rgba(239,68,68,.3)',
              borderRadius: 8,
              color: 'var(--danger)',
              fontSize: 13,
            }}
          >
            {rerankMutation.error.message}
          </div>
        )}
      </div>

      {/* Before / After comparison */}
      {rerankMutation.isSuccess && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <ResultList
            results={rerankMutation.data.before}
            label="Before reranking"
            color="var(--text-dim)"
          />
          <ResultList
            results={rerankMutation.data.after}
            label={`After — ${rerankMutation.data.reranker_type}`}
            color="var(--accent)"
          />
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .8s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}
