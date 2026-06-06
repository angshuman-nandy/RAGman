// wizard.jsx — multi-step pipeline configurator

const RadioCard = ({ selected, onClick, icon, title, sub, rec }) => (
  <button type="button" className={`radio-card ${selected ? 'selected' : ''}`} onClick={onClick}>
    {icon && <div className="icon">{icon}</div>}
    <div className="text">
      <div className="title-row">
        <span className="title">{title}</span>
        {rec && <span className="rec">Recommended</span>}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </div>
    <div className="check">
      {selected && <Icon name="check" size={12} stroke={3}/>}
    </div>
  </button>
);

// ---------- Step components ----------

const StepHead = ({ kicker, title, subtitle }) => (
  <div className="step-head">
    <div className="kicker">{kicker}</div>
    <h2>{title}</h2>
    {subtitle && <p>{subtitle}</p>}
  </div>
);

const BasicsStep = ({ form, set, err }) => (
  <>
    <StepHead kicker="Step 1 of 9" title="Start with the basics" subtitle="Give your agent a name and a short description of what it does."/>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="field">
        <label>Agent name</label>
        <input type="text" placeholder="e.g. Legal Contract Reader" value={form.name}
          onChange={e => set({ name: e.target.value })} autoFocus/>
        {err?.name && <div className="err"><Icon name="alert" size={12}/>{err.name}</div>}
      </div>
      <div className="field">
        <label>Description <span style={{ color: 'var(--text-faint)' }}>· optional</span></label>
        <textarea placeholder="What kinds of documents will it read, and what should it help with?"
          value={form.description} onChange={e => set({ description: e.target.value })}/>
      </div>
    </div>
  </>
);

const IngestionStep = ({ form, set }) => {
  const opts = window.PIPELINE_META.ingestion.options;
  return (
    <>
      <StepHead kicker="Step 2 of 9 · Ingestion" title="What type of documents will this agent read?" subtitle="You can change this later — choose the primary format for now."/>
      <div className="radio-cards col-2">
        {Object.entries(opts).map(([k, o]) => (
          <RadioCard key={k} selected={form.pipeline.ingestion.type === k}
            onClick={() => set({ pipeline: { ...form.pipeline, ingestion: { type: k } } })}
            icon={o.icon} title={o.label} sub={o.sub}/>
        ))}
      </div>
    </>
  );
};

const ChunkingStep = ({ form, set }) => {
  const opts = window.PIPELINE_META.chunking.options;
  const current = form.pipeline.chunking;
  const setChunk = (patch) => set({ pipeline: { ...form.pipeline, chunking: { ...current, ...patch } } });
  const setParam = (patch) => setChunk({ params: { ...current.params, ...patch } });
  return (
    <>
      <StepHead kicker="Step 3 of 9 · Chunking" title="How should documents be split into pieces?" subtitle="Chunks are the units retrieved at query time. Smaller chunks are more precise; larger ones give more context."/>
      <div className="radio-cards">
        {Object.entries(opts).map(([k, o]) => (
          <RadioCard key={k} selected={current.type === k}
            onClick={() => setChunk({ type: k })}
            title={o.label} sub={o.sub} rec={o.rec}/>
        ))}
      </div>
      <details className="advanced" open>
        <summary><Icon name="chevron-right" size={14} className="chev"/> Advanced parameters</summary>
        <div className="grid">
          <div className="field">
            <label>Chunk size <span style={{ color: 'var(--text-faint)' }}>· chars</span></label>
            <input type="number" value={current.params?.chunk_size ?? 500}
              onChange={e => setParam({ chunk_size: +e.target.value })}/>
          </div>
          {current.type !== 'sentence_window' && (
            <div className="field">
              <label>Chunk overlap <span style={{ color: 'var(--text-faint)' }}>· chars</span></label>
              <input type="number" value={current.params?.chunk_overlap ?? 50}
                onChange={e => setParam({ chunk_overlap: +e.target.value })}/>
            </div>
          )}
          {current.type === 'semantic' && (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Similarity threshold</label>
              <div className="slider-row">
                <input type="range" min="0" max="1" step="0.05"
                  value={current.params?.similarity_threshold ?? 0.7}
                  onChange={e => setParam({ similarity_threshold: +e.target.value })}/>
                <span className="num">{(current.params?.similarity_threshold ?? 0.7).toFixed(2)}</span>
              </div>
            </div>
          )}
          {current.type === 'sentence_window' && (
            <div className="field">
              <label>Window size <span style={{ color: 'var(--text-faint)' }}>· sentences</span></label>
              <input type="number" value={current.params?.window_size ?? 3}
                onChange={e => setParam({ window_size: +e.target.value })}/>
            </div>
          )}
        </div>
      </details>
    </>
  );
};

