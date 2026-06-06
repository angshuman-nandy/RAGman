// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons/Icon'

export interface MenuItem {
  label: string
  icon?: string
  danger?: boolean
  onClick: () => void
}

interface DotMenuProps {
  items: MenuItem[]
}

export function DotMenu({ items }: DotMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        className="btn ghost sm icon-only"
        aria-label="More options"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <Icon name="more" size={16} />
      </button>

      {open && (
        <div className="menu" role="menu" onClick={(e) => e.stopPropagation()}>
          {items.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              className={item.danger ? 'danger' : ''}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
            >
              {item.icon && <Icon name={item.icon} size={14} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
