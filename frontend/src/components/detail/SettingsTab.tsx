// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState, useEffect } from 'react'
import { Icon } from '../icons/Icon'
import { useUpdateAgent } from '../../api/agents'
import type { Agent, GuardrailsConfig, SystemPromptConfig } from '../../types'

export interface SettingsTabProps {
  agent: Agent
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-xl)',
  padding: 20,
  marginBottom: 16,
}

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 14,
}

const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 15,
}

// ─── System Prompt Section ────────────────────────────────────────────────────

interface SystemPromptSectionProps {
  agent: Agent
  editing: boolean
  onEdit: () => void
  onDone: () => void
}

function SystemPromptSection({ agent, editing, onEdit, onDone }: SystemPromptSectionProps) {
  const sp = agent.pipeline.system_prompt
  const updateAgent = useUpdateAgent()
  const [mode, setMode] = useState<'append' | 'replace'>(sp?.mode ?? 'append')
  const [content, setContent] = useState(sp?.content ?? '')
  const [saved, setSaved] = useState(false)

  // Sync local state when agent prop changes (e.g. after a successful save)
  useEffect(() => {
    setMode(sp?.mode ?? 'append')
    setContent(sp?.content ?? '')
  }, [sp?.mode, sp?.content]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const newSystemPrompt: SystemPromptConfig | null =
      content.trim() === '' ? null : { mode, content: content.trim() }

    await updateAgent.mutateAsync({
      id: agent.id,
      pipeline: { ...agent.pipeline, system_prompt: newSystemPrompt },
    })

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onDone()
  }

  const handleCancel = () => {
    setMode(sp?.mode ?? 'append')
    setContent(sp?.content ?? '')
    onDone()
  }

  return (
    <div style={cardStyle}>
      <div style={headerRowStyle}>
        <span style={labelStyle}>System Prompt</span>
        {!editing && (
          <button className="btn ghost sm" onClick={onEdit}>
            <Icon name="edit" size={14} /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        // View mode
        sp?.content ? (
          <div>
            <span
              style={{
                display: 'inline-block',
                marginBottom: 10,
                padding: '2px 10px',
                background: 'var(--accent-soft, rgba(99,102,241,.15))',
                color: 'var(--accent)',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {sp.mode === 'append' ? 'Append' : 'Replace'}
            </span>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 13,
                color: 'var(--text-dim)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {sp.content.slice(0, 200)}
              {sp.content.length > 200 && '…'}
            </div>
          </div>
        ) : (
          <div
            style={{
              fontStyle: 'italic',
              color: 'var(--text-faint)',
              fontSize: 13.5,
            }}
          >
            Using default RAG system prompt
          </div>
        )
      ) : (
        // Edit mode
        <div>
          {/* Mode toggle pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['append', 'replace'] as const).map((m) => (
              <label
                key={m}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 14px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: mode === m ? 'var(--accent-soft, rgba(99,102,241,.15))' : 'transparent',
                  color: mode === m ? 'var(--accent)' : 'var(--text-dim)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <input
                  type="radio"
                  name="sp-mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  style={{ display: 'none' }}
                />
                {m === 'append' ? 'Append' : 'Replace'}
              </label>
            ))}
          </div>

          <textarea
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your system prompt… (leave empty to use the default)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              fontFamily: 'monospace',
              fontSize: 13,
              padding: '8px 10px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text)',
              marginBottom: 12,
            }}
          />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn primary sm"
              onClick={handleSave}
              disabled={updateAgent.isPending}
            >
              {updateAgent.isPending ? (
                <><Icon name="loader" size={14} /> Saving…</>
              ) : (
                'Save'
              )}
            </button>
            <button className="btn ghost sm" onClick={handleCancel}>
              Cancel
            </button>
            {saved && (
              <span style={{ color: 'var(--success, #22c55e)', fontSize: 13 }}>
                <Icon name="check" size={13} /> Saved
              </span>
            )}
            {updateAgent.isError && (
              <span style={{ color: 'var(--danger)', fontSize: 13 }}>
                {updateAgent.error?.message ?? 'Save failed'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Guardrails Section ───────────────────────────────────────────────────────

interface GuardrailsSectionProps {
  agent: Agent
  editing: boolean
  onEdit: () => void
  onDone: () => void
}

function GuardrailsSection({ agent, editing, onEdit, onDone }: GuardrailsSectionProps) {
  const gr = agent.pipeline.guardrails
  const updateAgent = useUpdateAgent()
  const [saved, setSaved] = useState(false)

  const [topicRestrictions, setTopicRestrictions] = useState(gr?.topic_restrictions ?? '')
  const [forbiddenContent, setForbiddenContent] = useState<string[]>(gr?.forbidden_content ?? [])
  const [formatRules, setFormatRules] = useState(gr?.format_rules ?? '')
  const [confidenceThreshold, setConfidenceThreshold] = useState(gr?.confidence_threshold ?? 0)
  const [historyRetention, setHistoryRetention] = useState(gr?.history_retention ?? 25)

  // Sync when agent prop changes
  useEffect(() => {
    setTopicRestrictions(gr?.topic_restrictions ?? '')
    setForbiddenContent(gr?.forbidden_content ?? [])
    setFormatRules(gr?.format_rules ?? '')
    setConfidenceThreshold(gr?.confidence_threshold ?? 0)
    setHistoryRetention(gr?.history_retention ?? 25)
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    gr?.topic_restrictions,
    gr?.forbidden_content,
    gr?.format_rules,
    gr?.confidence_threshold,
    gr?.history_retention,
  ])

  const addTag = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !forbiddenContent.includes(trimmed)) {
      setForbiddenContent((prev) => [...prev, trimmed])
    }
  }

  const removeTag = (tag: string) => {
    setForbiddenContent((prev) => prev.filter((t) => t !== tag))
  }

  const handleSave = async () => {
    const allEmpty =
      topicRestrictions.trim() === '' &&
      forbiddenContent.length === 0 &&
      formatRules.trim() === '' &&
      confidenceThreshold === 0 &&
      historyRetention === 25

    const newGuardrails: GuardrailsConfig | null = allEmpty
      ? null
      : {
          topic_restrictions: topicRestrictions.trim(),
          forbidden_content: forbiddenContent,
          format_rules: formatRules.trim(),
          confidence_threshold: confidenceThreshold,
          history_retention: historyRetention,
        }

    await updateAgent.mutateAsync({
      id: agent.id,
      pipeline: { ...agent.pipeline, guardrails: newGuardrails },
    })

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onDone()
  }

  const handleCancel = () => {
    setTopicRestrictions(gr?.topic_restrictions ?? '')
    setForbiddenContent(gr?.forbidden_content ?? [])
    setFormatRules(gr?.format_rules ?? '')
    setConfidenceThreshold(gr?.confidence_threshold ?? 0)
    setHistoryRetention(gr?.history_retention ?? 25)
    onDone()
  }

  const hasAny =
    !!gr?.topic_restrictions ||
    (gr?.forbidden_content?.length ?? 0) > 0 ||
    !!gr?.format_rules ||
    (gr?.confidence_threshold ?? 0) > 0 ||
    (gr?.history_retention ?? 25) !== 25

  return (
    <div style={cardStyle}>
      <div style={headerRowStyle}>
        <span style={labelStyle}>Guardrails</span>
        {!editing && (
          <button className="btn ghost sm" onClick={onEdit}>
            <Icon name="edit" size={14} /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        // View mode
        hasAny ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {gr?.topic_restrictions && (
              <Chip color="green">
                Topics: {gr.topic_restrictions.slice(0, 40)}{gr.topic_restrictions.length > 40 ? '…' : ''}
              </Chip>
            )}
            {(gr?.forbidden_content?.length ?? 0) > 0 && (
              <Chip color="red">
                Blocked: {gr!.forbidden_content.length} {gr!.forbidden_content.length === 1 ? 'topic' : 'topics'}
              </Chip>
            )}
            {gr?.format_rules && (
              <Chip color="blue">Format rules set</Chip>
            )}
            {(gr?.confidence_threshold ?? 0) > 0 && (
              <Chip color="amber">Min score: {gr!.confidence_threshold}</Chip>
            )}
            {(gr?.history_retention ?? 25) !== 25 && (
              <Chip color="blue">History: {gr!.history_retention} entries</Chip>
            )}
          </div>
        ) : (
          <div style={{ color: 'var(--text-faint)', fontSize: 13.5 }}>
            No guardrails — agent answers all questions
          </div>
        )
      ) : (
        // Edit mode
        <div>
          {/* Topic restrictions */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-dim)' }}>
              Topic restrictions
            </label>
            <textarea
              rows={3}
              value={topicRestrictions}
              onChange={(e) => setTopicRestrictions(e.target.value)}
              placeholder="Describe which topics the agent should restrict to…"
              style={textareaStyle}
            />
          </div>

          {/* Forbidden content tag input */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-dim)' }}>
              Forbidden content
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                padding: '6px 8px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                minHeight: 40,
              }}
            >
              {forbiddenContent.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    background: 'rgba(239,68,68,.15)',
                    color: '#f87171',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      lineHeight: 1,
                      color: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    aria-label={`Remove ${tag}`}
                  >
                    <Icon name="x" size={11} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder="Type and press Enter to add…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag(e.currentTarget.value)
                    e.currentTarget.value = ''
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 160,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: 13,
                  padding: '2px 4px',
                }}
              />
            </div>
          </div>

          {/* Format rules */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-dim)' }}>
              Format rules
            </label>
            <textarea
              rows={3}
              value={formatRules}
              onChange={(e) => setFormatRules(e.target.value)}
              placeholder="Describe any output format requirements…"
              style={textareaStyle}
            />
          </div>

          {/* Confidence threshold slider */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-dim)' }}>
              Confidence threshold
              <span
                style={{
                  marginLeft: 10,
                  padding: '1px 8px',
                  background: 'var(--accent-soft, rgba(99,102,241,.15))',
                  color: 'var(--accent)',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {confidenceThreshold.toFixed(2)}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--text-faint)',
                marginTop: 2,
              }}
            >
              <span>0.00 (off)</span>
              <span>1.00</span>
            </div>
          </div>

          {/* History retention */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-dim)' }}>
              History retention
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min={1}
                max={500}
                value={historyRetention}
                onChange={(e) => setHistoryRetention(Math.max(1, parseInt(e.target.value) || 25))}
                style={{
                  width: 80,
                  padding: '6px 10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
              <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
                conversations stored (oldest deleted when exceeded)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn primary sm"
              onClick={handleSave}
              disabled={updateAgent.isPending}
            >
              {updateAgent.isPending ? (
                <><Icon name="loader" size={14} /> Saving…</>
              ) : (
                'Save'
              )}
            </button>
            <button className="btn ghost sm" onClick={handleCancel}>
              Cancel
            </button>
            {saved && (
              <span style={{ color: 'var(--success, #22c55e)', fontSize: 13 }}>
                <Icon name="check" size={13} /> Saved
              </span>
            )}
            {updateAgent.isError && (
              <span style={{ color: 'var(--danger)', fontSize: 13 }}>
                {updateAgent.error?.message ?? 'Save failed'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Chip helper ─────────────────────────────────────────────────────────────

const CHIP_COLORS: Record<string, { bg: string; color: string }> = {
  green: { bg: 'rgba(34,197,94,.15)', color: '#4ade80' },
  red:   { bg: 'rgba(239,68,68,.15)', color: '#f87171' },
  blue:  { bg: 'rgba(59,130,246,.15)', color: '#60a5fa' },
  amber: { bg: 'rgba(245,158,11,.15)', color: '#fbbf24' },
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  const { bg, color: fg } = CHIP_COLORS[color] ?? CHIP_COLORS.blue
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 500,
        background: bg,
        color: fg,
      }}
    >
      {children}
    </span>
  )
}

// ─── Shared textarea style ────────────────────────────────────────────────────

const textareaStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  fontSize: 13,
  padding: '8px 10px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontFamily: 'inherit',
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsTab({ agent }: SettingsTabProps) {
  const [editingSection, setEditingSection] = useState<'system_prompt' | 'guardrails' | null>(null)

  return (
    <div style={{ paddingTop: 8 }}>
      <SystemPromptSection
        agent={agent}
        editing={editingSection === 'system_prompt'}
        onEdit={() => setEditingSection('system_prompt')}
        onDone={() => setEditingSection(null)}
      />
      <GuardrailsSection
        agent={agent}
        editing={editingSection === 'guardrails'}
        onEdit={() => setEditingSection('guardrails')}
        onDone={() => setEditingSection(null)}
      />
    </div>
  )
}
