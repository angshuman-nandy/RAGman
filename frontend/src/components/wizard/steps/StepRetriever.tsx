// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { PIPELINE_META } from '../../../data/pipeline'
import { Icon } from '../../icons/Icon'
import type { WizardForm, RetrieverType } from '../../../types'

interface StepProps {
  form: WizardForm
  onChange: (patch: Partial<WizardForm>) => void
  onPipelinePatch: (patch: Partial<WizardForm['pipeline']>) => void
  errors: Record<string, string>
}

export function StepRetriever({ form, onPipelinePatch }: StepProps) {
  const opts = PIPELINE_META.retriever.options
  const current = form.pipeline.retriever

  const setRet = (patch: Partial<WizardForm['pipeline']['retriever']>) => {
    onPipelinePatch({ retriever: { ...current, ...patch } })
  }

  const setParam = (patch: Record<string, number>) => {
    setRet({ params: { ...current.params, ...patch } })
  }

  return (
    <>
      <div className="step-head">
        <div className="kicker">Step 6 of 9 · Retriever</div>
        <h2>How should relevant chunks be found at query time?</h2>
        <p>The retrieval strategy decides which chunks get passed to the LLM as context.</p>
      </div>

      <div className="radio-cards">
        {Object.entries(opts).map(([k, o]) => {
          const selected = current.type === k
          return (
            <button
              key={k}
              type="button"
              className={`radio-card${selected ? ' selected' : ''}`}
              onClick={() => setRet({ type: k as RetrieverType })}
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

      <details className="advanced" open>
        <summary>
          <Icon name="chevron-right" size={14} className="chev" />
          Advanced parameters
        </summary>
        <div className="grid">
          <div className="field">
            <label>
              Top K{' '}
              <span style={{ color: 'var(--text-faint)' }}>· chunks</span>
            </label>
            <input
              type="number"
              value={current.params?.top_k ?? 5}
              onChange={e => setParam({ top_k: +e.target.value })}
            />
          </div>

          {current.type === 'hybrid' && (
            <div className="field">
              <label>BM25 weight</label>
              <div className="slider-row">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={current.params?.bm25_weight ?? 0.3}
                  onChange={e => setParam({ bm25_weight: +e.target.value })}
                />
                <span className="num">
                  {(current.params?.bm25_weight ?? 0.3).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {current.type === 'mmr' && (
            <div className="field">
              <label>λ (diversity vs relevance)</label>
              <div className="slider-row">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={current.params?.lambda_mult ?? 0.5}
                  onChange={e => setParam({ lambda_mult: +e.target.value })}
                />
                <span className="num">
                  {(current.params?.lambda_mult ?? 0.5).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {current.type === 'multi_query' && (
            <div className="field">
              <label>Number of query variants</label>
              <input
                type="number"
                value={current.params?.num_queries ?? 3}
                onChange={e => setParam({ num_queries: +e.target.value })}
              />
            </div>
          )}
        </div>
      </details>
    </>
  )
}
