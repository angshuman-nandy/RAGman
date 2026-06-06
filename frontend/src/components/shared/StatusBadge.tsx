// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
interface StatusBadgeProps {
  status: 'ready' | 'ingesting' | 'ingest' | 'failed' | 'empty' | 'pending'
}

const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  ready:     { cls: 'ready',  label: 'Ready' },
  ingest:    { cls: 'ingest', label: 'Ingesting' },
  ingesting: { cls: 'ingest', label: 'Ingesting' },
  pending:   { cls: 'ingest', label: 'Pending' },
  failed:    { cls: 'failed', label: 'Failed' },
  empty:     { cls: 'empty',  label: 'No documents' },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.empty
  return (
    <span className={`status ${s.cls}`}>
      <span className="dot" />
      {s.label}
    </span>
  )
}
