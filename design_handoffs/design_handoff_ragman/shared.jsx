// shared.jsx — chips, status badges, popovers used across screens

const StatusBadge = ({ status }) => {
  const map = {
    ready:  { cls: 'ready',  label: 'Ready' },
    ingest: { cls: 'ingest', label: 'Ingesting' },
    failed: { cls: 'failed', label: 'Failed' },
    empty:  { cls: 'empty',  label: 'No documents' },
  };
  const s = map[status] || map.empty;
  return (
    <span className={`status ${s.cls}`}>
      <span className="dot"></span>{s.label}
    </span>
  );
};

// Pipeline chips summary for cards/headers
const PipelineChips = ({ pipeline, max }) => {
  const meta = window.PIPELINE_META;
  const all = [
    { key: 'ingestion',    cls: meta.ingestion.chipClass,    label: meta.ingestion.options[pipeline.ingestion.type]?.label },
    { key: 'chunking',     cls: meta.chunking.chipClass,     label: meta.chunking.options[pipeline.chunking.type]?.label },
    { key: 'embedding',    cls: meta.embedding.chipClass,    label: meta.embedding.options[pipeline.embedding.provider]?.label },
    { key: 'vector_store', cls: meta.vector_store.chipClass, label: meta.vector_store.options[pipeline.vector_store.type]?.label },
    { key: 'retriever',    cls: meta.retriever.chipClass,    label: meta.retriever.options[pipeline.retriever.type]?.label },
  ];
  if (pipeline.reranker) {
    all.push({ key: 'reranker', cls: meta.reranker.chipClass, label: meta.reranker.options[pipeline.reranker.type]?.label });
  }
  all.push({ key: 'llm', cls: meta.llm.chipClass, label: meta.llm.options[pipeline.llm.provider]?.label });
  const shown = max ? all.slice(0, max) : all;
  const hidden = max ? all.length - max : 0;
  return (
    <>
      {shown.map(c => (
        <span key={c.key} className={`chip ${c.cls}`}>
          <span className="dot"></span>{c.label}
        </span>
      ))}
      {hidden > 0 && <span className="chip">+{hidden}</span>}
    </>
  );
};

const Modal = ({ open, onClose, title, body, actions }) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="actions">{actions}</div>
      </div>
    </div>
  );
};

// Click-away menu
const DotMenu = ({ items }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn ghost sm icon-only" onClick={e => { e.stopPropagation(); setOpen(o => !o); }} aria-label="More">
        <Icon name="more" size={16}/>
      </button>
      {open && (
        <div className="menu" onClick={e => e.stopPropagation()}>
          {items.map((it, i) => it.sep ? (
            <div className="sep" key={i}></div>
          ) : (
            <button key={i} className={it.danger ? 'danger' : ''} onClick={() => { setOpen(false); it.onClick(); }}>
              <Icon name={it.icon} size={14}/> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { StatusBadge, PipelineChips, Modal, DotMenu });
