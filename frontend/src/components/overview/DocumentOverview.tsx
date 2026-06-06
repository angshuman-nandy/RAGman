// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../icons/Icon'
import { StatusBadge } from '../shared/StatusBadge'
import { useDocuments } from '../../api/documents'
import { ChunksTab } from './ChunksTab'
import { ChunkingTab } from './ChunkingTab'
import { RetrievalTab } from './RetrievalTab'
import { EmbeddingsTab } from './EmbeddingsTab'
import { RerankerTab } from './RerankerTab'
import type { Agent } from '../../types'

export interface DocumentOverviewProps {
  agentId: string
  docId: string
  agent?: Agent
}

type TabKey = 'chunks' | 'chunking' | 'retrieval' | 'reranker' | 'embeddings'

function fileTypeLabel(fileType: string): string {
  const map: Record<string, string> = {
    pdf: 'PDF',
    docx: 'WORD',
    txt: 'TXT',
    md: 'MD',
  }
  return map[fileType.toLowerCase()] ?? fileType.slice(0, 4).toUpperCase()
}

function fileTypePillColor(fileType: string): string {
  const map: Record<string, string> = {
    pdf: '#fb7185',
    docx: '#60a5fa',
    md: '#a78bfa',
    txt: '#34d399',
  }
  return map[fileType.toLowerCase()] ?? 'var(--text-dim)'
}

export function DocumentOverview({ agentId, docId, agent }: DocumentOverviewProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('chunks')

  const { data, isLoading } = useDocuments(agentId)
  const doc = data?.items.find((d) => d.id === docId)

  const hasReranker = !!agent?.pipeline?.reranker

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'chunks', label: `Chunks${doc ? ` · ${doc.chunk_count ?? 0}` : ''}` },
    { key: 'chunking', label: 'Chunking' },
    { key: 'retrieval', label: 'Retrieval' },
    ...(hasReranker ? [{ key: 'reranker' as TabKey, label: 'Reranker' }] : []),
    { key: 'embeddings', label: 'Embeddings' },
  ]

  return (
    <main className="page">
      {/* Back link */}
      <button
        className="btn ghost sm"
        onClick={() => navigate(`/agents/${agentId}`)}
        style={{ marginBottom: 20, marginLeft: -10 }}
      >
        <Icon name="arrow-left" size={14} />
        Back to documents
      </button>

      {/* Header */}
      {isLoading ? (
        <div
          style={{
            height: 48,
            background: 'var(--surface-2)',
            borderRadius: 'var(--r-lg)',
            width: '40%',
            marginBottom: 24,
            animation: 'skeletonPulse 1.6s ease-in-out infinite',
          }}
        />
      ) : !doc ? (
        <div
          style={{
            padding: '16px 20px',
            background: 'var(--danger-soft)',
            border: '1px solid rgba(239,68,68,.3)',
            borderRadius: 'var(--r-lg)',
            color: 'var(--danger)',
            fontSize: 14,
            marginBottom: 24,
          }}
        >
          Document not found. It may have been deleted.
        </div>
      ) : (
        <div className="detail-header">
          <div className="top">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {doc.filename}
              </h1>
            </div>
          </div>

          <div className="chips">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 22,
                padding: '0 8px',
                borderRadius: 6,
                background: `${fileTypePillColor(doc.file_type)}22`,
                border: `1px solid ${fileTypePillColor(doc.file_type)}55`,
                color: fileTypePillColor(doc.file_type),
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: '.02em',
              }}
            >
              {fileTypeLabel(doc.file_type)}
            </span>
            <StatusBadge status={doc.status} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            className={`tab${activeTab === key ? ' active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'chunks' && <ChunksTab agentId={agentId} docId={docId} />}
        {activeTab === 'chunking' && <ChunkingTab agentId={agentId} docId={docId} />}
        {activeTab === 'retrieval' && <RetrievalTab agentId={agentId} docId={docId} />}
        {activeTab === 'reranker' && agent && (
          <RerankerTab agentId={agentId} docId={docId} agent={agent} />
        )}
        {activeTab === 'embeddings' && <EmbeddingsTab agentId={agentId} docId={docId} />}
      </div>

      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </main>
  )
}
