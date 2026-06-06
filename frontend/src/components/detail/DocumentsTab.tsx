// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import { Icon } from '../icons/Icon'
import { StatusBadge } from '../shared/StatusBadge'
import { Modal } from '../shared/Modal'
import { IngestionProgress } from './IngestionProgress'
import { useUploadDocuments, useDeleteDocument } from '../../api/documents'
import type { Agent, Document, DocumentListResponse } from '../../types'

export interface DocumentsTabProps {
  agent: Agent
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md']

function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? '.' + parts[parts.length - 1] : ''
}

function fileTypeLabel(fileType: string): string {
  const map: Record<string, string> = {
    pdf: 'PDF',
    docx: 'WORD',
    txt: 'TXT',
    md: 'MD',
  }
  return map[fileType.toLowerCase()] ?? fileType.slice(0, 4).toUpperCase()
}

function fileTypePillColor(fileType: string): string {
  const map: Record<string, string> = {
    pdf: '#fb7185',
    docx: '#60a5fa',
    md: '#a78bfa',
    txt: '#34d399',
  }
  return map[fileType.toLowerCase()] ?? 'var(--text-dim)'
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return iso
  }
}

function FileTypePill({ type }: { type: string }) {
  return (
    <div
      className="icon"
      style={{ color: fileTypePillColor(type) }}
    >
      {fileTypeLabel(type)}
    </div>
  )
}

export function DocumentsTab({ agent }: DocumentsTabProps) {
  const [drag, setDrag] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [confirmDoc, setConfirmDoc] = useState<Document | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Use useQuery directly so we can set a dynamic refetchInterval:
  // poll every 3 s while any document is pending/ingesting, pause otherwise.
  const { data } = useQuery<DocumentListResponse>({
    queryKey: ['agents', agent.id, 'documents'],
    queryFn: () => apiFetch<DocumentListResponse>(`/agents/${agent.id}/documents`),
    enabled: Boolean(agent.id),
    refetchOnMount: 'always',
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      const anyIngesting = items.some(
        (d) => d.status === 'pending' || d.status === 'ingesting',
      )
      return anyIngesting ? 3000 : false
    },
  })

  const documents = [...(data?.items ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  // Keep selectedDoc in sync with fresh polling data
  useEffect(() => {
    if (selectedDoc && documents.length > 0) {
      const fresh = documents.find((d) => d.id === selectedDoc.id)
      if (fresh) setSelectedDoc(fresh)
    }
  }, [documents]) // eslint-disable-line react-hooks/exhaustive-deps

  const uploadMutation = useUploadDocuments(agent.id)
  const deleteMutation = useDeleteDocument(agent.id)

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setUploadError(null)

    const files = Array.from(fileList)
    const invalid = files.filter(
      (f) => !ACCEPTED_EXTENSIONS.includes(getFileExtension(f.name)),
    )

    if (invalid.length > 0) {
      setUploadError(
        `Unsupported file type${invalid.length > 1 ? 's' : ''}: ${invalid.map((f) => f.name).join(', ')}. Accepted: PDF, DOCX, TXT, MD.`,
      )
      return
    }

    uploadMutation.mutate(files)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDrag(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDrag(true)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDrag(true)
  }

  const handleDragLeave = () => {
    setDrag(false)
  }

  const handleDeleteConfirm = () => {
    if (!confirmDoc) return
    deleteMutation.mutate({ docId: confirmDoc.id })
    setConfirmDoc(null)
  }

  return (
    <div>
      {/* Dropzone */}
      <div
        className={`dropzone${drag ? ' drag' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{ cursor: 'pointer' }}
      >
        <div className="cloud">
          <Icon name="upload-cloud" size={26} strokeWidth={1.7} />
        </div>
        <h4>Drop your files here or click to browse</h4>
        <p>We'll automatically ingest, chunk, embed, and index them.</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => handleFiles(e.target.files)}
          // Reset value so the same file can be re-uploaded after deletion
          onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
        />
        <div className="formats">
          <span className="chip">PDF</span>
          <span className="chip">DOCX</span>
          <span className="chip">TXT</span>
          <span className="chip">MD</span>
        </div>
      </div>

      {/* Upload / validation error */}
      {uploadError && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 12px',
            background: 'var(--danger-soft)',
            border: '1px solid rgba(239,68,68,.3)',
            borderRadius: 8,
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          {uploadError}
        </div>
      )}

      {uploadMutation.isError && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 12px',
            background: 'var(--danger-soft)',
            border: '1px solid rgba(239,68,68,.3)',
            borderRadius: 8,
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          Upload failed: {uploadMutation.error?.message ?? 'Unknown error'}
        </div>
      )}

      {/* Document table / empty state */}
      {documents.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            color: 'var(--text-faint)',
            fontSize: 13.5,
          }}
        >
          No documents yet. Drop files above to get started.
        </div>
      ) : (
        <div className="doc-table">
          <div className="doc-table-head">
            <div>Filename</div>
            <div>Type</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Chunks</div>
            <div>Uploaded</div>
            <div />
          </div>

          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`doc-row${doc.status === 'failed' ? ' failed' : ''}`}
              title={doc.error_message ?? undefined}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/agents/${agent.id}/documents/${doc.id}`)}
            >
              <div className="filename">
                <FileTypePill type={doc.file_type} />
                <span className="name">{doc.filename}</span>
              </div>
              <div className="muted" data-l="Type">
                {fileTypeLabel(doc.file_type)}
              </div>
              <div className="col-status">
                <StatusBadge status={doc.status} />
              </div>
              <div
                className="muted"
                style={{ textAlign: 'right' }}
                data-l="Chunks"
              >
                {doc.chunk_count ?? '—'}
              </div>
              <div className="muted" data-l="Uploaded">
                {fmtDate(doc.created_at)}
              </div>
              <div className="col-actions" style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn ghost sm icon-only"
                  title="View ingestion progress"
                  aria-label="View ingestion progress"
                  onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc) }}
                >
                  <Icon name="list" size={14} />
                </button>
                <button
                  className="btn ghost sm icon-only danger"
                  onClick={(e) => { e.stopPropagation(); setConfirmDoc(doc) }}
                  aria-label="Delete document"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={!!confirmDoc}
        onClose={() => setConfirmDoc(null)}
        title={`Delete "${confirmDoc?.filename}"?`}
        message="This removes the embeddings for this document from the vector store. The original file is not affected."
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteConfirm}
      />

      {/* Ingestion progress modal */}
      {selectedDoc && (
        <IngestionProgress
          doc={selectedDoc}
          open={true}
          onClose={() => setSelectedDoc(null)}
        />
      )}
    </div>
  )
}
