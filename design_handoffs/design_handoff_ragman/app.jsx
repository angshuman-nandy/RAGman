// app.jsx — root, routing, persistence

const { useState, useEffect } = React;

const STORAGE_KEY = 'ragman.state.v1';

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
};
const saveState = (s) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
};

const newId = () => 'a' + Math.random().toString(36).slice(2, 9);

function App() {
  const initial = loadState() || { agents: window.SAMPLE_AGENTS, theme: 'dark', route: { name: 'dashboard' } };
  const [agents, setAgents] = useState(initial.agents);
  const [theme, setTheme] = useState(initial.theme || 'dark');
  const [route, setRoute] = useState(initial.route || { name: 'dashboard' });

  // Persist
  useEffect(() => { saveState({ agents, theme, route }); }, [agents, theme, route]);

  // Theme
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const updateAgent = (next) => {
    setAgents(prev => {
      const resolved = typeof next === 'function' ? prev.map(a => next(a) || a) : prev.map(a => a.id === next.id ? next : a);
      return resolved;
    });
  };
  // Functional update for nested closures (used by polling-like updates)
  const updateAgentBy = (id, updater) => {
    setAgents(prev => prev.map(a => a.id === id ? (updater(a) || a) : a));
  };

  // ---------- Routing actions ----------
  const goDashboard = () => setRoute({ name: 'dashboard' });
  const goNew = () => setRoute({ name: 'new' });
  const goEdit = (id) => setRoute({ name: 'edit', id });
  const goDetail = (id) => setRoute({ name: 'detail', id });

  const handleSave = (form) => {
    if (route.name === 'edit') {
      setAgents(prev => prev.map(a => a.id === route.id ? { ...a, name: form.name, description: form.description, pipeline: form.pipeline } : a));
      setRoute({ name: 'detail', id: route.id });
    } else {
      const id = newId();
      const agent = {
        id, name: form.name, description: form.description,
        pipeline: form.pipeline, documents: [], docCount: 0, status: 'empty',
      };
      setAgents(prev => [agent, ...prev]);
      setRoute({ name: 'detail', id });
    }
  };
  const handleDelete = (id) => {
    setAgents(prev => prev.filter(a => a.id !== id));
    setRoute({ name: 'dashboard' });
  };

  const activeAgent = (route.name === 'detail' || route.name === 'edit') ? agents.find(a => a.id === route.id) : null;

  // ---------- Header ----------
  let crumb = null;
  if (route.name === 'detail' && activeAgent) {
    crumb = <><span className="crumb">/</span><span className="agent-name-crumb">{activeAgent.name}</span></>;
  } else if (route.name === 'edit' && activeAgent) {
    crumb = <><span className="crumb">/</span><span className="agent-name-crumb">{activeAgent.name}</span><span className="crumb">/</span><span style={{ color: 'var(--text-dim)' }}>Edit</span></>;
  } else if (route.name === 'new') {
    crumb = <><span className="crumb">/</span><span style={{ color: 'var(--text-dim)' }}>New agent</span></>;
  }

  return (
    <div className="app">
      <header className="navbar">
        <div className="left">
          <a href="#" className="brand" onClick={(e) => { e.preventDefault(); goDashboard(); }}>
            <span className="logo">R</span>
            <span>RAGman</span>
          </a>
          {crumb}
        </div>
        <div className="right">
          <button className="btn ghost sm icon-only" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15}/>
          </button>
          {route.name === 'dashboard' && (
            <button className="btn primary sm" onClick={goNew}>
              <Icon name="plus" size={14}/> <span className="hidden-mobile">New Agent</span><span className="only-mobile">New</span>
            </button>
          )}
        </div>
      </header>

      {route.name === 'dashboard' && (
        <Dashboard
          agents={agents}
          onOpen={goDetail}
          onEdit={goEdit}
          onCreate={goNew}
          onDelete={handleDelete}/>
      )}

      {(route.name === 'new' || route.name === 'edit') && (
        <Wizard
          mode={route.name === 'edit' ? 'edit' : 'new'}
          initial={route.name === 'edit' && activeAgent ? {
            name: activeAgent.name, description: activeAgent.description, pipeline: activeAgent.pipeline,
          } : null}
          onSave={handleSave}
          onCancel={goDashboard}/>
      )}

      {route.name === 'detail' && activeAgent && (
        <AgentDetail
          agent={activeAgent}
          onBack={goDashboard}
          onEdit={() => goEdit(activeAgent.id)}
          onDelete={handleDelete}
          onUpdate={(next) => {
            if (typeof next === 'function') updateAgentBy(activeAgent.id, next);
            else updateAgent(next);
          }}/>
      )}

      {route.name === 'detail' && !activeAgent && (
        <main className="page">
          <div className="empty-state">
            <h3>Agent not found</h3>
            <p>It may have been deleted.</p>
            <button className="btn primary" onClick={goDashboard}>Back to dashboard</button>
          </div>
        </main>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
