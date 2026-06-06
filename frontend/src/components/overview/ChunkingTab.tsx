// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '../icons/Icon'
import { useDocumentChunks, useRechunk, useReprocessDocument } from '../../api/overview'
import type { ChunkOverview } from '../../types'

export interface ChunkingTabProps {
  agentId: string
  docId: string
}

type Strategy = 'fixed_size' | 'recursive' | 'semantic' | 'sentence_window' | 'doc_aware'

interface StrategyParams {
  chunk_size: number
  chunk_overlap: number
  similarity_threshold: number
  window_size: number
}

const DEFAULT_PARAMS: StrategyParams = {
  chunk_size: 500,
  chunk_overlap: 50,
  similarity_threshold: 0.8,
  window_size: 3,
}

const STRATEGIES: { key: Strategy; label: string }[] = [
  { key: 'fixed_size', label: 'Fixed Size' },
  { key: 'recursive', label: 'Recursive' },
  { key: 'semantic', label: 'Semantic' },
  { key: 'sentence_window', label: 'Sentence Window' },
  { key: 'doc_aware', label: 'Document-aware' },
]

const PREVIEW_CHARS = 120

function chunkColor(charCount: number): string {
  if (charCount < 200) return 'var(--accent-soft)'
  if (charCount < 600) return 'var(--warn-soft)'
  return 'var(--danger-soft)'
}

function chunkBorderColor(charCount: number): string {
  if (charCount < 200) return 'rgba(99,102,241,.25)'
  if (charCount < 600) return 'rgba(245,158,11,.25)'
  return 'rgba(239,68,68,.25)'
}

interface ChunkCardProps {
  chunk: ChunkOverview | { index: number; content: string; char_count: number }
  isExpanded: boolean
  onToggle: () => void
}

function ChunkCard({ chunk, isExpanded, onToggle }: ChunkCardProps) {
  const needsTruncation = chunk.content.length > PREVIEW_CHARS
  const displayContent = isExpanded ? chunk.content : chunk.content.slice(0, PREVIEW_CHARS)

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 'var(--r-md)',
        background: chunkColor(chunk.char_count),
        border: `1px solid ${chunkBorderColor(chunk.char_count)}`,
        fontSize: 12.5,
        lineHeight: 1.5,
        cursor: 'pointer',
        transition: 'opacity .12s',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = '0.85')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = '1')}
    >
      {/* Index badge */}
      <span
        style={{
          flexShrink: 0,
          minWidth: 22,
          height: 22,
          borderRadius: 6,
          background: 'rgba(0,0,0,.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {chunk.index}
      </span>

      {/* Content */}
      <span style={{ flex: 1, color: 'var(--text)', wordBreak: 'break-word' }}>
        {displayContent}
        {!isExpanded && needsTruncation && <span style={{ color: 'var(--text-faint)' }}>…</span>}
        {needsTruncation && (
          <span
            style={{
              display: 'block',
              marginTop: 4,
              fontSize: 11,
              color: 'var(--accent)',
              fontWeight: 500,
            }}
          >
            {isExpanded ? '↑ collapse' : `↓ show all ${chunk.char_count} chars`}
          </span>
        )}
      </span>

      {/* Char count chip */}
      <span
        style={{
          flexShrink: 0,
          fontSize: 11,
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-mono)',
          paddingTop: 2,
        }}
      >
        {chunk.char_count}c
      </span>
    </div>
  )
}

