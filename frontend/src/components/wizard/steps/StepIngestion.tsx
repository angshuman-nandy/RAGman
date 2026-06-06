// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { PIPELINE_META } from '../../../data/pipeline'
import { Icon } from '../../icons/Icon'
import type { WizardForm } from '../../../types'

interface StepProps {
  form: WizardForm
  onChange: (patch: Partial<WizardForm>) => void
  onPipelinePatch: (patch: Partial<WizardForm['pipeline']>) => void
  errors: Record<string, string>
}

export function StepIngestion({ form, onPipelinePatch }: StepProps) {
  const opts = PIPELINE_META.ingestion.options

  return (
    <>
      <div className="step-head">
        <div className="kicker">Step 2 of 9 · Ingestion</div>
        <h2>What type of documents will this agent read?</h2>
        <p>You can change this later — choose the primary format for now.</p>
      </div>

      <div className="radio-cards col-2">
        {Object.entries(opts).map(([k, o]) => {
          const selected = form.pipeline.ingestion.type === k
          return (
            <button
              key={k}
              type="button"
              className={`radio-card${selected ? ' selected' : ''}`}
              onClick={() => onPipelinePatch({ ingestion: { type: k as WizardForm['pipeline']['ingestion']['type'] } })}
            >
              {o.icon && <div className="icon">{o.icon}</div>}
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
    </>
  )
}
