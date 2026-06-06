// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Icon } from '../icons/Icon'
import { streamQuery } from '../../api/stream'
import { PIPELINE_META } from '../../data/pipeline'
import type { Agent, Document } from '../../types'

export interface ChatTabProps {
  agent: Agent
  documents: Document[]
}

interface Source {
  content: string
  metadata: Record<string, unknown>
  score: number
}

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  streaming?: boolean
  sources?: Source[]
  error?: boolean
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const SUGGESTIONS = [
  'What are the main topics covered in these documents?',
  'Summarise the key points.',
  'What are the most important findings?',
]

function ChatBubble({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return (
      <div className="bubble-row user">
        <div className="bubble user">{msg.content}</div>
      </div>
    )
  }

  return (
    <div className="bubble-row">
      {/* 30×30 gradient avatar */}
      <div
        className="avatar agent"
        style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0 }}
      >
        <Icon name="bot" size={14} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={`bubble agent${msg.error ? ' err' : ''}`}>
          {msg.error ? (
            msg.content
          ) : (
            <div className="md-body">
              <ReactMarkdown>{msg.streaming ? msg.content + ' ▊' : msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {msg.sources && msg.sources.length > 0 && !msg.streaming && (
          <details className="sources">
            <summary>
              <Icon name="chevron-right" size={12} className="chev" />
              Sources ({msg.sources.length})
            </summary>
            <div className="src-list">
              {msg.sources.map((s, i) => (
                <div className="src" key={i}>
                  <div className="num">{i + 1}</div>
                  <div className="body">
                    <div className="meta">
                      {typeof s.metadata?.source === 'string'
                        ? s.metadata.source
                        : `Source ${i + 1}`}
                      {typeof s.metadata?.page === 'number'
                        ? ` — page ${s.metadata.page}`
                        : ''}
                      {typeof s.score === 'number'
                        ? ` (score: ${s.score.toFixed(2)})`
                        : ''}
                    </div>
                    <div className="quote">"{s.content.slice(0, 200)}{s.content.length > 200 ? '…' : ''}"</div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

export function ChatTab({ agent, documents }: ChatTabProps) {
  const readyDocs = documents.filter((d) => d.status === 'ready')
  const canChat = readyDocs.length > 0

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const activeDocIds = selectedDocIds.size > 0 ? [...selectedDocIds] : undefined

  const taRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const question = input.trim()
    if (!question || isStreaming || !canChat) return

    setInput('')

    // Reset textarea height
    if (taRef.current) {
      taRef.current.style.height = 'auto'
    }

    setIsStreaming(true)

    const userMsg: Message = { id: uid(), role: 'user', content: question }
    const agentMsgId = uid()
    const agentMsg: Message = {
      id: agentMsgId,
      role: 'agent',
      content: '',
      streaming: true,
    }

    setMessages((prev) => [...prev, userMsg, agentMsg])

    await streamQuery(
      agent.id,
      question,
      (token) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId ? { ...m, content: m.content + token } : m,
          ),
        )
      },
      () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId ? { ...m, streaming: false } : m,
          ),
        )
        setIsStreaming(false)
      },
      (error) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? { ...m, content: error, streaming: false, error: true }
              : m,
          ),
        )
        setIsStreaming(false)
      },
      activeDocIds,
    )
  }, [input, isStreaming, canChat, agent.id, activeDocIds])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(140, el.scrollHeight) + 'px'
    setInput(el.value)
  }

  const llmLabel =
    PIPELINE_META.llm.options[agent.pipeline.llm.provider]?.label ??
    agent.pipeline.llm.provider

  return (
    <div className="chat-layout">
      {/* Sidebar — hidden on mobile via CSS */}
      <aside className="chat-sidebar">
        <h5>
          {selectedDocIds.size > 0
            ? `${selectedDocIds.size} of ${readyDocs.length} selected`
            : `Indexed documents (${readyDocs.length})`}
          {selectedDocIds.size > 0 && (
            <button
              className="btn ghost sm"
              onClick={() => setSelectedDocIds(new Set())}
              style={{ marginLeft: 6, padding: '0 6px', height: 22, fontSize: 11 }}
            >
              All
            </button>
          )}
        </h5>
        {readyDocs.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-faint)',
              padding: '4px 10px',
            }}
          >
            No ready documents yet. Upload some in the Documents tab.
          </div>
        ) : (
          readyDocs.map((d) => {
            const isSelected = selectedDocIds.has(d.id)
            return (
              <div
                className={`doc-item${isSelected ? ' selected' : ''}`}
                key={d.id}
                onClick={() => toggleDoc(d.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleDoc(d.id) }}
                title={isSelected ? 'Click to deselect' : 'Click to filter chat to this doc'}
              >
                <Icon name="file-text" size={14} />
                <span className="name">{d.filename}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-faint)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {d.chunk_count ?? ''}
                </span>
              </div>
            )
          })
        )}

        {/* Pipeline panel */}
        <div
          style={{
            marginTop: 18,
            padding: 12,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 12,
            color: 'var(--text-dim)',
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text)',
              fontWeight: 500,
              marginBottom: 4,
            }}
          >
            <Icon name="sparkles" size={12} /> Pipeline
          </div>
          {llmLabel} · {agent.pipeline.llm.model}
        </div>
      </aside>

      {/* Chat main */}
      <section className="chat-main">
        {messages.length === 0 ? (
          <div className="chat-stream">
            <div className="chat-empty">
              <div>
                <div className="icon-bubble">
                  <Icon name="message" size={26} strokeWidth={1.7} />
                </div>
                <h4>
                  {canChat
                    ? 'Ask anything about your documents'
                    : 'Upload some documents first'}
                </h4>
                <p>
                  {canChat
                    ? selectedDocIds.size > 0
                      ? `Searching ${selectedDocIds.size} selected ${selectedDocIds.size === 1 ? 'document' : 'documents'}.`
                      : `${agent.name} has access to ${readyDocs.length} indexed ${readyDocs.length === 1 ? 'document' : 'documents'}.`
                    : 'Once at least one document finishes ingesting, you can start chatting.'}
                </p>
                {canChat && (
                  <div
                    style={{
                      marginTop: 22,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      justifyContent: 'center',
                    }}
                  >
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        className="btn sm subtle"
                        onClick={() => setInput(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="chat-stream">
            {messages.map((m) => (
              <ChatBubble key={m.id} msg={m} />
            ))}
            {/* Invisible anchor for auto-scroll */}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input area */}
        <div className="chat-input">
          <div className="input-wrap">
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={
                canChat
                  ? 'Ask a question about your documents…'
                  : 'Upload documents first'
              }
              disabled={!canChat || isStreaming}
            />
          </div>
          <button
            className="send"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isStreaming || !canChat}
            aria-label="Send"
          >
            <Icon name="arrow-up" size={18} strokeWidth={2.4} />
          </button>
        </div>
      </section>
    </div>
  )
}
