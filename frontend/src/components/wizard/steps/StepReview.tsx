// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { Fragment } from 'react'
import { PIPELINE_META } from '../../../data/pipeline'
import type { WizardForm } from '../../../types'

const labelStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--text-faint)',
  fontWeight: 500,
  alignSelf: 'center',
}

const valueStyle: React.CSSProperties = {
  fontSize: 13.5,
  color: 'var(--text)',
}

interface StepProps {
  form: WizardForm
  onChange: (patch: Partial<WizardForm>) => void
  onPipelinePatch: (patch: Partial<WizardForm['pipeline']>) => void
  errors: Record<string, string>
}

function fmtParams(obj: Record<string, number> | null | undefined): string | null {
  if (!obj) return null
  const entries = Object.entries(obj)
  if (entries.length === 0) return null
  return ' · ' + entries.map(([k, v]) => `${k}: ${v}`).join(', ')
}

export function StepReview({ form }: StepProps) {
  const p = form.pipeline
  const m = PIPELINE_META

  const rows: Array<{ key: string; value: string; params: string | null }> = [
    {
      key: 'Ingestion',
      value: m.ingestion.options[p.ingestion.type]?.label ?? p.ingestion.type,
      params: null,
    },
    {
      key: 'Chunking',
      value: m.chunking.options[p.chunking.type]?.label ?? p.chunking.type,
      params: fmtParams(p.chunking.params),
    },
    {
      key: 'Embedding',
      value: `${m.embedding.options[p.embedding.provider]?.label ?? p.embedding.provider} · ${p.embedding.model}`,
      params: null,
    },
    {
      key: 'Vector Store',
      value: m.vector_store.options[p.vector_store.type]?.label ?? p.vector_store.type,
      params: null,
    },
    {
      key: 'Retriever',
      value: m.retriever.options[p.retriever.type]?.label ?? p.retriever.type,
      params: fmtParams(p.retriever.params),
    },
    {
      key: 'Reranker',
      value: p.reranker ? (m.reranker.options[p.reranker.type]?.label ?? p.reranker.type) : '—',
      params: p.reranker ? fmtParams(p.reranker.params) : null,
    },
    {
      key: 'LLM',
      value: `${m.llm.options[p.llm.provider]?.label ?? p.llm.provider} · ${p.llm.model}`,
      params: fmtParams(p.llm.params),
    },
  ]

  return (
    <>
      <div className="step-head">
        <div className="kicker">Step 11 of 11</div>
        <h2>Review &amp; save</h2>
        <p>Confirm your pipeline. You can edit any step later from the agent's settings.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Agent card */}
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Agent
          </div>
          <div className="card pad">
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {form.name || (
                <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>
                  Untitled agent
                </span>
              )}
            </div>
            {form.description && (
              <div style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
                {form.description}
              </div>
            )}
          </div>
        </div>

        {/* Pipeline summary table */}
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Pipeline configuration
          </div>
          <div className="summary-table">
            {rows.map(row => (
              <Fragment key={row.key}>
                <div className="k">{row.key}</div>
                <div className="v">
                  {row.value}
                  {row.params && <span className="params">{row.params}</span>}
                </div>
              </Fragment>
            ))}

            {/* System Prompt row */}
            <div style={labelStyle}>System Prompt</div>
            <div style={valueStyle}>
              {form.pipeline.system_prompt?.content
                ? `${form.pipeline.system_prompt.mode === 'replace' ? 'Replace' : 'Append'} · ${form.pipeline.system_prompt.content.slice(0, 60)}${form.pipeline.system_prompt.content.length > 60 ? '…' : ''}`
                : <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Default</span>
              }
            </div>

            {/* Guardrails row */}
            <div style={labelStyle}>Guardrails</div>
            <div style={valueStyle}>
              {form.pipeline.guardrails && (
                form.pipeline.guardrails.topic_restrictions ||
                form.pipeline.guardrails.forbidden_content?.length ||
                form.pipeline.guardrails.format_rules ||
                form.pipeline.guardrails.confidence_threshold > 0
              )
                ? 'Enabled'
                : <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>—</span>
              }
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