const EmbeddingStep = ({ form, set }) => {
  const opts = window.PIPELINE_META.embedding.options;
  const current = form.pipeline.embedding;
  const setEmb = (patch) => set({ pipeline: { ...form.pipeline, embedding: { ...current, ...patch } } });
  return (
    <>
      <StepHead kicker="Step 4 of 9 · Embedding" title="Which model will convert text to vectors?" subtitle="Embeddings turn your chunks into numerical vectors so the retriever can find related text."/>
      <div className="radio-cards">
        {Object.entries(opts).map(([k, o]) => (
          <RadioCard key={k} selected={current.provider === k}
            onClick={() => setEmb({ provider: k, model: o.default })}
            title={o.label} sub={o.sub}/>
        ))}
      </div>
      <div className="field" style={{ marginTop: 22 }}>
        <label>Model</label>
        <input type="text" value={current.model} onChange={e => setEmb({ model: e.target.value })}/>
        <div className="hint">Default for {opts[current.provider]?.label}: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{opts[current.provider]?.default}</code></div>
      </div>
    </>
  );
};

const VectorStoreStep = ({ form, set }) => {
  const opts = window.PIPELINE_META.vector_store.options;
  const current = form.pipeline.vector_store;
  return (
    <>
      <StepHead kicker="Step 5 of 9 · Vector Store" title="Where should vectors be stored?" subtitle="Vector storage handles persistence and similarity search at query time."/>
      <div className="radio-cards col-2">
        {Object.entries(opts).map(([k, o]) => (
          <RadioCard key={k} selected={current.type === k}
            onClick={() => set({ pipeline: { ...form.pipeline, vector_store: { type: k } } })}
            title={o.label} sub={o.sub} rec={o.rec}/>
        ))}
      </div>
    </>
  );
};

const RetrieverStep = ({ form, set }) => {
  const opts = window.PIPELINE_META.retriever.options;
  const current = form.pipeline.retriever;
  const setRet = (patch) => set({ pipeline: { ...form.pipeline, retriever: { ...current, ...patch } } });
  const setParam = (patch) => setRet({ params: { ...current.params, ...patch } });
  return (
    <>
      <StepHead kicker="Step 6 of 9 · Retriever" title="How should relevant chunks be found at query time?" subtitle="The retrieval strategy decides which chunks get passed to the LLM as context."/>
      <div className="radio-cards">
        {Object.entries(opts).map(([k, o]) => (
          <RadioCard key={k} selected={current.type === k}
            onClick={() => setRet({ type: k })}
            title={o.label} sub={o.sub} rec={o.rec}/>
        ))}
      </div>
      <details className="advanced" open>
        <summary><Icon name="chevron-right" size={14} className="chev"/> Advanced parameters</summary>
        <div className="grid">
          <div className="field">
            <label>Top K <span style={{ color: 'var(--text-faint)' }}>· chunks</span></label>
            <input type="number" value={current.params?.top_k ?? 5}
              onChange={e => setParam({ top_k: +e.target.value })}/>
          </div>
          {current.type === 'hybrid' && (
            <div className="field">
              <label>BM25 weight</label>
              <div className="slider-row">
                <input type="range" min="0" max="1" step="0.05"
                  value={current.params?.bm25_weight ?? 0.3}
                  onChange={e => setParam({ bm25_weight: +e.target.value })}/>
                <span className="num">{(current.params?.bm25_weight ?? 0.3).toFixed(2)}</span>
              </div>
            </div>
          )}
          {current.type === 'mmr' && (
            <div className="field">
              <label>λ (diversity vs relevance)</label>
              <div className="slider-row">
                <input type="range" min="0" max="1" step="0.05"
                  value={current.params?.lambda_mult ?? 0.5}
                  onChange={e => setParam({ lambda_mult: +e.target.value })}/>
                <span className="num">{(current.params?.lambda_mult ?? 0.5).toFixed(2)}</span>
              </div>
            </div>
          )}
          {current.type === 'multi_query' && (
            <div className="field">
              <label>Number of query variants</label>
              <input type="number" value={current.params?.num_queries ?? 3}
                onChange={e => setParam({ num_queries: +e.target.value })}/>
            </div>
          )}
        </div>
      </details>
    </>
  );
};

