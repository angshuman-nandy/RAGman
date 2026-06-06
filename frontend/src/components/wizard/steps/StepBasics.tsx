// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { Icon } from '../../icons/Icon'
import type { WizardForm } from '../../../types'

interface StepProps {
  form: WizardForm
  onChange: (patch: Partial<WizardForm>) => void
  onPipelinePatch: (patch: Partial<WizardForm['pipeline']>) => void
  errors: Record<string, string>
}

export function StepBasics({ form, onChange, errors }: StepProps) {
  return (
    <>
      <div className="step-head">
        <div className="kicker">Step 1 of 9</div>
        <h2>Start with the basics</h2>
        <p>Give your agent a name and a short description of what it does.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="field">
          <label>Agent name</label>
          <input
            type="text"
            placeholder="e.g. Legal Contract Reader"
            value={form.name}
            onChange={e => onChange({ name: e.target.value })}
            autoFocus
          />
          {errors.name && (
            <div className="err">
              <Icon name="alert" size={12} />
              {errors.name}
            </div>
          )}
        </div>

        <div className="field">
          <label>
            Description{' '}
            <span style={{ color: 'var(--text-faint)' }}>· optional</span>
          </label>
          <textarea
            placeholder="What kinds of documents will it read, and what should it help with?"
            value={form.description}
            onChange={e => onChange({ description: e.target.value })}
          />
        </div>
      </div>
    </>
  )
}
