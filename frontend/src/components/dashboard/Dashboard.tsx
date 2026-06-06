// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useNavigate } from 'react-router-dom'
import { Icon } from '../icons/Icon'
import { AgentCard } from './AgentCard'
import { EmptyDashboard } from './EmptyDashboard'
import { useAgents, useDeleteAgent } from '../../api/agents'

// Props are optional so the component works both as a routed page (no props)
// and as a controlled component (with explicit callbacks).
interface DashboardProps {
  onOpen?: (id: string) => void
  onEdit?: (id: string) => void
  onCreate?: () => void
  onDelete?: (id: string) => void
}

export function Dashboard({ onOpen, onEdit, onCreate, onDelete }: DashboardProps) {
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useAgents()
  const deleteAgent = useDeleteAgent()

  const agents = data?.items ?? []
  const total = data?.total ?? 0

  const handleOpen = (id: string) => (onOpen ? onOpen(id) : navigate(`/agents/${id}`))
  const handleEdit = (id: string) => (onEdit ? onEdit(id) : navigate(`/agents/${id}/edit`))
  const handleCreate = () => (onCreate ? onCreate() : navigate('/agents/new'))
  const handleDelete = (id: string) => {
    if (onDelete) {
      onDelete(id)
    } else {
      deleteAgent.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <main className="page">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--text-dim)',
            paddingTop: 40,
          }}
        >
          <Icon name="loader" size={18} />
          Loading agents&hellip;
        </div>
      </main>
    )
  }

  if (isError) {
    return (
      <main className="page">
        <div
          style={{
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingTop: 40,
          }}
        >
          <Icon name="alert" size={18} />
          {error instanceof Error ? error.message : 'Failed to load agents.'}
        </div>
      </main>
    )
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="title">Agents</h1>
          <div className="subtitle">
            {total} {total === 1 ? 'agent' : 'agents'} configured &middot; all running locally
          </div>
        </div>
        {agents.length > 0 && (
          <button className="btn primary" onClick={handleCreate}>
            <Icon name="plus" size={16} /> New Agent
          </button>
        )}
      </div>

      {agents.length === 0 ? (
        <EmptyDashboard onCreate={handleCreate} />
      ) : (
        <div className="agent-grid">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onOpen={() => handleOpen(agent.id)}
              onEdit={() => handleEdit(agent.id)}
              onDelete={() => handleDelete(agent.id)}
            />
          ))}
        </div>
      )}
    </main>
  )
}

// Default export for compatibility with App.tsx's default import
export default Dashboard
