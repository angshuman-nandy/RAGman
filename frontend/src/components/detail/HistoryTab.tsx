// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Icon } from '../icons/Icon'
import { useHistory, useDeleteHistoryEntry, useClearHistory } from '../../api/history'
import { Modal } from '../shared/Modal'
import type { Agent, QueryHistoryEntry, HistoryChunk } from '../../types'

interface HistoryTabProps {
  agent: Agent
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function ScoreChart({ chunks }: { chunks: HistoryChunk[] }) {
  const data = chunks.map((c, i) => ({
    name: `#${c.chunk_index ?? i}`,
    score: parseFloat(c.score.toFixed(3)),
    filename: c.filename,
  }))

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 1]}
          tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, _name: string, props: { payload?: { filename?: string } }) => [
            value.toFixed(3),
            props.payload?.filename ?? 'score',
          ]}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={
                entry.score >= 0.7
                  ? 'var(--accent)'
                  : entry.score >= 0.4
                  ? 'rgba(99,102,241,0.5)'
                  : 'rgba(99,102,241,0.25)'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChunkCard({ chunk, rank }: { chunk: HistoryChunk; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const preview = chunk.content.slice(0, 160)
  const hasMore = chunk.content.length > 160

  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: 11,
            color: 'var(--text-faint)',
            minWidth: 22,
          }}
        >
          #{rank}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 12,
            color: 'var(--text-dim)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={chunk.filename}
        >
          {chunk.filename}
          <span style={{ color: 'var(--text-faint)', marginLeft: 4 }}>
            chunk {chunk.chunk_index}
          </span>
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 20,
            background:
              chunk.score >= 0.7
                ? 'rgba(34,197,94,.15)'
                : chunk.score >= 0.4
                ? 'rgba(99,102,241,.15)'
                : 'rgba(100,116,139,.15)',
            color:
              chunk.score >= 0.7
                ? '#4ade80'
                : chunk.score >= 0.4
                ? 'var(--accent)'
                : 'var(--text-faint)',
          }}
        >
          {chunk.score.toFixed(3)}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'inherit',
          color: 'var(--text-dim)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {expanded ? chunk.content : preview}
        {hasMore && !expanded && '…'}
      </div>
      {hasMore && (
        <button
          className="btn ghost sm"
          style={{ marginTop: 6, fontSize: 12 }}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Show less' : 'Show full chunk'}
        </button>
      )}
    </div>
  )
}

