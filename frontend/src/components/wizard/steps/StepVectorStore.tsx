// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { PIPELINE_META } from '../../../data/pipeline'
import { Icon } from '../../icons/Icon'
import type { WizardForm, VectorStoreType } from '../../../types'

interface StepProps {
  form: WizardForm
  onChange: (patch: Partial<WizardForm>) => void
  onPipelinePatch: (patch: Partial<WizardForm['pipeline']>) => void
  errors: Record<string, string>
  mode?: 'new' | 'edit'
}

export function StepVectorStore({ form, onPipelinePatch, mode }: StepProps) {
  const opts = PIPELINE_META.vector_store.options
  const current = form.pipeline.vector_store

  return (
    <>
      <div className="step-head">
        <div className="kicker">Step 5 of 9 · Vector Store</div>
        <h2>Where should vectors be stored?</h2>
        <p>Vector storage handles persistence and similarity search at query time.</p>
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
            Switching vector stores requires re-ingesting all documents —
            the existing index cannot be migrated between stores.
            Delete and re-upload your documents after saving.
          </span>
        </div>
      )}

      <div className="radio-cards col-2">
        {Object.entries(opts).map(([k, o]) => {
          const selected = current.type === k
          return (
            <button
              key={k}
              type="button"
              className={`radio-card${selected ? ' selected' : ''}`}
              onClick={() => onPipelinePatch({ vector_store: { type: k as VectorStoreType } })}
            >
              <div className="text">
                <div className="title-row">
                  <span className="title">{o.label}</span>
                  {o.rec && <span className="rec">Recommended</span>}
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
    </>
  )
}
