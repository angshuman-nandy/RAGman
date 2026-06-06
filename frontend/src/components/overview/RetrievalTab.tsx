// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Icon } from '../icons/Icon'
import { useRetrieve } from '../../api/overview'
import type { RetrievalResponse } from '../../types'

const STRATEGY_COLORS: Record<string, string> = {
  similarity:  '#818cf8',
  mmr:         '#22c55e',
  hybrid:      '#f97316',
  multi_query: '#a78bfa',
}

export interface RetrievalTabProps {
  agentId: string
  docId: string
}

type StrategyKey = 'similarity' | 'mmr' | 'hybrid' | 'multi_query'

const STRATEGY_LABELS: Record<StrategyKey, string> = {
  similarity: 'Similarity',
  mmr: 'MMR',
  hybrid: 'Hybrid',
  multi_query: 'Multi-Query',
}

const ALL_STRATEGIES: StrategyKey[] = ['similarity', 'mmr', 'hybrid', 'multi_query']

type DefaultParams = Record<StrategyKey, Record<string, number>>

const INITIAL_PARAMS: DefaultParams = {
  similarity: { top_k: 5 },
  mmr: { top_k: 5, lambda_mult: 0.5 },
  hybrid: { top_k: 5, bm25_weight: 0.3 },
  multi_query: { top_k: 5, num_queries: 3 },
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score * 100))
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: '0 0 auto',
        width: 120,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: 'var(--border)',
          overflow: 'hidden',
        }}
      >
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

function MetaPill({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: '1px 6px',
        borderRadius: 5,
        background: 'var(--surface-3)',
        border: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-faint)',
        display: 'inline-block',
      }}
    >
      {label}
    </span>
  )
}

function sliderStyle(value: number, min: number, max: number): React.CSSProperties {
  const pct = ((value - min) / (max - min)) * 100
  return {
    accentColor: 'var(--accent)',
    background: `linear-gradient(to right, var(--accent) ${pct}%, var(--border) ${pct}%)`,
    borderRadius: 4,
    height: 4,
    width: '100%',
    cursor: 'pointer',
  }
}

