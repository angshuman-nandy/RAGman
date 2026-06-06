// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { Icon } from '../icons/Icon'
import type { StepMeta } from '../../data/pipeline'

interface StepperProps {
  steps: StepMeta[]
  currentIdx: number
  onJump: (idx: number) => void
  freeJump?: boolean
}

export function Stepper({ steps, currentIdx, onJump, freeJump = false }: StepperProps) {
  const current = steps[currentIdx]

  return (
    <>
      {/* Desktop vertical stepper */}
      <nav className="stepper" aria-label="Wizard steps">
        {steps.map((s, i) => {
          const isDone = i < currentIdx
          const isActive = i === currentIdx
          const canJump = freeJump || i <= currentIdx
          return (
            <div
              key={s.key}
              className={`step${isActive ? ' active' : ''}${isDone ? ' done' : ''}${!canJump ? ' disabled' : ''}`}
              onClick={() => canJump && onJump(i)}
              role="button"
              aria-current={isActive ? 'step' : undefined}
              tabIndex={canJump ? 0 : -1}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && canJump) onJump(i)
              }}
            >
              <span className="num">
                {isDone
                  ? <Icon name="check" size={11} strokeWidth={3} />
                  : i + 1
                }
              </span>
              <span>{s.label}</span>
              {s.optional && <span className="opt">Optional</span>}
            </div>
          )
        })}
      </nav>

      {/* Mobile compact bar */}
      <div className="wizard-mobile-stepper">
        <button
          className="btn ghost sm icon-only"
          onClick={() => currentIdx > 0 && onJump(currentIdx - 1)}
          disabled={currentIdx === 0}
          aria-label="Previous step"
        >
          <Icon name="arrow-left" size={16} />
        </button>
        <div className="center">
          <div className="label">Step {currentIdx + 1} of {steps.length}</div>
          <div className="title">{current.label}{current.optional ? ' · Optional' : ''}</div>
        </div>
        <button
          className="btn ghost sm icon-only"
          onClick={() => currentIdx < steps.length - 1 && onJump(currentIdx + 1)}
          disabled={currentIdx === steps.length - 1}
          aria-label="Next step"
        >
          <Icon name="arrow-right" size={16} />
        </button>
      </div>

      {/* Mobile progress bar */}
      <div className="wizard-progress" style={{ marginBottom: 14 }}>
        {steps.map((_, i) => (
          <span
            key={i}
            className={`seg${i < currentIdx ? ' done' : i === currentIdx ? ' active' : ''}`}
          />
        ))}
      </div>
    </>
  )
}
