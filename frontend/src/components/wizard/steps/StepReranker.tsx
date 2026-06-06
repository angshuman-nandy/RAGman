// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { PIPELINE_META } from '../../../data/pipeline'
import { Icon } from '../../icons/Icon'
import { useCapabilities } from '../../../api/capabilities'
import type { WizardForm, RerankerType } from '../../../types'

interface StepProps {
  form: WizardForm
  onChange: (patch: Partial<WizardForm>) => void
  onPipelinePatch: (patch: Partial<WizardForm['pipeline']>) => void
  errors: Record<string, string>
}

export function StepReranker({ form, onPipelinePatch }: StepProps) {
  const opts = PIPELINE_META.reranker.options
  const enabled = !!form.pipeline.reranker
  const current = form.pipeline.reranker
  const { data: capabilities } = useCapabilities()

  const setRR = (val: WizardForm['pipeline']['reranker']) => {
    onPipelinePatch({ reranker: val })
  }

  const toggle = () => {
    if (enabled) {
      setRR(null)
    } else {
      const defaultType = capabilities && !capabilities.cohere ? 'huggingface' : 'cohere'
      setRR({
        type: defaultType as RerankerType,
        params: { top_n: form.pipeline.retriever.params?.top_k ?? 5 },
      })
    }
  }

  return (
    <>
      <div className="step-head">
        <div className="kicker">Step 7 of 9 · Reranker (optional)</div>
        <h2>Re-score retrieved chunks for better answers?</h2>
        <p>Reranking adds latency but typically improves answer quality on tough queries.</p>
      </div>

      <div
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
          <div style={{ fontSize: 14, fontWeight: 500 }}>Include a reranker</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>
            {enabled
              ? 'A reranking step will run after retrieval.'
              : 'Skip this step — chunks pass straight to the LLM.'}
          </div>
        </div>
      </div>

      {enabled && current && (
        <>
          <div className="radio-cards" style={{ marginTop: 18 }}>
            {Object.entries(opts).map(([k, o]) => {
              const selected = current.type === k
              const keyMissing = k === 'cohere' && capabilities && !capabilities.cohere
              return (
                <button
                  key={k}
                  type="button"
                  className={`radio-card${selected ? ' selected' : ''}`}
                  onClick={() => !keyMissing && setRR({ ...current, type: k as RerankerType })}
                  aria-disabled={keyMissing || undefined}
                  data-tooltip={keyMissing ? 'API KEY NOT CONFIGURED' : undefined}
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

          <details className="advanced" open>
            <summary>
              <Icon name="chevron-right" size={14} className="chev" />
              Advanced parameters
            </summary>
            <div className="grid">
              <div className="field">
                <label>
                  Top N{' '}
                  <span style={{ color: 'var(--text-faint)' }}>· chunks after rerank</span>
                </label>
                <input
                  type="number"
                  value={current.params?.top_n ?? form.pipeline.retriever.params?.top_k ?? 5}
                  onChange={e =>
                    setRR({ ...current, params: { ...current.params, top_n: +e.target.value } })
                  }
                />
              </div>
            </div>
          </details>
        </>
      )}
    </>
  )
}
