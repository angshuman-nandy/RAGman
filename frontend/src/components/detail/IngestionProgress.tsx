// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useEffect } from 'react'
import { Icon } from '../icons/Icon'
import { StatusBadge } from '../shared/StatusBadge'
import type { Document, StepStatus } from '../../types'

interface IngestionProgressProps {
  doc: Document
  open: boolean
  onClose: () => void
}

const STEPS: Array<{
  key: string
  label: string
  sub: string
  icon: string
}> = [
  { key: 'ingestion',    label: 'Document parsing',  sub: 'Reading file contents',   icon: 'file-text' },
  { key: 'chunking',     label: 'Chunking',           sub: 'Splitting into chunks',   icon: 'scissors'  },
  { key: 'embedding',    label: 'Embedding',          sub: 'Generating vectors',      icon: 'layers'    },
  { key: 'vector_store', label: 'Storing vectors',    sub: 'Writing to vector store', icon: 'database'  },
]

function StepStatusIcon({ status }: { status: StepStatus | undefined }) {
  switch (status) {
    case 'completed':
      return (
        <Icon
          name="check-circle"
          size={20}
          strokeWidth={2}
          className="step-icon-completed"
        />
      )
    case 'in_progress':
      return (
        <Icon
          name="loader"
          size={20}
          strokeWidth={2}
          className="step-icon-spinning"
        />
      )
    case 'failed':
      return (
        <Icon
          name="alert"
          size={20}
          strokeWidth={2}
          className="step-icon-failed"
        />
      )
    default:
      // pending or undefined — grey circle outline
      return (
        <span
          style={{
            display: 'inline-block',
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '2px solid var(--border-strong)',
            flexShrink: 0,
          }}
        />
      )
  }
}

function stepIconColor(status: StepStatus | undefined): string {
  switch (status) {
    case 'completed': return 'var(--success)'
    case 'in_progress': return 'var(--warn)'
    case 'failed': return 'var(--danger)'
    default: return 'var(--text-faint)'
  }
}

export function IngestionProgress({ doc, open, onClose }: IngestionProgressProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const steps = doc.ingestion_steps ?? {}

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .step-icon-spinning {
          animation: spin 1s linear infinite;
          color: var(--warn);
        }
        .step-icon-completed {
          color: var(--success);
        }
        .step-icon-failed {
          color: var(--danger);
        }
      `}</style>

      <div
        className="modal-backdrop"
        onClick={onClose}
      >
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ingestion-modal-title"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '18px 20px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'var(--accent-soft)',
                border: '1px solid rgba(129,140,248,.25)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--accent)',
                flexShrink: 0,
              }}
            >
              <Icon name="file-text" size={18} strokeWidth={1.8} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                id="ingestion-modal-title"
                style={{
                  fontWeight: 600,
                  fontSize: 14.5,
                  letterSpacing: '-0.01em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--text)',
                }}
              >
                {doc.filename}
              </div>
              <div style={{ marginTop: 4 }}>
                <StatusBadge status={doc.status} />
              </div>
            </div>

            <button
              className="btn ghost sm icon-only"
              onClick={onClose}
              aria-label="Close"
              style={{ flexShrink: 0 }}
            >
              <Icon name="x" size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Step rows */}
          <div style={{ padding: '8px 0' }}>
            {STEPS.map((step, idx) => {
              const status: StepStatus | undefined = steps[step.key] as StepStatus | undefined
              const iconColor = stepIconColor(status)
              const isActive = status === 'in_progress'
              const isFailed = status === 'failed'

              return (
                <div
                  key={step.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 20px',
                    borderBottom: idx < STEPS.length - 1 ? '1px solid var(--border)' : 'none',
                    background: isActive
                      ? 'var(--warn-soft)'
                      : isFailed
                      ? 'var(--danger-soft)'
                      : 'transparent',
                    transition: 'background .2s ease',
                  }}
                >
                  {/* Step icon bubble */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      display: 'grid',
                      placeItems: 'center',
                      color: iconColor,
                      flexShrink: 0,
                      transition: 'color .2s ease',
                    }}
                  >
                    <Icon name={step.icon} size={16} strokeWidth={1.8} />
                  </div>

                  {/* Label + sub */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: 'var(--text)',
                        letterSpacing: '-0.005em',
                      }}
                    >
                      {step.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-faint)',
                        marginTop: 2,
                      }}
                    >
                      {step.sub}
                    </div>
                  </div>

                  {/* Status indicator */}
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <StepStatusIcon status={status} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer banner */}
          {doc.status === 'ready' && (
            <div
              style={{
                margin: '0 16px 16px',
                padding: '10px 14px',
                background: 'var(--success-soft)',
                border: '1px solid rgba(34,197,94,.25)',
                borderRadius: 'var(--r-md)',
                color: 'var(--success)',
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="check-circle" size={15} strokeWidth={2} />
              Ready — {doc.chunk_count ?? 0} chunk{doc.chunk_count !== 1 ? 's' : ''} indexed
            </div>
          )}

          {doc.status === 'failed' && doc.error_message && (
            <div
              style={{
                margin: '0 16px 16px',
                padding: '10px 14px',
                background: 'var(--danger-soft)',
                border: '1px solid rgba(239,68,68,.3)',
                borderRadius: 'var(--r-md)',
                color: 'var(--danger)',
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <span style={{ flexShrink: 0, paddingTop: 1 }}>
                <Icon name="alert" size={15} strokeWidth={2} />
              </span>
              <span style={{ wordBreak: 'break-word' }}>{doc.error_message}</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