function HistoryDetail({
  entry,
  onDelete,
}: {
  entry: QueryHistoryEntry
  onDelete: () => void
}) {
  const displayChunks = entry.reranked_chunks ?? entry.retrieved_chunks

  const uniqueDocs = Array.from(
    new Map(
      entry.retrieved_chunks.map((c) => [c.doc_id || c.filename, c.filename]),
    ).values(),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 4 }}>
            {fmtDate(entry.created_at)}
          </div>
          <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.4, color: 'var(--text)' }}>
            {entry.question}
          </div>
        </div>
        <button
          className="btn ghost sm icon-only"
          onClick={onDelete}
          aria-label="Delete entry"
          style={{ flexShrink: 0, color: 'var(--danger)' }}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>

      {/* Metadata chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span
          style={{
            padding: '2px 10px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            background: 'rgba(99,102,241,.15)',
            color: 'var(--accent)',
          }}
        >
          {entry.retrieval_strategy}
        </span>
        {entry.reranked_chunks && (
          <span
            style={{
              padding: '2px 10px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              background: 'rgba(245,158,11,.15)',
              color: '#fbbf24',
            }}
          >
            reranked
          </span>
        )}
        {entry.document_filter && (
          <span
            style={{
              padding: '2px 10px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              background: 'rgba(100,116,139,.15)',
              color: 'var(--text-faint)',
            }}
          >
            filtered: {entry.document_filter.length} doc{entry.document_filter.length !== 1 ? 's' : ''}
          </span>
        )}
        <span
          style={{
            padding: '2px 10px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            background: 'rgba(100,116,139,.15)',
            color: 'var(--text-faint)',
          }}
        >
          {entry.retrieved_chunks.length} chunks retrieved
        </span>
      </div>

      {/* Answer */}
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 8,
          }}
        >
          Answer
        </div>
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13.5,
            lineHeight: 1.6,
            color: 'var(--text)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {entry.answer || <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>No answer recorded</span>}
        </div>
      </div>

      {/* Documents used */}
      {uniqueDocs.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            Documents used
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {uniqueDocs.map((name) => (
              <span
                key={name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-dim)',
                }}
              >
                <Icon name="file-text" size={11} />
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Score chart */}
      {displayChunks.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            Retrieval scores
          </div>
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '8px 8px 4px',
            }}
          >
            <ScoreChart chunks={displayChunks} />
          </div>
        </div>
      )}

      {/* Context chunks */}
      {displayChunks.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            Context sent to LLM
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayChunks.map((chunk, i) => (
              <ChunkCard key={i} chunk={chunk} rank={i + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function HistoryTab({ agent }: HistoryTabProps) {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<QueryHistoryEntry | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const limit = 25

  const { data, isLoading } = useHistory(agent.id, page, limit)
  const deleteEntry = useDeleteHistoryEntry(agent.id)
  const clearHistory = useClearHistory(agent.id)

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const handleDeleteEntry = async (id: string) => {
    await deleteEntry.mutateAsync({ historyId: id })
    if (selected?.id === id) setSelected(null)
    setConfirmDeleteId(null)
  }

  const handleClearAll = async () => {
    await clearHistory.mutateAsync()
    setSelected(null)
    setPage(1)
    setConfirmClear(false)
  }

  return (
    <div style={{ paddingTop: 8, display: 'flex', gap: 16, minHeight: 400 }}>
      {/* Left: list */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>
            {total} conversation{total !== 1 ? 's' : ''}
          </span>
          {total > 0 && (
            <button
              className="btn ghost sm"
              style={{ fontSize: 12, color: 'var(--danger)' }}
              onClick={() => setConfirmClear(true)}
            >
              Clear all
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: 12, textAlign: 'center' }}>
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              color: 'var(--text-faint)',
              fontSize: 13,
              padding: '24px 12px',
              textAlign: 'center',
              border: '1px dashed var(--border)',
              borderRadius: 10,
            }}
          >
            No conversations yet. Ask something in the Chat tab.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelected(entry)}
                style={{
                  textAlign: 'left',
                  background: selected?.id === entry.id ? 'var(--surface-2)' : 'transparent',
                  border: `1px solid ${selected?.id === entry.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  transition: 'border-color 0.12s, background 0.12s',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 3,
                  }}
                  title={entry.question}
                >
                  {entry.question}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {fmtDate(entry.created_at)}
                  <span
                    style={{
                      marginLeft: 6,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text-faint)',
                    }}
                  >
                    {entry.retrieval_strategy}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 12,
            }}
          >
            <button
              className="btn ghost sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Icon name="arrow-left" size={13} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              {page} / {totalPages}
            </span>
            <button
              className="btn ghost sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <Icon name="arrow-right" size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Right: detail */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
          padding: 20,
          overflowY: 'auto',
          maxHeight: 700,
        }}
      >
        {selected ? (
          <HistoryDetail
            entry={selected}
            onDelete={() => setConfirmDeleteId(selected.id)}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-faint)',
              fontSize: 13.5,
            }}
          >
            Select a conversation to view details
          </div>
        )}
      </div>

      {/* Confirm delete single */}
      <Modal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete this entry?"
        message="This will permanently remove this conversation entry."
        confirmLabel="Delete"
        danger
        onConfirm={() => confirmDeleteId && handleDeleteEntry(confirmDeleteId)}
      />

      {/* Confirm clear all */}
      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all history?"
        message="This will permanently delete all conversation history for this agent."
        confirmLabel="Clear all"
        danger
        onConfirm={handleClearAll}
      />
    </div>
  )
}
