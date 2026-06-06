// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState } from 'react'
import { Icon } from '../../icons/Icon'
import type { WizardForm, GuardrailsConfig } from '../../../types'

interface StepProps {
  form: WizardForm
  onChange: (patch: Partial<WizardForm>) => void
  onPipelinePatch: (patch: Partial<WizardForm['pipeline']>) => void
  errors: Record<string, string>
  mode?: 'new' | 'edit'
}

const DEFAULT_GUARDRAILS: GuardrailsConfig = {
  topic_restrictions: '',
  forbidden_content: [],
  format_rules: '',
  confidence_threshold: 0,
}

export function StepGuardrails({ form, onPipelinePatch }: StepProps) {
  const gr = form.pipeline.guardrails ?? null
  const enabled = !!gr
  const [tagInput, setTagInput] = useState('')

  const toggle = () => {
    if (enabled) {
      onPipelinePatch({ guardrails: null })
    } else {
      onPipelinePatch({ guardrails: { ...DEFAULT_GUARDRAILS } })
    }
  }

  const patch = (update: Partial<GuardrailsConfig>) => {
    if (!gr) return
    onPipelinePatch({ guardrails: { ...gr, ...update } })
  }

  const addTag = () => {
    const val = tagInput.trim()
    if (!val || !gr) return
    if (!gr.forbidden_content.includes(val)) {
      patch({ forbidden_content: [...gr.forbidden_content, val] })
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    if (!gr) return
    patch({ forbidden_content: gr.forbidden_content.filter(t => t !== tag) })
  }

  const threshold = gr?.confidence_threshold ?? 0

  return (
    <>
      <div className="step-head">
        <div className="kicker">Step 11 of 11 · Guardrails</div>
        <h2>Set restrictions and quality controls</h2>
        <p>Guardrails shape what the agent will and won't answer.</p>
      </div>

      {/* Toggle row */}
      <div
        className="toggle-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: 16,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 14,
        }}
      >
        <div
          className="toggle"
          data-on={String(enabled)}
          onClick={toggle}
          role="switch"
          aria-checked={enabled}
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggle() }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Enable guardrails</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>
            {enabled
              ? 'Guardrails are active — configure the rules below.'
              : 'Off — the agent will answer any question without topic, content, or format restrictions.'}
          </div>
        </div>
      </div>

      {enabled && gr && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 18 }}>

          {/* Topic restrictions */}
          <div className="field">
            <label>Topic scope</label>
            <textarea
              rows={3}
              placeholder="e.g. Only answer questions about financial reports and earnings data. Decline all other topics."
              value={gr.topic_restrictions}
              onChange={e => patch({ topic_restrictions: e.target.value })}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
              The agent will politely decline questions outside this scope.
            </div>
          </div>

          {/* Forbidden content — tag input */}
          <div className="field">
            <label>Forbidden topics</label>
            {gr.forbidden_content.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                {gr.forbidden_content.map(tag => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 10px 3px 10px',
                      background: 'var(--surface-3, var(--surface-2))',
                      border: '1px solid var(--border)',
                      borderRadius: 20,
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: 'var(--text)',
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        lineHeight: 1,
                        color: 'var(--text-faint)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      aria-label={`Remove ${tag}`}
                    >
                      <Icon name="x" size={12} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Type a topic and press Enter…"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
              The agent will refuse to discuss these subjects.
            </div>
          </div>

          {/* Format rules */}
          <div className="field">
            <label>Response format rules</label>
            <textarea
              rows={3}
              placeholder="e.g. Always respond in bullet points. Keep answers under 200 words. Always cite the source chunk number."
              value={gr.format_rules}
              onChange={e => patch({ format_rules: e.target.value })}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
              Instructions about how the agent should structure its answers.
            </div>
          </div>

          {/* Confidence threshold */}
          <div className="field">
            <label>
              Minimum confidence score
              <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>
                {' '}({threshold === 0 ? 'Disabled' : threshold.toFixed(2)})
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={threshold}
              onChange={e => patch({ confidence_threshold: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11.5,
                color: 'var(--text-faint)',
                marginTop: 2,
              }}
            >
              <span>0</span>
              <span
                style={{
                  color: threshold > 0 ? 'var(--text-dim)' : 'var(--text-faint)',
                  fontStyle: threshold > 0 ? 'normal' : 'italic',
                }}
              >
                {threshold === 0
                  ? 'Disabled — always attempt to answer'
                  : `Refuse if avg retrieval score below ${threshold.toFixed(2)}`}
              </span>
              <span>1</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
              Higher = more conservative. Set to 0 to always attempt an answer.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
