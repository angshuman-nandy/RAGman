// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { Icon } from '../../icons/Icon'
import type { WizardForm, SystemPromptConfig } from '../../../types'

interface StepProps {
  form: WizardForm
  onChange: (patch: Partial<WizardForm>) => void
  onPipelinePatch: (patch: Partial<WizardForm['pipeline']>) => void
  errors: Record<string, string>
  mode?: 'new' | 'edit'
}

export function StepSystemPrompt({ form, onPipelinePatch }: StepProps) {
  const sp = form.pipeline.system_prompt ?? null
  const enabled = !!sp

  const toggle = () => {
    if (enabled) {
      onPipelinePatch({ system_prompt: null })
    } else {
      onPipelinePatch({ system_prompt: { mode: 'append', content: '' } })
    }
  }

  const patch = (update: Partial<SystemPromptConfig>) => {
    if (!sp) return
    onPipelinePatch({ system_prompt: { ...sp, ...update } })
  }

  return (
    <>
      <div className="step-head">
        <div className="kicker">Step 10 of 11 · System Prompt</div>
        <h2>Customise the agent's personality</h2>
        <p>Override or extend the default RAG system prompt with your own instructions.</p>
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
          <div style={{ fontSize: 14, fontWeight: 500 }}>Use custom system prompt</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>
            {enabled
              ? 'Your instructions will be included in the agent system prompt.'
              : 'Default — the agent uses the built-in RAG prompt, which instructs it to answer only from retrieved documents and cite sources.'}
          </div>
        </div>
      </div>

      {enabled && sp && (
        <>
          {/* Mode selector */}
          <div className="radio-cards col-2" style={{ marginTop: 18 }}>
            {(
              [
                {
                  value: 'append' as const,
                  title: 'Append',
                  sub: 'Add to default — Your instructions are appended after the built-in RAG prompt. Keeps document-answering behaviour.',
                },
                {
                  value: 'replace' as const,
                  title: 'Replace',
                  sub: 'Replace default — Your prompt is used as-is. You are responsible for including RAG instructions.',
                },
              ] as const
            ).map(opt => {
              const selected = sp.mode === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`radio-card${selected ? ' selected' : ''}`}
                  onClick={() => patch({ mode: opt.value })}
                >
                  <div className="text">
                    <div className="title-row">
                      <span className="title">{opt.title}</span>
                    </div>
                    <div className="sub">{opt.sub}</div>
                  </div>
                  <div className="check">
                    {selected && <Icon name="check" size={12} strokeWidth={3} />}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Prompt textarea */}
          <div className="field" style={{ marginTop: 18 }}>
            <label>
              System prompt content
              {sp.mode === 'append' && (
                <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>
                  {' '}· appended after built-in prompt
                </span>
              )}
            </label>
            <textarea
              rows={8}
              placeholder="e.g. You are a helpful legal assistant specialising in contract analysis. Always cite specific clauses..."
              value={sp.content}
              onChange={e => patch({ content: e.target.value })}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--text-faint)',
                marginTop: 4,
                textAlign: 'right',
              }}
            >
              {sp.content.length} characters
            </div>
          </div>
        </>
      )}
    </>
  )
}
