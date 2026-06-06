// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Sun, Moon, HelpCircle } from 'lucide-react'
import Dashboard from './components/dashboard/Dashboard'
import { Wizard } from './components/wizard/Wizard'
import { AgentDetail } from './components/detail/AgentDetail'
import { DocumentOverview } from './components/overview/DocumentOverview'
import { HelpPanel } from './components/shared/HelpPanel'
import RagmanLogo from './components/icons/RagmanLogo'
import { useAgent, useCreateAgent, useUpdateAgent, useDeleteAgent } from './api/agents'
import type { WizardForm } from './types'

// ---------------------------------------------------------------------------
// Theme helpers
// ---------------------------------------------------------------------------

type Theme = 'dark' | 'light'

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('ragman-theme') as Theme | null
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // localStorage unavailable
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

// ---------------------------------------------------------------------------
// Breadcrumb — resolves the second segment label from the current route
// ---------------------------------------------------------------------------

function BreadcrumbSegment({ agentId }: { agentId?: string }) {
  const location = useLocation()
  const { data: agent } = useAgent(agentId ?? '')

  if (location.pathname === '/agents/new') {
    return (
      <>
        <span className="navbar-sep">/</span>
        <span className="navbar-crumb">New agent</span>
      </>
    )
  }

  if (agentId) {
    const isEdit = location.pathname.endsWith('/edit')
    const isDocOverview = /^\/agents\/[^/]+\/documents\/[^/]+/.test(location.pathname)
    const label = agent?.name ?? agentId
    return (
      <>
        <span className="navbar-sep">/</span>
        <Link to={`/agents/${agentId}`} className="navbar-crumb navbar-crumb-link">
          {label}
        </Link>
        {isEdit && (
          <>
            <span className="navbar-sep">/</span>
            <span className="navbar-crumb">Edit</span>
          </>
        )}
        {isDocOverview && (
          <>
            <span className="navbar-sep">/</span>
            <span className="navbar-crumb">Document</span>
          </>
        )}
      </>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

interface NavbarProps {
  theme: Theme
  onThemeToggle: () => void
  onHelpOpen: () => void
}

function Navbar({ theme, onThemeToggle, onHelpOpen }: NavbarProps) {
  const location = useLocation()

  // Extract agentId from paths like /agents/:id or /agents/:id/edit
  const agentMatch = location.pathname.match(/^\/agents\/([^/]+)/)
  const agentId = agentMatch ? agentMatch[1] : undefined
  // Exclude the /new route from being treated as an agent id
  const resolvedAgentId = agentId === 'new' ? undefined : agentId

  return (
    <nav className="navbar">
      <div className="navbar-left">
        {/* Logo + wordmark */}
        <Link to="/" className="brand" aria-label="RAGman home">
          <RagmanLogo size={28} theme={theme} variant="transparent" />
          RAGman
        </Link>

        {/* Breadcrumb */}
        <div className="navbar-breadcrumb">
          <BreadcrumbSegment agentId={resolvedAgentId} />
        </div>
      </div>

      <div className="navbar-right">
        {/* Help */}
        <button
          className="navbar-icon-btn"
          onClick={onHelpOpen}
          aria-label="Open help"
          title="Help & feature guide"
        >
          <HelpCircle size={18} />
        </button>

        {/* Theme toggle */}
        <button
          className="navbar-icon-btn"
          onClick={onThemeToggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [helpOpen, setHelpOpen] = useState(false)

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem('ragman-theme', theme)
    } catch {
      // localStorage unavailable
    }
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <div className="app">
      <Navbar theme={theme} onThemeToggle={toggleTheme} onHelpOpen={() => setHelpOpen(true)} />
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agents/new" element={<WizardNewRoute />} />
          <Route path="/agents/:id" element={<AgentDetailRoute />} />
          <Route path="/agents/:id/edit" element={<WizardEditRoute />} />
          <Route path="/agents/:id/documents/:docId" element={<DocumentOverviewRoute />} />
        </Routes>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Route wrappers — fetch data and pass props to components
// ---------------------------------------------------------------------------

function WizardNewRoute() {
  const navigate = useNavigate()
  const createAgent = useCreateAgent()

  const handleSave = async (form: WizardForm) => {
    const agent = await createAgent.mutateAsync({
      name: form.name,
      description: form.description || null,
      pipeline: form.pipeline,
    })
    navigate(`/agents/${agent.id}`)
  }

  return (
    <Wizard
      mode="new"
      initial={null}
      onSave={handleSave}
      onCancel={() => navigate('/')}
    />
  )
}

function AgentDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const deleteAgent = useDeleteAgent()
  const { data: agent, isLoading, error } = useAgent(id ?? '')

  if (isLoading) return <div className="page"><p className="text-dim">Loading…</p></div>
  if (error || !agent) return <div className="page"><p className="text-dim">Agent not found.</p></div>

  return (
    <AgentDetail
      key={agent.id}
      agent={agent}
      onBack={() => navigate('/')}
      onEdit={() => navigate(`/agents/${agent.id}/edit`)}
      onDelete={async (agentId) => {
        await deleteAgent.mutateAsync(agentId)
        navigate('/')
      }}
    />
  )
}

function WizardEditRoute() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const updateAgent = useUpdateAgent()
  const { data: agent, isLoading } = useAgent(id ?? '')

  if (isLoading) return <div className="page"><p className="text-dim">Loading…</p></div>
  if (!agent) return <div className="page"><p className="text-dim">Agent not found.</p></div>

  const handleSave = async (form: WizardForm) => {
    await updateAgent.mutateAsync({
      id: agent.id,
      name: form.name,
      description: form.description || null,
      pipeline: form.pipeline,
    })
    navigate(`/agents/${agent.id}`)
  }

  return (
    <Wizard
      key={agent.id}
      mode="edit"
      initial={{ name: agent.name, description: agent.description ?? '', pipeline: agent.pipeline }}
      onSave={handleSave}
      onCancel={() => navigate(`/agents/${agent.id}`)}
    />
  )
}

function DocumentOverviewRoute() {
  const { id, docId } = useParams<{ id: string; docId: string }>()
  const { data: agent } = useAgent(id ?? '')
  return <DocumentOverview agentId={id!} docId={docId!} agent={agent} />
}
