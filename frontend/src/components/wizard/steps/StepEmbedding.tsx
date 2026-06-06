// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { PIPELINE_META } from '../../../data/pipeline'
import { Icon } from '../../icons/Icon'
import type { WizardForm, EmbeddingProvider } from '../../../types'

interface StepProps {
  form: WizardForm
  onChange: (patch: Partial<WizardForm>) => void
  onPipelinePatch: (patch: Partial<WizardForm['pipeline']>) => void
  errors: Record<string, string>
  mode?: 'new' | 'edit'
}

export function StepEmbedding({ form, onPipelinePatch, mode }: StepProps) {
  const opts = PIPELINE_META.embedding.options
  const current = form.pipeline.embedding

  const setEmb = (patch: Partial<WizardForm['pipeline']['embedding']>) => {
    onPipelinePatch({ embedding: { ...current, ...patch } })
  }

  return (
    <>
      <div className="step-head">
        <div className="kicker">Step 4 of 9 · Embedding</div>
        <h2>Which model will convert text to vectors?</h2>
        <p>Embeddings turn your chunks into numerical vectors so the retriever can find related text.</p>
      </div>

      {mode === 'edit' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 14px', marginBottom: 18,
          background: 'var(--warn-soft, rgba(245,158,11,.12))',
          border: '1px solid rgba(245,158,11,.35)',
          borderRadius: 'var(--r-md)',
          color: 'var(--warn, #f59e0b)',
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          <Icon name="alert" size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Changing the embedding model requires re-ingesting all documents —
            existing vectors were built with a different model and cannot be mixed.
            Delete and re-upload your documents after saving.
          </span>
        </div>
      )}

      <div className="radio-cards">
        {Object.entries(opts).map(([k, o]) => {
          const selected = current.provider === k
          return (
            <button
              key={k}
              type="button"
              className={`radio-card${selected ? ' selected' : ''}`}
              onClick={() => setEmb({ provider: k as EmbeddingProvider, model: o.default ?? '' })}
            >
              <div className="text">
                <div className="title-row">
                  <span className="title">{o.label}</span>
                </div>
                {o.sub && <div className="sub">{o.sub}</div>}
              </div>
              <div className="check">
                {selected && <Icon name="check" size={12} strokeWidth={3} />}
              </div>
            </button>
          )
        })}
      </div>

      <div className="field" style={{ marginTop: 22 }}>
        <label>Model</label>
        <input
          type="text"
          value={current.model}
          onChange={e => setEmb({ model: e.target.value })}
        />
        <div className="hint">
          Default for {opts[current.provider]?.label}:{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
            {opts[current.provider]?.default}
          </code>
        </div>
      </div>
    </>
  )
}
