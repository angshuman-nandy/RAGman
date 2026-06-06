// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { PIPELINE_META } from '../../../data/pipeline'
import { Icon } from '../../icons/Icon'
import type { WizardForm, LLMProvider } from '../../../types'

interface StepProps {
  form: WizardForm
  onChange: (patch: Partial<WizardForm>) => void
  onPipelinePatch: (patch: Partial<WizardForm['pipeline']>) => void
  errors: Record<string, string>
}

export function StepLLM({ form, onPipelinePatch }: StepProps) {
  const opts = PIPELINE_META.llm.options
  const current = form.pipeline.llm

  const setLLM = (patch: Partial<WizardForm['pipeline']['llm']>) => {
    onPipelinePatch({ llm: { ...current, ...patch } })
  }

  const setParam = (patch: Record<string, number>) => {
    setLLM({ params: { ...current.params, ...patch } })
  }

  return (
    <>
      <div className="step-head">
        <div className="kicker">Step 8 of 9 · LLM</div>
        <h2>Which model will generate the final answer?</h2>
        <p>The retrieved chunks are passed to this model along with the user's question.</p>
      </div>

      <div className="radio-cards">
        {Object.entries(opts).map(([k, o]) => {
          const selected = current.provider === k
          return (
            <button
              key={k}
              type="button"
              className={`radio-card${selected ? ' selected' : ''}`}
              onClick={() => setLLM({ provider: k as LLMProvider, model: o.default ?? '' })}
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
          onChange={e => setLLM({ model: e.target.value })}
        />
        <div className="hint">
          Default:{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
            {opts[current.provider]?.default}
          </code>
        </div>
      </div>

      <details className="advanced" open>
        <summary>
          <Icon name="chevron-right" size={14} className="chev" />
          Advanced parameters
        </summary>
        <div className="grid">
          <div className="field">
            <label>Temperature</label>
            <div className="slider-row">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={current.params?.temperature ?? 0.3}
                onChange={e => setParam({ temperature: +e.target.value })}
              />
              <span className="num">
                {(current.params?.temperature ?? 0.3).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="field">
            <label>Max tokens</label>
            <input
              type="number"
              value={current.params?.max_tokens ?? 1024}
              onChange={e => setParam({ max_tokens: +e.target.value })}
            />
          </div>
        </div>
      </details>
    </>
  )
}
