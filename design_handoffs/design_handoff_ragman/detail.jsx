// detail.jsx — agent detail page with Documents + Chat tabs

const fmtBytes = (b) => {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1024 / 1024).toFixed(1) + ' MB';
};

const FileTypePill = ({ type }) => {
  const map = { 'PDF': '#fb7185', 'Word': '#60a5fa', 'Markdown': '#a78bfa', 'Text': '#34d399' };
  return <div className="icon" style={{ color: map[type] || 'var(--text-dim)' }}>{type.slice(0, 4).toUpperCase()}</div>;
};

const DocumentsTab = ({ agent, onUpload, onDelete }) => {
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef(null);
  const [confirmDoc, setConfirmDoc] = React.useState(null);
  const handleFiles = (files) => {
    onUpload(Array.from(files).map(f => ({
      id: 'd' + Math.random().toString(36).slice(2, 8),
      name: f.name, type: 'PDF', status: 'ingest', chunks: null, uploaded: 'Just now',
    })));
  };
  return (
    <div>
      <div className={`dropzone ${drag ? 'drag' : ''}`}
        onDragEnter={e => { e.preventDefault(); setDrag(true); }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        style={{ cursor: 'pointer' }}>
        <div className="cloud"><Icon name="upload-cloud" size={26} stroke={1.7}/></div>
        <h4>Drop your files here or click to browse</h4>
        <p>We'll automatically ingest, chunk, embed, and index them.</p>
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
          accept=".pdf,.docx,.txt,.md"/>
        <div className="formats">
          <span className="chip">PDF</span>
          <span className="chip">DOCX</span>
          <span className="chip">TXT</span>
          <span className="chip">MD</span>
        </div>
      </div>

      {agent.documents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-faint)', fontSize: 13.5 }}>
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
            <div></div>
          </div>
          {agent.documents.map(d => (
            <div key={d.id} className={`doc-row ${d.status === 'failed' ? 'failed' : ''}`} title={d.error || ''}>
              <div className="filename">
                <FileTypePill type={d.type}/>
                <span className="name">{d.name}</span>
              </div>
              <div className="muted" data-l="Type">{d.type}</div>
              <div className="col-status"><StatusBadge status={d.status}/></div>
              <div className="muted" style={{ textAlign: 'right' }} data-l="Chunks">{d.chunks ?? '—'}</div>
              <div className="muted" data-l="Uploaded">{d.uploaded}</div>
              <div className="col-actions">
                <button className="btn ghost sm icon-only danger" onClick={() => setConfirmDoc(d)} aria-label="Delete">
                  <Icon name="trash" size={14}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!confirmDoc}
        onClose={() => setConfirmDoc(null)}
        title={`Delete "${confirmDoc?.name}"?`}
        body="This removes the embeddings for this document from the vector store. The original file is not affected."
        actions={<>
          <button className="btn subtle" onClick={() => setConfirmDoc(null)}>Cancel</button>
          <button className="btn primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={() => { onDelete(confirmDoc.id); setConfirmDoc(null); }}>Delete</button>
        </>}
      />
    </div>
  );
};

// ---------- Chat ----------

const SAMPLE_RESPONSES = [
  {
    text: "Based on the master services agreement, the standard payment terms are Net 30 from invoice date, with a 1.5% late fee per month on outstanding balances. The agreement also caps liability at the total fees paid in the trailing 12 months, except in cases of gross negligence or willful misconduct.",
    sources: [
      { n: 1, doc: 'master_services_agreement_v3.pdf', loc: 'page 4', quote: 'Customer shall pay all undisputed invoices within thirty (30) days of receipt…' },
      { n: 2, doc: 'master_services_agreement_v3.pdf', loc: 'page 12', quote: 'Liability shall not exceed the aggregate fees paid by Customer to Vendor in the twelve…' },
      { n: 3, doc: 'vendor_nda_acme.pdf', loc: 'page 2', quote: 'Notwithstanding the foregoing, this limitation shall not apply to claims arising from gross negligence…' },
    ],
  },
  {
    text: "The termination clause requires 60 days written notice for convenience termination by either party. For cause, the breaching party has 30 days to cure after written notice. Upon termination, all outstanding fees become immediately payable and the vendor must return or destroy confidential information within 14 days.",
    sources: [
      { n: 1, doc: 'master_services_agreement_v3.pdf', loc: 'page 8', quote: 'Either party may terminate this agreement for convenience upon sixty (60) days prior written notice…' },
      { n: 2, doc: 'master_services_agreement_v3.pdf', loc: 'page 9', quote: 'In the event of a material breach, the non-breaching party shall provide written notice…' },
    ],
  },
];

const ChatBubble = ({ msg }) => {
  if (msg.role === 'user') {
    return <div className="bubble-row user"><div className="bubble user">{msg.text}</div></div>;
  }
  return (
    <div className="bubble-row">
      <div className="avatar agent"><Icon name="bot" size={14} stroke={2.2}/></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={`bubble agent ${msg.error ? 'err' : ''}`}>
          <span className={msg.streaming ? 'typing' : ''}>{msg.text}</span>
        </div>
        {msg.sources && !msg.streaming && (
          <details className="sources">
            <summary>
              <Icon name="chevron-right" size={12} className="chev"/>
              Sources ({msg.sources.length})
            </summary>
            <div className="src-list">
              {msg.sources.map(s => (
                <div className="src" key={s.n}>
                  <div className="num">{s.n}</div>
                  <div className="body">
                    <div className="meta">{s.doc} {s.loc && `— ${s.loc}`}</div>
                    <div className="quote">"{s.quote}"</div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

const ChatTab = ({ agent }) => {
  const readyDocs = agent.documents.filter(d => d.status === 'ready');
  const canChat = readyDocs.length > 0;
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const streamRef = React.useRef(null);
  const taRef = React.useRef(null);

  React.useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    if (!input.trim() || streaming || !canChat) return;
    const q = input.trim();
    const userMsg = { id: Date.now(), role: 'user', text: q };
    const responseTemplate = SAMPLE_RESPONSES[messages.filter(m => m.role === 'agent').length % SAMPLE_RESPONSES.length];
    const agentId = Date.now() + 1;
    const agentMsg = { id: agentId, role: 'agent', text: '', streaming: true, sources: responseTemplate.sources };
    setMessages(m => [...m, userMsg, agentMsg]);
    setInput('');
    setStreaming(true);
    // Simulate token streaming
    const full = responseTemplate.text;
    let i = 0;
    const tick = () => {
      i += Math.max(1, Math.floor(Math.random() * 4));
      const chunk = full.slice(0, i);
      setMessages(ms => ms.map(m => m.id === agentId ? { ...m, text: chunk } : m));
      if (i < full.length) {
        setTimeout(tick, 18 + Math.random() * 22);
      } else {
        setMessages(ms => ms.map(m => m.id === agentId ? { ...m, streaming: false } : m));
        setStreaming(false);
      }
    };
    setTimeout(tick, 200);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const autosize = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(140, el.scrollHeight) + 'px';
    setInput(el.value);
  };

  const suggestions = [
    'What are the payment terms?',
    'How does the termination clause work?',
    'Summarise the liability cap.',
  ];

  return (
    <div className="chat-layout">
      <aside className="chat-sidebar">
        <h5>Indexed documents ({readyDocs.length})</h5>
        {readyDocs.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '4px 10px' }}>
            No ready documents yet. Upload some in the Documents tab.
          </div>
        ) : readyDocs.map(d => (
          <div className="doc-item" key={d.id}>
            <Icon name="file-text" size={14}/>
            <span className="name">{d.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{d.chunks}</span>
          </div>
        ))}
        <div style={{ marginTop: 18, padding: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
            <Icon name="sparkles" size={12}/> Pipeline
          </div>
          {window.PIPELINE_META.llm.options[agent.pipeline.llm.provider]?.label} · {agent.pipeline.llm.model}
        </div>
      </aside>

      <section className="chat-main">
        {messages.length === 0 ? (
          <div className="chat-stream">
            <div className="chat-empty">
              <div>
                <div className="icon-bubble"><Icon name="message" size={26} stroke={1.7}/></div>
                <h4>{canChat ? 'Ask anything about your documents' : 'Upload some documents first'}</h4>
                <p>{canChat
                  ? `${agent.name} has access to ${readyDocs.length} indexed ${readyDocs.length === 1 ? 'document' : 'documents'}.`
                  : 'Once at least one document finishes ingesting, you can start chatting.'}</p>
                {canChat && (
                  <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {suggestions.map(s => (
                      <button key={s} className="btn sm subtle" onClick={() => setInput(s)}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="chat-stream" ref={streamRef}>
            {messages.map(m => <ChatBubble key={m.id} msg={m}/>)}
          </div>
        )}

        <div className="chat-input">
          <div className="input-wrap">
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={autosize}
              onKeyDown={onKey}
              placeholder={canChat ? "Ask a question about your documents…" : "Upload documents first"}
              disabled={!canChat || streaming}/>
          </div>
          <button className="send" onClick={send} disabled={!input.trim() || streaming || !canChat} aria-label="Send">
            <Icon name="arrow-up" size={18} stroke={2.4}/>
          </button>
        </div>
      </section>
    </div>
  );
};

const AgentDetail = ({ agent, onBack, onEdit, onDelete, onUpdate }) => {
  const [tab, setTab] = React.useState('documents');
  const [confirmDel, setConfirmDel] = React.useState(false);

  const onUpload = (newDocs) => {
    onUpdate({ ...agent, documents: [...newDocs, ...agent.documents], docCount: agent.docCount + newDocs.length });
    // Simulate ingestion finishing after a bit
    newDocs.forEach((d, i) => {
      setTimeout(() => {
        onUpdate(prev => prev && prev.id === agent.id ? {
          ...prev,
          documents: prev.documents.map(doc => doc.id === d.id ? { ...doc, status: 'ready', chunks: Math.floor(50 + Math.random() * 200) } : doc),
          status: 'ready',
        } : prev);
      }, 2400 + i * 600);
    });
  };
  const onDeleteDoc = (id) => {
    const remaining = agent.documents.filter(d => d.id !== id);
    onUpdate({ ...agent, documents: remaining, docCount: remaining.length, status: remaining.length === 0 ? 'empty' : agent.status });
  };

  return (
    <main className="page">
      <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 16, marginLeft: -10 }}>
        <Icon name="arrow-back" size={14}/> All agents
      </button>

      <div className="detail-header">
        <div className="top">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1>{agent.name}</h1>
            <div className="desc">{agent.description}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn subtle sm hidden-mobile" onClick={onEdit}>
              <Icon name="edit" size={14}/> Edit
            </button>
            <button className="btn ghost sm icon-only only-mobile" onClick={onEdit} aria-label="Edit">
              <Icon name="edit" size={14}/>
            </button>
            <DotMenu items={[
              { icon: 'edit', label: 'Edit pipeline', onClick: onEdit },
              { sep: true },
              { icon: 'trash', label: 'Delete agent', onClick: () => setConfirmDel(true), danger: true },
            ]}/>
          </div>
        </div>
        <div className="chips">
          <StatusBadge status={agent.status}/>
          <PipelineChips pipeline={agent.pipeline}/>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>
          <Icon name="file-text" size={14}/> Documents
          <span className="count">{agent.documents.length}</span>
        </button>
        <button className={`tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>
          <Icon name="message" size={14}/> Chat
        </button>
      </div>

      {tab === 'documents' ? (
        <DocumentsTab agent={agent} onUpload={onUpload} onDelete={onDeleteDoc}/>
      ) : (
        <ChatTab agent={agent}/>
      )}

      <Modal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title={`Delete "${agent.name}"?`}
        body="This permanently removes the agent and all its embedded documents."
        actions={<>
          <button className="btn subtle" onClick={() => setConfirmDel(false)}>Cancel</button>
          <button className="btn primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={() => { onDelete(agent.id); setConfirmDel(false); }}>Delete</button>
        </>}
      />
    </main>
  );
};

window.AgentDetail = AgentDetail;
