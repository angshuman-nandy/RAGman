// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState } from 'react'
import { Icon } from '../icons/Icon'
import { Stepper } from './Stepper'
import { StepBasics } from './steps/StepBasics'
import { StepIngestion } from './steps/StepIngestion'
import { StepChunking } from './steps/StepChunking'
import { StepEmbedding } from './steps/StepEmbedding'
import { StepVectorStore } from './steps/StepVectorStore'
import { StepRetriever } from './steps/StepRetriever'
import { StepReranker } from './steps/StepReranker'
import { StepLLM } from './steps/StepLLM'
import { StepSystemPrompt } from './steps/StepSystemPrompt'
import { StepGuardrails } from './steps/StepGuardrails'
import { StepReview } from './steps/StepReview'
import { STEPS, DEFAULT_PIPELINE } from '../../data/pipeline'
import type { WizardForm, PipelineConfig } from '../../types'

export interface WizardProps {
  mode: 'new' | 'edit'
  initial: WizardForm | null
  onSave: (form: WizardForm) => Promise<void>
  onCancel: () => void
}

const EDIT_EXCLUDED = new Set(['system_prompt', 'guardrails'])

export function Wizard({ mode, initial, onSave, onCancel }: WizardProps) {
  const [form, setForm] = useState<WizardForm>(() =>
    initial ?? { name: '', description: '', pipeline: { ...DEFAULT_PIPELINE } }
  )
  const [stepIdx, setStepIdx] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const activeSteps = mode === 'edit' ? STEPS.filter(s => !EDIT_EXCLUDED.has(s.key)) : STEPS
  const step = activeSteps[stepIdx]

  // Shallow-merge top-level form fields
  const onChange = (patch: Partial<WizardForm>) => {
    setForm(f => ({ ...f, ...patch }))
  }

  // Merge a partial PipelineConfig into form.pipeline
  const onPipelinePatch = (patch: Partial<PipelineConfig>) => {
    setForm(f => ({ ...f, pipeline: { ...f.pipeline, ...patch } }))
  }

  // Validate the given step index and return any errors
  const validate = (idx: number): Record<string, string> => {
    if (idx === 0 && !form.name.trim()) {
      return { name: 'Give the agent a name to continue.' }
    }
    return {}
  }

  const goTo = (n: number) => {
    if (n === stepIdx) return
    if (n > stepIdx && mode !== 'edit') {
      const errs = validate(stepIdx)
      if (Object.keys(errs).length) {
        setErrors(errs)
        return
      }
    }
    setErrors({})
    setDirection(n > stepIdx ? 1 : -1)
    setStepIdx(n)
  }

  const next = () => goTo(Math.min(activeSteps.length - 1, stepIdx + 1))
  const prev = () => goTo(Math.max(0, stepIdx - 1))

  const handleSave = async () => {
    if (!form.name.trim()) {
      setSaveError('Give the agent a name before saving.')
      setStepIdx(0)
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      await onSave(form)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save agent.')
      setIsSaving(false)
    }
  }

  const isLastStep = stepIdx === activeSteps.length - 1

  const stepProps = { form, onChange, onPipelinePatch, errors, mode }

  const renderStep = () => {
    switch (step.key) {
      case 'basics':       return <StepBasics {...stepProps} />
      case 'ingestion':    return <StepIngestion {...stepProps} />
      case 'chunking':     return <StepChunking {...stepProps} />
      case 'embedding':    return <StepEmbedding {...stepProps} />
      case 'vector_store': return <StepVectorStore {...stepProps} />
      case 'retriever':    return <StepRetriever {...stepProps} />
      case 'reranker':     return <StepReranker {...stepProps} />
      case 'llm':          return <StepLLM {...stepProps} />
      case 'system_prompt': return <StepSystemPrompt {...stepProps} />
      case 'guardrails':    return <StepGuardrails {...stepProps} />
      case 'review':        return <StepReview {...stepProps} />
      default:             return null
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <button
            className="btn ghost sm"
            onClick={onCancel}
            style={{ marginBottom: 8, marginLeft: -10 }}
          >
            <Icon name="arrow-back" size={14} />
            Back to agents
          </button>
          <h1 className="title">{mode === 'edit' ? 'Edit agent' : 'New agent'}</h1>
          <div className="subtitle">Configure each pipeline stage. You can tune everything later.</div>
        </div>
      </div>

      <div className="wizard">
        {/* Left: desktop stepper + mobile bar (both rendered, CSS toggles visibility) */}
        <div>
          <Stepper steps={activeSteps} currentIdx={stepIdx} onJump={goTo} freeJump={mode === 'edit'} />
        </div>

        {/* Right: step panel */}
        <div>
          <div className="step-panel">
            <div
              key={stepIdx}
              className={direction > 0 ? 'step-anim-enter' : 'step-anim-enter-back'}
            >
              <div className="step-content">
                {renderStep()}
              </div>
            </div>

            <div className="wizard-nav">
              <button
                className="btn subtle"
                onClick={prev}
                disabled={stepIdx === 0}
              >
                <Icon name="arrow-left" size={14} />
                Back
              </button>

              <div
                style={{ fontSize: 12, color: 'var(--text-faint)' }}
                className="hidden-mobile"
              >
                {stepIdx + 1} of {activeSteps.length}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {!isLastStep && (
                  <button
                    className={`btn ${mode === 'edit' ? 'subtle' : 'primary'}`}
                    onClick={next}
                  >
                    Continue
                    <Icon name="arrow-right" size={14} />
                  </button>
                )}
                {(mode === 'edit' || isLastStep) && (
                  <button className="btn primary" onClick={handleSave} disabled={isSaving}>
                    <Icon name={isSaving ? 'loader' : 'check'} size={14} className={isSaving ? 'spin' : undefined} />
                    {isSaving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save agent'}
                  </button>
                )}
              </div>
            </div>
            {saveError && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  background: 'var(--danger-soft)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--danger)',
                  fontSize: 13,
                }}
              >
                {saveError}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default Wizard