const RerankerStep = ({ form, set }) => {
  const opts = window.PIPELINE_META.reranker.options;
  const enabled = !!form.pipeline.reranker;
  const current = form.pipeline.reranker;
  const setRR = (val) => set({ pipeline: { ...form.pipeline, reranker: val } });
  return (
    <>
      <StepHead kicker="Step 7 of 9 · Reranker (optional)" title="Re-score retrieved chunks for better answers?" subtitle="Reranking adds latency but typically improves answer quality on tough queries."/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14 }}>
        <div className="toggle" data-on={enabled} onClick={() => setRR(enabled ? null : { type: 'cohere', params: { top_n: form.pipeline.retriever.params?.top_k ?? 5 } })}></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Include a reranker</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>
            {enabled ? 'A reranking step will run after retrieval.' : 'Skip this step — chunks pass straight to the LLM.'}
          </div>
        </div>
      </div>
      {enabled && (
        <>
          <div className="radio-cards" style={{ marginTop: 18 }}>
            {Object.entries(opts).map(([k, o]) => (
              <RadioCard key={k} selected={current.type === k}
                onClick={() => setRR({ ...current, type: k })}
                title={o.label} sub={o.sub}/>
            ))}
          </div>
          <details className="advanced" open>
            <summary><Icon name="chevron-right" size={14} className="chev"/> Advanced parameters</summary>
            <div className="grid">
              <div className="field">
                <label>Top N <span style={{ color: 'var(--text-faint)' }}>· chunks after rerank</span></label>
                <input type="number" value={current.params?.top_n ?? form.pipeline.retriever.params?.top_k ?? 5}
                  onChange={e => setRR({ ...current, params: { ...current.params, top_n: +e.target.value } })}/>
              </div>
            </div>
          </details>
        </>
      )}
    </>
  );
};

const LLMStep = ({ form, set }) => {
  const opts = window.PIPELINE_META.llm.options;
  const current = form.pipeline.llm;
  const setLLM = (patch) => set({ pipeline: { ...form.pipeline, llm: { ...current, ...patch } } });
  const setParam = (patch) => setLLM({ params: { ...current.params, ...patch } });
  return (
    <>
      <StepHead kicker="Step 8 of 9 · LLM" title="Which model will generate the final answer?" subtitle="The retrieved chunks are passed to this model along with the user's question."/>
      <div className="radio-cards">
        {Object.entries(opts).map(([k, o]) => (
          <RadioCard key={k} selected={current.provider === k}
            onClick={() => setLLM({ provider: k, model: o.default })}
            title={o.label} sub={o.sub}/>
        ))}
      </div>
      <div className="field" style={{ marginTop: 22 }}>
        <label>Model</label>
        <input type="text" value={current.model} onChange={e => setLLM({ model: e.target.value })}/>
        <div className="hint">Default: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{opts[current.provider]?.default}</code></div>
      </div>
      <details className="advanced" open>
        <summary><Icon name="chevron-right" size={14} className="chev"/> Advanced parameters</summary>
        <div className="grid">
          <div className="field">
            <label>Temperature</label>
            <div className="slider-row">
              <input type="range" min="0" max="1" step="0.05"
                value={current.params?.temperature ?? 0.3}
                onChange={e => setParam({ temperature: +e.target.value })}/>
              <span className="num">{(current.params?.temperature ?? 0.3).toFixed(2)}</span>
            </div>
          </div>
          <div className="field">
            <label>Max tokens</label>
            <input type="number" value={current.params?.max_tokens ?? 1024}
              onChange={e => setParam({ max_tokens: +e.target.value })}/>
          </div>
        </div>
      </details>
    </>
  );
};

const ReviewStep = ({ form }) => {
  const p = form.pipeline;
  const m = window.PIPELINE_META;
  const row = (k, v, params) => (
    <React.Fragment key={k}>
      <div className="k">{k}</div>
      <div className="v">{v}{params && <span className="params">{params}</span>}</div>
    </React.Fragment>
  );
  const fmtParams = (obj) => {
    if (!obj) return null;
    const entries = Object.entries(obj);
    if (entries.length === 0) return null;
    return ' · ' + entries.map(([k, v]) => `${k}: ${v}`).join(', ');
  };
  return (
    <>
      <StepHead kicker="Step 9 of 9" title="Review & save" subtitle="Confirm your pipeline. You can edit any step later from the agent's settings."/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 8 }}>Agent</div>
          <div className="card pad">
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{form.name || <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Untitled agent</span>}</div>
            {form.description && <div style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>{form.description}</div>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 8 }}>Pipeline configuration</div>
          <div className="summary-table">
            {row('Ingestion',    m.ingestion.options[p.ingestion.type]?.label)}
            {row('Chunking',     m.chunking.options[p.chunking.type]?.label, fmtParams(p.chunking.params))}
            {row('Embedding',    `${m.embedding.options[p.embedding.provider]?.label} · ${p.embedding.model}`)}
            {row('Vector Store', m.vector_store.options[p.vector_store.type]?.label)}
            {row('Retriever',    m.retriever.options[p.retriever.type]?.label, fmtParams(p.retriever.params))}
            {row('Reranker',     p.reranker ? `${m.reranker.options[p.reranker.type]?.label}` : '—', p.reranker ? fmtParams(p.reranker.params) : null)}
            {row('LLM',          `${m.llm.options[p.llm.provider]?.label} · ${p.llm.model}`, fmtParams(p.llm.params))}
          </div>
        </div>
      </div>
    </>
  );
};