export function ChunkingTab({ agentId, docId }: ChunkingTabProps) {
  const { data, isLoading } = useDocumentChunks(agentId, docId)
  const rechunkMutation = useRechunk(agentId, docId)
  const reprocessMutation = useReprocessDocument(agentId, docId)
  const queryClient = useQueryClient()

  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>('fixed_size')
  const [params, setParams] = useState<StrategyParams>({ ...DEFAULT_PARAMS })

  // Expanded state — separate sets for left and right panels
  const [leftExpanded, setLeftExpanded] = useState<Set<number>>(new Set())
  const [rightExpanded, setRightExpanded] = useState<Set<number>>(new Set())

  // "Agent updated" confirmation flash
  const [applySuccess, setApplySuccess] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  // Auto-dismiss success flash after 2s
  useEffect(() => {
    if (!applySuccess) return
    const t = setTimeout(() => setApplySuccess(false), 2000)
    return () => clearTimeout(t)
  }, [applySuccess])

  const currentStrategy = (data?.chunks[0]?.metadata?.strategy as string | undefined) ?? '—'
  const chunks = data?.chunks ?? []

  function toggleLeft(index: number) {
    setLeftExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function toggleRight(index: number) {
    setRightExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleRunPreview = async () => {
    let mutationParams: Record<string, number> = {}
    if (selectedStrategy === 'fixed_size' || selectedStrategy === 'recursive' || selectedStrategy === 'doc_aware') {
      mutationParams = { chunk_size: params.chunk_size, chunk_overlap: params.chunk_overlap }
    } else if (selectedStrategy === 'semantic') {
      mutationParams = { similarity_threshold: params.similarity_threshold }
    } else if (selectedStrategy === 'sentence_window') {
      mutationParams = { window_size: params.window_size }
    }
    setRightExpanded(new Set())
    try {
      await rechunkMutation.mutateAsync({ strategy: selectedStrategy, params: mutationParams })
    } catch {
      // error shown in UI
    }
  }

  const handleApply = async () => {
    setApplyError(null)
    let mutationParams: Record<string, number> = {}
    if (selectedStrategy === 'fixed_size' || selectedStrategy === 'recursive' || selectedStrategy === 'doc_aware') {
      mutationParams = { chunk_size: params.chunk_size, chunk_overlap: params.chunk_overlap }
    } else if (selectedStrategy === 'semantic') {
      mutationParams = { similarity_threshold: params.similarity_threshold }
    } else if (selectedStrategy === 'sentence_window') {
      mutationParams = { window_size: params.window_size }
    }
    try {
      await reprocessMutation.mutateAsync({
        chunking: { type: selectedStrategy, params: mutationParams },
      })
      await queryClient.invalidateQueries({ queryKey: ['doc-chunks', agentId, docId] })
      setApplySuccess(true)
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to reprocess document')
    }
  }

  const previewChunks = rechunkMutation.data?.chunks ?? []
  const previewTotal = rechunkMutation.data?.total ?? 0
  const currentTotal = data?.total ?? 0

  const diffCount = previewTotal - currentTotal
  const hasDiff = rechunkMutation.isSuccess && diffCount !== 0

  const strategyLabel = STRATEGIES.find((s) => s.key === selectedStrategy)?.label ?? selectedStrategy

  const panelStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      {/* ===== Left panel — Current chunks ===== */}
      <div style={{ ...panelStyle, minWidth: 280, maxWidth: '100%', flex: '1 1 300px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={sectionTitle}>
            <Icon name="scissors" size={14} />
            Current Chunks
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {currentStrategy !== '—' && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'var(--accent-soft)',
                  border: '1px solid rgba(99,102,241,.25)',
                  fontSize: 11,
                  color: 'var(--accent)',
                  fontWeight: 600,
                }}
              >
                {currentStrategy}
              </span>
            )}
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 6,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                fontSize: 11,
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {isLoading ? '…' : currentTotal}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-faint)', fontSize: 13 }}>
            <Icon name="loader" size={14} className="spin" />
            Loading chunks…
          </div>
        ) : chunks.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            No chunks available
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
            {chunks.map((chunk) => (
              <ChunkCard
                key={chunk.index}
                chunk={chunk}
                isExpanded={leftExpanded.has(chunk.index)}
                onToggle={() => toggleLeft(chunk.index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ===== Right panel — Preview ===== */}
      <div style={{ ...panelStyle, minWidth: 280, flex: '1 1 320px' }}>
        {/* Header with diff badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={sectionTitle}>
            <Icon name="layers" size={14} />
            Preview with Different Strategy
          </span>
          {rechunkMutation.isSuccess && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 6,
                background: diffCount > 0 ? 'var(--success-soft)' : diffCount < 0 ? 'var(--danger-soft)' : 'var(--surface-2)',
                border: `1px solid ${diffCount > 0 ? 'rgba(34,197,94,.3)' : diffCount < 0 ? 'rgba(239,68,68,.3)' : 'var(--border)'}`,
                fontSize: 11,
                fontWeight: 600,
                color: diffCount > 0 ? 'var(--success)' : diffCount < 0 ? 'var(--danger)' : 'var(--text-dim)',
              }}
            >
              {hasDiff
                ? diffCount > 0
                  ? `+${diffCount} chunks`
                  : `${diffCount} chunks`
                : 'same count'}
            </span>
          )}
        </div>

        {/* Strategy radio cards — 2×2 grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          {STRATEGIES.map(({ key, label }) => {
            const isCurrent = key === currentStrategy
            const isSelected = key === selectedStrategy
            return (
              <label
                key={key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  padding: '9px 11px',
                  borderRadius: 'var(--r-md)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  background: isSelected ? 'var(--accent-soft)' : 'var(--surface-2)',
                  cursor: 'pointer',
                  transition: 'border-color .15s, background .15s',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="strategy"
                    value={key}
                    checked={isSelected}
                    onChange={() => {
                      setSelectedStrategy(key)
                      rechunkMutation.reset()
                    }}
                    style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', flex: 1 }}>{label}</span>
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        border: '1px solid rgba(99,102,241,.3)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      current
                    </span>
                  )}
                </div>
              </label>
            )
          })}
        </div>

        {/* Conditional params */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(selectedStrategy === 'fixed_size' || selectedStrategy === 'recursive' || selectedStrategy === 'doc_aware') && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Chunk Size</label>
                  <input
                    type="number"
                    value={params.chunk_size}
                    min={50}
                    max={4096}
                    onChange={(e) => setParams((p) => ({ ...p, chunk_size: Number(e.target.value) }))}
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Overlap</label>
                  <input
                    type="number"
                    value={params.chunk_overlap}
                    min={0}
                    max={500}
                    onChange={(e) => setParams((p) => ({ ...p, chunk_overlap: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </>
          )}

          {selectedStrategy === 'semantic' && (
            <div className="field">
              <label>Similarity Threshold (0–1)</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={params.similarity_threshold}
                onChange={(e) => setParams((p) => ({ ...p, similarity_threshold: Number(e.target.value) }))}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{params.similarity_threshold.toFixed(2)}</span>
            </div>
          )}

          {selectedStrategy === 'sentence_window' && (
            <div className="field">
              <label>Window Size</label>
              <input
                type="number"
                value={params.window_size}
                min={1}
                max={20}
                onChange={(e) => setParams((p) => ({ ...p, window_size: Number(e.target.value) }))}
              />
            </div>
          )}
        </div>

        {/* Run Preview button */}
        <button
          className="btn primary"
          onClick={handleRunPreview}
          disabled={rechunkMutation.isPending}
          style={{ alignSelf: 'flex-start' }}
        >
          {rechunkMutation.isPending ? (
            <>
              <Icon name="loader" size={14} className="spin" />
              Running…
            </>
          ) : (
            <>
              <Icon name="sparkles" size={14} />
              Run Preview
            </>
          )}
        </button>

        {/* Error from rechunk */}
        {rechunkMutation.isError && (
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
            {rechunkMutation.error?.message ?? 'Preview failed'}
          </div>
        )}

        {/* Preview result chunks */}
        {rechunkMutation.isSuccess && previewChunks.length > 0 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 2 }}>
                {previewTotal} chunks · strategy:{' '}
                <span style={{ color: 'var(--accent)' }}>{rechunkMutation.data.strategy}</span>
              </div>
              {previewChunks.map((chunk) => (
                <ChunkCard
                  key={chunk.index}
                  chunk={chunk}
                  isExpanded={rightExpanded.has(chunk.index)}
                  onToggle={() => toggleRight(chunk.index)}
                />
              ))}
            </div>

            {/* Apply button + feedback */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
              <button
                className="btn primary"
                onClick={handleApply}
                disabled={reprocessMutation.isPending}
                style={{ alignSelf: 'flex-start' }}
              >
                {reprocessMutation.isPending ? (
                  <>
                    <Icon name="loader" size={14} className="spin" />
                    Applying…
                  </>
                ) : (
                  <>
                    <Icon name="check" size={14} />
                    Reprocess — re-ingest with {strategyLabel} chunking
                  </>
                )}
              </button>

              {applySuccess && (
                <span
                  style={{
                    fontSize: 12.5,
                    color: 'var(--success)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    animation: 'fadeOut 2s forwards',
                  }}
                >
                  ✓ Reprocessing started
                </span>
              )}

              {applyError && (
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
                  {applyError}
                </div>
              )}
            </div>
          </>
        )}

        {rechunkMutation.isSuccess && previewChunks.length === 0 && (
          <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
            No preview chunks returned
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 760px) {
          .chunking-panels { flex-direction: column !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .8s linear infinite; display: inline-block; }
        @keyframes fadeOut {
          0%   { opacity: 1; }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
