// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function Modal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onClose,
}: ModalProps) {
  const firstBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    // Focus the first button on open
    firstBtnRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()

      // Basic focus trap: Tab cycles within modal
      if (e.key === 'Tab') {
        const modal = document.getElementById('ragman-modal')
        if (!modal) return
        const focusable = modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        id="ragman-modal"
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="modal-title">{title}</h3>
        <p>{message}</p>
        <div className="actions">
          <button ref={firstBtnRef} className="btn subtle" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn primary${danger ? '' : ''}`}
            style={danger ? { background: 'var(--danger)', borderColor: 'var(--danger)' } : undefined}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