// ---------- Wizard shell ----------

const Wizard = ({ initial, onSave, onCancel, mode }) => {
  const [form, setForm] = React.useState(() => initial || {
    name: '', description: '', pipeline: { ...window.DEFAULT_PIPELINE },
  });
  const [stepIdx, setStepIdx] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const [err, setErr] = React.useState({});
  const steps = window.STEPS;
  const step = steps[stepIdx];

  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const validate = (idx) => {
    if (idx === 0 && !form.name.trim()) return { name: 'Give the agent a name to continue.' };
    return {};
  };

  const goTo = (n) => {
    if (n === stepIdx) return;
    const e = validate(stepIdx);
    if (n > stepIdx && Object.keys(e).length) { setErr(e); return; }
    setErr({});
    setDir(n > stepIdx ? 1 : -1);
    setStepIdx(n);
  };
  const next = () => goTo(Math.min(steps.length - 1, stepIdx + 1));
  const prev = () => goTo(Math.max(0, stepIdx - 1));

  const renderStep = () => {
    switch (step.key) {
      case 'basics':       return <BasicsStep form={form} set={set} err={err}/>;
      case 'ingestion':    return <IngestionStep form={form} set={set}/>;
      case 'chunking':     return <ChunkingStep form={form} set={set}/>;
      case 'embedding':    return <EmbeddingStep form={form} set={set}/>;
      case 'vector_store': return <VectorStoreStep form={form} set={set}/>;
      case 'retriever':    return <RetrieverStep form={form} set={set}/>;
      case 'reranker':     return <RerankerStep form={form} set={set}/>;
      case 'llm':          return <LLMStep form={form} set={set}/>;
      case 'review':       return <ReviewStep form={form}/>;
      default: return null;
    }
  };

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <button className="btn ghost sm" onClick={onCancel} style={{ marginBottom: 8, marginLeft: -10 }}>
            <Icon name="arrow-back" size={14}/> Back to agents
          </button>
          <h1 className="title">{mode === 'edit' ? 'Edit agent' : 'New agent'}</h1>
          <div className="subtitle">Configure each pipeline stage. You can tune everything later.</div>
        </div>
      </div>

      <div className="wizard">
        <nav className="stepper" aria-label="Wizard steps">
          {steps.map((s, i) => (
            <div key={s.key}
              className={`step ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}`}
              onClick={() => goTo(i)}>
              <span className="num">{i < stepIdx ? <Icon name="check" size={11} stroke={3}/> : i + 1}</span>
              <span>{s.label}</span>
              {s.optional && <span className="opt">Optional</span>}
            </div>
          ))}
        </nav>

        <div>
          <div className="wizard-mobile-stepper">
            <button className="btn ghost sm icon-only" onClick={prev} disabled={stepIdx === 0} aria-label="Previous">
              <Icon name="arrow-left" size={16}/>
            </button>
            <div className="center">
              <div className="label">Step {stepIdx + 1} of {steps.length}</div>
              <div className="title">{step.label}{step.optional && ' · Optional'}</div>
            </div>
            <button className="btn ghost sm icon-only" onClick={next} disabled={stepIdx === steps.length - 1} aria-label="Next">
              <Icon name="arrow-right" size={16}/>
            </button>
          </div>
          <div className="wizard-progress" style={{ marginBottom: 14 }}>
            {steps.map((_, i) => (
              <span key={i} className={`seg ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`}></span>
            ))}
          </div>

          <div className="step-panel">
            <div className={dir > 0 ? 'step-anim-enter' : 'step-anim-enter-back'} key={stepIdx}>
              <div className="step-content">
                {renderStep()}
              </div>
            </div>

            <div className="wizard-nav">
              <button className="btn subtle" onClick={prev} disabled={stepIdx === 0}>
                <Icon name="arrow-left" size={14}/> Back
              </button>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }} className="hidden-mobile">
                {stepIdx + 1} of {steps.length}
              </div>
              {stepIdx < steps.length - 1 ? (
                <button className="btn primary" onClick={next}>
                  Continue <Icon name="arrow-right" size={14}/>
                </button>
              ) : (
                <button className="btn primary" onClick={() => onSave(form)}>
                  <Icon name="check" size={14}/> {mode === 'edit' ? 'Save changes' : 'Save agent'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

window.Wizard = Wizard;
