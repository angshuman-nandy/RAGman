// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { PIPELINE_META } from '../../../data/pipeline'
import { Icon } from '../../icons/Icon'
import type { WizardForm, ChunkingType } from '../../../types'

interface StepProps {
  form: WizardForm
  onChange: (patch: Partial<WizardForm>) => void
  onPipelinePatch: (patch: Partial<WizardForm['pipeline']>) => void
  errors: Record<string, string>
}

export function StepChunking({ form, onPipelinePatch }: StepProps) {
  const opts = PIPELINE_META.chunking.options
  const current = form.pipeline.chunking

  const setChunk = (patch: Partial<WizardForm['pipeline']['chunking']>) => {
    onPipelinePatch({ chunking: { ...current, ...patch } })
  }

  const setParam = (patch: Record<string, number>) => {
    setChunk({ params: { ...current.params, ...patch } })
  }

  return (
    <>
      <div className="step-head">
        <div className="kicker">Step 3 of 9 · Chunking</div>
        <h2>How should documents be split into pieces?</h2>
        <p>Chunks are the units retrieved at query time. Smaller chunks are more precise; larger ones give more context.</p>
      </div>

      <div className="radio-cards">
        {Object.entries(opts).map(([k, o]) => {
          const selected = current.type === k
          return (
            <button
              key={k}
              type="button"
              className={`radio-card${selected ? ' selected' : ''}`}
              onClick={() => setChunk({ type: k as ChunkingType })}
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
              Chunk size{' '}
              <span style={{ color: 'var(--text-faint)' }}>· chars</span>
            </label>
            <input
              type="number"
              value={current.params?.chunk_size ?? 500}
              onChange={e => setParam({ chunk_size: +e.target.value })}
            />
          </div>

          {current.type !== 'sentence_window' && (
            <div className="field">
              <label>
                Chunk overlap{' '}
                <span style={{ color: 'var(--text-faint)' }}>· chars</span>
              </label>
              <input
                type="number"
                value={current.params?.chunk_overlap ?? 50}
                onChange={e => setParam({ chunk_overlap: +e.target.value })}
              />
            </div>
          )}

          {current.type === 'semantic' && (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Similarity threshold</label>
              <div className="slider-row">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={current.params?.similarity_threshold ?? 0.7}
                  onChange={e => setParam({ similarity_threshold: +e.target.value })}
                />
                <span className="num">
                  {(current.params?.similarity_threshold ?? 0.7).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {current.type === 'sentence_window' && (
            <div className="field">
              <label>
                Window size{' '}
                <span style={{ color: 'var(--text-faint)' }}>· sentences</span>
              </label>
              <input
                type="number"
                value={current.params?.window_size ?? 3}
                onChange={e => setParam({ window_size: +e.target.value })}
              />
            </div>
          )}
        </div>
      </details>
    </>
  )
}
