// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState, useMemo } from 'react'
import { useDocumentChunks } from '../../api/overview'

interface ChunksTabProps {
  agentId: string
  docId: string
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: '16px 18px',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        animation: 'skeletonPulse 1.6s ease-in-out infinite',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--surface-3)',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 12, background: 'var(--surface-3)', borderRadius: 6, width: '90%' }} />
        <div style={{ height: 12, background: 'var(--surface-3)', borderRadius: 6, width: '75%' }} />
        <div style={{ height: 12, background: 'var(--surface-3)', borderRadius: 6, width: '55%' }} />
      </div>
    </div>
  )
}

export function ChunksTab({ agentId, docId }: ChunksTabProps) {
  const { data, isLoading } = useDocumentChunks(agentId, docId)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const chunks = data?.chunks ?? []
  const total = data?.total ?? 0

  const avgChars = useMemo(() => {
    if (chunks.length === 0) return 0
    const sum = chunks.reduce((acc, c) => acc + c.char_count, 0)
    return Math.round(sum / chunks.length)
  }, [chunks])

  const filtered = useMemo(() => {
    if (!search.trim()) return chunks
    const q = search.toLowerCase()
    return chunks.filter((c) => c.content.toLowerCase().includes(q))
  }, [chunks, search])

  function toggleExpanded(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (chunks.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '60px 24px',
          color: 'var(--text-faint)',
          fontSize: 14,
          background: 'var(--surface)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--r-xl)',
        }}
      >
        No chunks found — document may still be ingesting.
      </div>
    )
  }

  return (
    <div>
      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--text-dim)',
        }}
      >
        <span
          style={{
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent-ring)',
            borderRadius: 7,
            padding: '2px 10px',
            fontWeight: 600,
            fontSize: 12.5,
          }}
        >
          {total} chunks
        </span>
        <span style={{ color: 'var(--text-faint)' }}>·</span>
        <span>avg {avgChars} chars</span>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 18 }}>
        <input
          type="text"
          placeholder="Search chunks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* Chunk list */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 24px',
            color: 'var(--text-faint)',
            fontSize: 13.5,
          }}
        >
          No chunks match your search.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((chunk) => {
            const isExpanded = expanded.has(chunk.index)
            const preview = isExpanded ? chunk.content : chunk.content.slice(0, 200)
            const needsTruncation = chunk.content.length > 200
            const pageNum = chunk.metadata?.page_number as number | undefined

            return (
              <div
                key={chunk.index}
                onClick={() => toggleExpanded(chunk.index)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)',
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  transition: 'border-color .15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)')}
              >
                {/* Index badge */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent-ring)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  #{chunk.index}
                </div>

                {/* Content area */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      color: 'var(--text)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {preview}
                    {!isExpanded && needsTruncation && (
                      <span style={{ color: 'var(--text-faint)' }}>…</span>
                    )}
                  </p>
                  {needsTruncation && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 6,
                        fontSize: 11.5,
                        color: 'var(--accent)',
                        fontWeight: 500,
                      }}
                    >
                      {isExpanded ? '↑ collapse' : `↓ show all ${chunk.char_count} chars`}
                    </span>
                  )}
                </div>

                {/* Right meta chips */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <span className="chip" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {chunk.char_count} chars
                  </span>
                  {pageNum !== undefined && (
                    <span className="chip indigo">
                      p. {pageNum}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Skeleton pulse keyframes (injected once) */}
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}
