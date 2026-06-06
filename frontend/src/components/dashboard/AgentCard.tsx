// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState } from 'react'
import type { Agent, DocumentStatus } from '../../types'
import { Icon } from '../icons/Icon'
import { StatusBadge } from '../shared/StatusBadge'
import { PipelineChips } from '../shared/PipelineChips'
import { DotMenu } from '../shared/DotMenu'
import { Modal } from '../shared/Modal'

interface AgentCardProps {
  agent: Agent
  /** Inferred agent status — defaults to 'ready' if omitted */
  status?: DocumentStatus | 'empty'
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}

export function AgentCard({
  agent,
  status = 'ready',
  onOpen,
  onEdit,
  onDelete,
}: AgentCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const menuItems = [
    { icon: 'edit', label: 'Edit pipeline', onClick: onEdit },
    {
      icon: 'trash',
      label: 'Delete agent',
      danger: true as const,
      onClick: () => setConfirmOpen(true),
    },
  ]

  return (
    <>
      <div className="agent-card" onClick={onOpen}>
        {/* Row 1: name + status badge */}
        <div className="row">
          <h3>{agent.name}</h3>
          <StatusBadge status={status} />
        </div>

        {/* Row 2: description (2-line clamp via .desc CSS class) */}
        <p className="desc">{agent.description ?? ''}</p>

        {/* Row 3: pipeline chips */}
        <div className="chips">
          <PipelineChips pipeline={agent.pipeline} max={5} />
        </div>

        {/* Row 4: doc count + Open button + DotMenu (dashed border via .meta CSS class) */}
        <div className="meta">
          <div className="docs">
            <Icon name="file" size={14} />
            <span>
              {agent.document_count ?? 0}{' '}
              {(agent.document_count ?? 0) === 1 ? 'document' : 'documents'}
            </span>
          </div>
          <div className="actions" onClick={(e) => e.stopPropagation()}>
            <button className="btn sm primary" onClick={onOpen}>
              Open <Icon name="arrow-right" size={14} />
            </button>
            <DotMenu items={menuItems} />
          </div>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        title={`Delete "${agent.name}"?`}
        message="This permanently removes the agent and all its embedded documents. The original files are not affected."
        confirmLabel="Delete agent"
        danger
        onConfirm={onDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  )
}
