// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Icon } from '../icons/Icon'
import { useEmbeddings } from '../../api/overview'

export interface EmbeddingsTabProps {
  agentId: string
  docId: string
}

const HEATMAP_CAP = 30

function interpolateColor(score: number): string {
  const s = Math.max(0, Math.min(1, score))
  if (s < 0.3) {
    const t = s / 0.3
    const r = Math.round(255 * t + 15 * (1 - t))
    const g = Math.round(243 * t + 15 * (1 - t))
    const b = Math.round(199 * t + 15 * (1 - t))
    return `rgba(${r},${g},${b},${0.15 + t * 0.4})`
  } else if (s < 0.6) {
    const t = (s - 0.3) / 0.3
    const r = Math.round(249 * t + 254 * (1 - t))
    const g = Math.round(115 * t + 243 * (1 - t))
    const b = Math.round(22 * t + 199 * (1 - t))
    return `rgba(${r},${g},${b},${0.55 + t * 0.25})`
  } else {
    const t = (s - 0.6) / 0.4
    const r = Math.round(220 * t + 249 * (1 - t))
    const g = Math.round(38 * t + 115 * (1 - t))
    const b = Math.round(38 * t + 22 * (1 - t))
    return `rgba(${r},${g},${b},${0.8 + t * 0.2})`
  }
}

function cellSize(n: number): string {
  const computed = Math.floor(320 / n)
  return `${Math.max(24, computed)}px`
}

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 'var(--r-lg)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        animation: 'pulse 1.6s ease-in-out infinite',
      }}
    />
  )
}

interface HeatmapTooltipState {
  visible: boolean
  x: number
  y: number
  rowIdx: number
  colIdx: number
  score: number
}