export function RetrievalTab({ agentId, docId }: RetrievalTabProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<StrategyKey>>(new Set(ALL_STRATEGIES))
  const [params, setParams] = useState<DefaultParams>({ ...INITIAL_PARAMS })
  const [results, setResults] = useState<Record<string, RetrievalResponse | null>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [activeTab, setActiveTab] = useState<StrategyKey>('similarity')

  const retrieveMutation = useRetrieve(agentId, docId)

  const toggleStrategy = (key: StrategyKey) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const setParam = (strategy: StrategyKey, field: string, value: number) => {
    setParams((p) => ({
      ...p,
      [strategy]: { ...p[strategy], [field]: value },
    }))
  }

  const handleSearch = async () => {
    if (!query.trim()) return

    const strategies = Array.from(selected)

    // Mark all as loading
    const loadingState: Record<string, boolean> = {}
    strategies.forEach((s) => (loadingState[s] = true))
    setLoading(loadingState)
    setErrors({})

    // Ensure active tab is one of the selected strategies
    if (!selected.has(activeTab)) {
      setActiveTab(strategies[0])
    }

    // Fire all in parallel
    const settled = await Promise.allSettled(
      strategies.map((strategy) =>
        retrieveMutation
          .mutateAsync({ query: query.trim(), strategy, params: params[strategy] })
          .then((res) => ({ strategy, res }))
          .catch((err: Error) => ({ strategy, err })),
      ),
    )

    const nextResults: Record<string, RetrievalResponse | null> = {}
    const nextErrors: Record<string, string | null> = {}
    const nextLoading: Record<string, boolean> = {}

    settled.forEach((item) => {
      if (item.status === 'fulfilled') {
        const val = item.value as { strategy: string; res?: RetrievalResponse; err?: Error }
        nextLoading[val.strategy] = false
        if (val.err) {
          nextErrors[val.strategy] = val.err.message
          nextResults[val.strategy] = null
        } else {
          nextResults[val.strategy] = val.res ?? null
          nextErrors[val.strategy] = null
        }
      }
    })

    setResults(nextResults)
    setLoading(nextLoading)
    setErrors(nextErrors)
  }

  const selectedStrategies = ALL_STRATEGIES.filter((s) => selected.has(s))

  const activeResults = results[activeTab]
  const activeLoading = loading[activeTab] ?? false
  const activeError = errors[activeTab] ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ===== Query bar ===== */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: 14,
        }}
      >
        <input
          type="text"
          placeholder="Enter a query to test retrieval…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1 }}
        />
        <button
          className="btn primary"
          onClick={handleSearch}
          disabled={!query.trim() || Object.values(loading).some(Boolean)}
        >
          {Object.values(loading).some(Boolean) ? (
            <>
              <Icon name="loader" size={14} className="spin" />
              Searching…
            </>
          ) : (
            <>
              <Icon name="search" size={14} />
              Search
            </>
          )}
        </button>
      </div>

      {/* ===== Strategy selector with params ===== */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Strategies</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ALL_STRATEGIES.map((key) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 'var(--r-md)',
                border: `1px solid ${selected.has(key) ? 'var(--accent)' : 'var(--border)'}`,
                background: selected.has(key) ? 'var(--accent-soft)' : 'var(--surface-2)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: selected.has(key) ? 'var(--accent)' : 'var(--text-dim)',
                userSelect: 'none',
                transition: 'border-color .15s, background .15s, color .15s',
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(key)}
                onChange={() => toggleStrategy(key)}
                style={{ accentColor: 'var(--accent)' }}
              />
              {STRATEGY_LABELS[key]}
            </label>
          ))}
        </div>

        {/* Collapsible params per selected strategy */}
        {selectedStrategies.map((key) => (
          <div
            key={key}
            style={{
              padding: '10px 12px',
              background: 'var(--surface-2)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {STRATEGY_LABELS[key]} params
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* top_k — all strategies */}
              <div className="field" style={{ minWidth: 80 }}>
                <label>Top K</label>
                <input
                  type="number"
                  value={params[key].top_k}
                  min={1}
                  max={20}
                  onChange={(e) => setParam(key, 'top_k', Number(e.target.value))}
                  style={{ width: 80 }}
                />
                <div style={{ color: 'var(--text-faint)', fontSize: 11.5, lineHeight: 1.4, marginTop: 3 }}>
                  Number of chunks to return. Higher = more context but slower generation.
                </div>
              </div>

              {/* mmr: lambda_mult */}
              {key === 'mmr' && (
                <div className="field" style={{ minWidth: 140 }}>
                  <label>Lambda Mult ({params.mmr.lambda_mult.toFixed(2)})</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={params.mmr.lambda_mult}
                    onChange={(e) => setParam('mmr', 'lambda_mult', Number(e.target.value))}
                    style={sliderStyle(params.mmr.lambda_mult, 0, 1)}
                  />
                  <div style={{ color: 'var(--text-faint)', fontSize: 11.5, lineHeight: 1.4, marginTop: 3 }}>
                    Diversity vs relevance trade-off. 0 = maximum diversity, 1 = pure relevance. 0.5 balances both.
                  </div>
                </div>
              )}

              {/* hybrid: bm25_weight */}
              {key === 'hybrid' && (
                <div className="field" style={{ minWidth: 140 }}>
                  <label>BM25 Weight ({params.hybrid.bm25_weight.toFixed(2)})</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={params.hybrid.bm25_weight}
                    onChange={(e) => setParam('hybrid', 'bm25_weight', Number(e.target.value))}
                    style={sliderStyle(params.hybrid.bm25_weight, 0, 1)}
                  />
                  <div style={{ color: 'var(--text-faint)', fontSize: 11.5, lineHeight: 1.4, marginTop: 3 }}>
                    Balance between keyword (BM25) and semantic search. 0 = pure semantic, 1 = pure keyword. 0.3 is a good default.
                  </div>
                </div>
              )}

              {/* multi_query: num_queries */}
              {key === 'multi_query' && (
                <div className="field" style={{ minWidth: 80 }}>
                  <label>Num Queries</label>
                  <input
                    type="number"
                    value={params.multi_query.num_queries}
                    min={1}
                    max={10}
                    onChange={(e) => setParam('multi_query', 'num_queries', Number(e.target.value))}
                    style={{ width: 80 }}
                  />
                  <div style={{ color: 'var(--text-faint)', fontSize: 11.5, lineHeight: 1.4, marginTop: 3 }}>
                    How many query variants to generate. More variants find more diverse chunks but takes longer.
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ===== Results ===== */}
      {Object.keys(results).length > 0 || Object.values(loading).some(Boolean) ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Result tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              overflowX: 'auto',
            }}
          >
            {selectedStrategies.map((key) => {
              const res = results[key]
              const count = res?.results.length ?? 0
              const isLoading = loading[key]
              const isActive = key === activeTab
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                    background: 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'color .15s, border-color .15s',
                  }}
                >
                  {isLoading && <Icon name="loader" size={12} className="spin" />}
                  {STRATEGY_LABELS[key]}
                  {!isLoading && res && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 5,
                        background: isActive ? 'var(--accent-soft)' : 'var(--surface-2)',
                        border: `1px solid ${isActive ? 'rgba(99,102,241,.3)' : 'var(--border)'}`,
                        fontSize: 11,
                        color: isActive ? 'var(--accent)' : 'var(--text-faint)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Active tab content */}
          <div style={{ padding: 14, minHeight: 80 }}>
            {activeLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-faint)', fontSize: 13 }}>
                <Icon name="loader" size={14} className="spin" />
                Retrieving with {STRATEGY_LABELS[activeTab]}…
              </div>
            ) : activeError ? (
              <div
                style={{
                  padding: '10px 12px',
                  background: 'var(--danger-soft)',
                  border: '1px solid rgba(239,68,68,.3)',
                  borderRadius: 8,
                  color: 'var(--danger)',
                  fontSize: 13,
                }}
              >
                {activeError}
              </div>
            ) : activeResults && activeResults.results.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeResults.results.map((result) => {
                  const sourceMeta = [
                    result.metadata.source as string | undefined,
                    result.metadata.page != null ? `p.${result.metadata.page}` : undefined,
                  ].filter(Boolean)

                  return (
                    <div
                      key={result.rank}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {/* Rank + score */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            flexShrink: 0,
                            minWidth: 28,
                            height: 22,
                            borderRadius: 6,
                            background: 'var(--accent-soft)',
                            border: '1px solid rgba(99,102,241,.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--accent)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          #{result.rank}
                        </span>
                        <ScoreBar score={result.score} />
                        {sourceMeta.length > 0 && (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {sourceMeta.map((m, i) => (
                              <MetaPill key={i} label={m!} />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: 'var(--text)',
                          lineHeight: 1.6,
                          wordBreak: 'break-word',
                        }}
                      >
                        {result.content}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : activeResults && activeResults.results.length === 0 ? (
              <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
                No results returned for this query
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ===== Score scatter chart ===== */}
      {selectedStrategies.some((s) => results[s]?.results.length) && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: '16px 14px 10px',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            Score vs Rank — strategy comparison
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 4, right: 20, bottom: 36, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="rank"
                type="number"
                name="Rank"
                label={{ value: 'Rank', position: 'insideBottom', offset: -12, fill: 'var(--text-faint)', fontSize: 11 }}
                tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
                allowDecimals={false}
                domain={[1, 'dataMax']}
              />
              <YAxis
                dataKey="score"
                type="number"
                name="Score"
                domain={[0, 1]}
                tickFormatter={(v: number) => v.toFixed(2)}
                tick={{ fill: 'var(--text-faint)', fontSize: 11 }}
                label={{ value: 'Score', angle: -90, position: 'insideLeft', offset: 12, fill: 'var(--text-faint)', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload as { rank: number; score: number; content: string; strategy: string }
                  return (
                    <div style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      maxWidth: 260,
                      fontSize: 12,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
                        <span style={{ color: STRATEGY_COLORS[d.strategy] ?? 'var(--accent)', fontWeight: 600 }}>
                          {STRATEGY_LABELS[d.strategy as StrategyKey] ?? d.strategy}
                        </span>
                        <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                          #{d.rank} · {d.score.toFixed(3)}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                        {d.content.slice(0, 120)}{d.content.length > 120 ? '…' : ''}
                      </div>
                    </div>
                  )
                }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                formatter={(value) => (
                  <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                    {STRATEGY_LABELS[value as StrategyKey] ?? value}
                  </span>
                )}
              />
              {selectedStrategies.map((key) => {
                const res = results[key]
                if (!res?.results.length) return null
                const data = res.results.map((r) => ({
                  rank: r.rank,
                  score: r.score,
                  content: r.content,
                  strategy: key,
                }))
                return (
                  <Scatter
                    key={key}
                    name={key}
                    data={data}
                    fill={STRATEGY_COLORS[key] ?? 'var(--accent)'}
                    opacity={0.85}
                    r={6}
                  />
                )
              })}
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 4 }}>
            Higher score = more relevant · Each dot is a retrieved chunk · Hover to preview content
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .8s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}
