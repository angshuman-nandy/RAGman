// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState } from 'react'
import { Icon } from '../icons/Icon'
import { StatusBadge } from '../shared/StatusBadge'
import { PipelineChips } from '../shared/PipelineChips'
import { Modal } from '../shared/Modal'
import { DocumentsTab } from './DocumentsTab'
import { ChatTab } from './ChatTab'
import { SettingsTab } from './SettingsTab'
import { useDocuments } from '../../api/documents'
import type { Agent } from '../../types'

export interface AgentDetailProps {
  agent: Agent
  onBack: () => void
  onEdit: () => void
  onDelete: (id: string) => void
}

interface DotMenuItem {
  icon?: string
  label?: string
  onClick?: () => void
  danger?: boolean
  sep?: boolean
}

function DotMenu({ items }: { items: DotMenuItem[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="menu-wrap"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <button
        className="btn ghost sm icon-only"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        aria-label="More options"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div className="menu" onClick={(e) => e.stopPropagation()}>
          {items.map((it, i) =>
            it.sep ? (
              <div className="sep" key={i} />
            ) : (
              <button
                key={i}
                className={it.danger ? 'danger' : ''}
                onClick={() => { setOpen(false); it.onClick?.() }}
              >
                {it.icon && <Icon name={it.icon} size={14} />}
                {it.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

type TabKey = 'documents' | 'chat' | 'settings'

export function AgentDetail({ agent, onBack, onEdit, onDelete }: AgentDetailProps) {
  const [tab, setTab] = useState<TabKey>('documents')
  const [confirmDel, setConfirmDel] = useState(false)

  // Fetch documents once here so both tab label count and ChatTab share the same data
  const { data: docsData } = useDocuments(agent.id)
  const docs = docsData?.items ?? []
  const docCount = docs.length

  // Derive a display status from the document list
  const agentStatus: 'ready' | 'ingesting' | 'failed' | 'empty' = (() => {
    if (docs.length === 0) return 'empty'
    if (docs.some((d) => d.status === 'pending' || d.status === 'ingesting')) return 'ingesting'
    if (docs.every((d) => d.status === 'failed')) return 'failed'
    return 'ready'
  })()

  return (
    <main className="page">
      <button
        className="btn ghost sm"
        onClick={onBack}
        style={{ marginBottom: 16, marginLeft: -10 }}
      >
        <Icon name="arrow-left" size={14} /> All agents
      </button>

      <div className="detail-header">
        <div className="top">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1>{agent.name}</h1>
            {agent.description && (
              <div className="desc">{agent.description}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn subtle sm hidden-mobile" onClick={onEdit}>
              <Icon name="edit" size={14} /> Edit
            </button>
            <button
              className="btn ghost sm icon-only only-mobile"
              onClick={onEdit}
              aria-label="Edit"
            >
              <Icon name="edit" size={14} />
            </button>
            <DotMenu
              items={[
                { icon: 'edit', label: 'Edit pipeline', onClick: onEdit },
                { sep: true },
                {
                  icon: 'trash',
                  label: 'Delete agent',
                  onClick: () => setConfirmDel(true),
                  danger: true,
                },
              ]}
            />
          </div>
        </div>

        <div className="chips">
          <StatusBadge status={agentStatus} />
          <PipelineChips pipeline={agent.pipeline} />
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === 'documents' ? 'active' : ''}`}
          onClick={() => setTab('documents')}
        >
          <Icon name="file-text" size={14} /> Documents
          <span className="count">{docCount}</span>
        </button>
        <button
          className={`tab ${tab === 'chat' ? 'active' : ''}`}
          onClick={() => setTab('chat')}
        >
          <Icon name="message" size={14} /> Chat
        </button>
        <button
          className={`tab ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          <Icon name="sliders" size={14} /> Settings
        </button>
      </div>

      {tab === 'documents' && <DocumentsTab agent={agent} />}
      {tab === 'chat' && <ChatTab agent={agent} documents={docs} />}
      {tab === 'settings' && <SettingsTab agent={agent} />}

      <Modal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title={`Delete "${agent.name}"?`}
        message="This permanently removes the agent and all its embedded documents."
        confirmLabel="Delete"
        danger
        onConfirm={() => onDelete(agent.id)}
      />
    </main>
  )
}