export function EmbeddingsTab({ agentId, docId }: EmbeddingsTabProps) {
  const { data, isLoading, isError, error } = useEmbeddings(agentId, docId)

  const [tooltip, setTooltip] = useState<HeatmapTooltipState>({
    visible: false,
    x: 0,
    y: 0,
    rowIdx: 0,
    colIdx: 0,
    score: 0,
  })

  const sectionStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: 13.5,
    fontWeight: 600,
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={sectionStyle}>
          <div style={sectionTitle}>
            <Icon name="cpu" size={14} />
            Chunk Embeddings (UMAP 2D Projection)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-faint)', fontSize: 13, marginBottom: 4 }}>
            <Icon name="loader" size={14} className="spin" />
            Computing UMAP projection — this may take 2–5 seconds…
          </div>
          <SkeletonBlock height={380} />
        </div>
        <div style={sectionStyle}>
          <div style={sectionTitle}>
            <Icon name="layers" size={14} />
            Chunk Similarity Heatmap
          </div>
          <SkeletonBlock height={280} />
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.45; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .spin { animation: spin .8s linear infinite; display: inline-block; }
        `}</style>
      </div>
    )
  }

  if (isError) {
    return (
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--danger-soft)',
          border: '1px solid rgba(239,68,68,.3)',
          borderRadius: 'var(--r-lg)',
          color: 'var(--danger)',
          fontSize: 13,
        }}
      >
        Failed to load embeddings: {(error as Error)?.message ?? 'Unknown error'}
      </div>
    )
  }

  if (!data) return null

  const scatter = data.scatter ?? []
  const heatmap = data.heatmap ?? []
  const labels = data.labels ?? []

  const n = heatmap.length
  const cappedN = Math.min(n, HEATMAP_CAP)
  const cappedHeatmap = heatmap.slice(0, cappedN).map((row) => row.slice(0, cappedN))
  const cappedLabels = labels.slice(0, cappedN)
  const cs = n > 0 ? cellSize(cappedN) : '24px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ===== Section 1 — UMAP Scatter ===== */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={sectionTitle}>
            <Icon name="cpu" size={14} />
            Chunk Embeddings (UMAP 2D Projection)
          </div>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              padding: '2px 8px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {scatter.length} points
          </span>
        </div>

        {scatter.length === 0 ? (
          <div
            style={{
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-faint)',
              fontSize: 13,
              background: 'var(--surface-2)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)',
            }}
          >
            UMAP projection unavailable (need ≥3 chunks)
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="x"
                type="number"
                tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                dataKey="y"
                type="number"
                tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={{ stroke: 'var(--border)' }}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null
                  const d = payload[0].payload as { chunk_index: number; label: string }
                  return (
                    <div
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        maxWidth: 240,
                        fontSize: 12,
                        boxShadow: 'var(--shadow-md)',
                      }}
                    >
                      <div style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Chunk #{d.chunk_index}</div>
                      <div style={{ color: 'var(--text)', lineHeight: 1.5 }}>{d.label}</div>
                    </div>
                  )
                }}
              />
              <Scatter data={scatter} fill="#f97316" opacity={0.75} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ===== Section 2 — Cosine Similarity Heatmap ===== */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={sectionTitle}>
            <Icon name="layers" size={14} />
            Chunk Similarity Heatmap
          </div>
          {n > HEATMAP_CAP && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--warn)',
                padding: '2px 8px',
                background: 'var(--warn-soft)',
                border: '1px solid rgba(245,158,11,.25)',
                borderRadius: 6,
              }}
            >
              showing first {HEATMAP_CAP} of {n}
            </span>
          )}
        </div>

        {cappedN === 0 ? (
          <div
            style={{
              padding: '30px 0',
              textAlign: 'center',
              color: 'var(--text-faint)',
              fontSize: 13,
              background: 'var(--surface-2)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)',
            }}
          >
            No heatmap data available
          </div>
        ) : (
          <div style={{ overflowX: 'auto', position: 'relative' }}>
            {/* Grid container */}
            <div
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                gap: 0,
              }}
            >
              {/* Top axis labels row */}
              <div style={{ display: 'flex', marginLeft: cs, gap: 0 }}>
                {cappedLabels.map((_lbl, ci) => (
                  <div
                    key={ci}
                    style={{
                      width: cs,
                      height: cs,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      fontSize: 9,
                      color: 'var(--text-faint)',
                      transform: 'rotate(-45deg)',
                      transformOrigin: 'bottom center',
                      paddingBottom: 2,
                      flexShrink: 0,
                      fontFamily: 'var(--font-mono)',
                      overflow: 'hidden',
                    }}
                    title={String(ci)}
                  >
                    {ci}
                  </div>
                ))}
              </div>

              {/* Data rows */}
              {cappedHeatmap.map((row, ri) => (
                <div key={ri} style={{ display: 'flex', gap: 0 }}>
                  {/* Left axis label */}
                  <div
                    style={{
                      width: cs,
                      height: cs,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 4,
                      fontSize: 9,
                      color: 'var(--text-faint)',
                      flexShrink: 0,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {ri}
                  </div>

                  {/* Heatmap cells */}
                  {row.map((score, ci) => (
                    <div
                      key={ci}
                      style={{
                        width: cs,
                        height: cs,
                        flexShrink: 0,
                        background: interpolateColor(score),
                        border: '1px solid rgba(0,0,0,.08)',
                        cursor: 'crosshair',
                      }}
                      onMouseEnter={(e) => {
                        const rect = (e.target as HTMLDivElement).getBoundingClientRect()
                        setTooltip({
                          visible: true,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8,
                          rowIdx: ri,
                          colIdx: ci,
                          score,
                        })
                      }}
                      onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Heatmap tooltip — fixed position */}
            {tooltip.visible && (
              <div
                style={{
                  position: 'fixed',
                  left: tooltip.x,
                  top: tooltip.y,
                  transform: 'translate(-50%, -100%)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 9999,
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                Chunk {tooltip.rowIdx} vs Chunk {tooltip.colIdx}:{' '}
                <strong style={{ color: 'var(--accent)' }}>{tooltip.score.toFixed(3)}</strong>
              </div>
            )}

            {/* Colour legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Low</span>
              <div
                style={{
                  width: 120,
                  height: 8,
                  borderRadius: 4,
                  background: 'linear-gradient(to right, rgba(15,15,15,0.15), #fef3c7, #f97316, #dc2626)',
                  border: '1px solid var(--border)',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>High</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .8s linear infinite; display: inline-block; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}
