// dashboard.jsx — agent list home screen

const AgentCard = ({ agent, onOpen, onEdit, onDelete }) => {
  return (
    <div className="agent-card" onClick={onOpen}>
      <div className="row">
        <h3>{agent.name}</h3>
        <StatusBadge status={agent.status}/>
      </div>
      <p className="desc">{agent.description}</p>
      <div className="chips">
        <PipelineChips pipeline={agent.pipeline} max={5}/>
      </div>
      <div className="meta">
        <div className="docs">
          <Icon name="file" size={14}/>
          <span>{agent.docCount} {agent.docCount === 1 ? 'document' : 'documents'}</span>
        </div>
        <div className="actions" onClick={e => e.stopPropagation()}>
          <button className="btn sm primary" onClick={onOpen}>
            Open <Icon name="arrow-right" size={14}/>
          </button>
          <DotMenu items={[
            { icon: 'edit', label: 'Edit pipeline', onClick: onEdit },
            { sep: true },
            { icon: 'trash', label: 'Delete agent', onClick: onDelete, danger: true },
          ]}/>
        </div>
      </div>
    </div>
  );
};

const EmptyDashboard = ({ onCreate }) => (
  <div className="empty-state">
    <div className="empty-illustration">
      <Icon name="bot" size={44} stroke={1.5}/>
    </div>
    <h3>No agents yet</h3>
    <p>Create your first document Q&A agent. Pick a pipeline, ingest your docs, then start asking questions.</p>
    <button className="btn primary lg" onClick={onCreate}>
      <Icon name="plus" size={16}/> Create your first agent
    </button>
  </div>
);

const Dashboard = ({ agents, onOpen, onEdit, onCreate, onDelete }) => {
  const [confirmId, setConfirmId] = React.useState(null);
  const target = agents.find(a => a.id === confirmId);
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="title">Agents</h1>
          <div className="subtitle">{agents.length} {agents.length === 1 ? 'agent' : 'agents'} configured · all running locally</div>
        </div>
        {agents.length > 0 && (
          <button className="btn primary" onClick={onCreate}>
            <Icon name="plus" size={16}/> New Agent
          </button>
        )}
      </div>

      {agents.length === 0 ? (
        <EmptyDashboard onCreate={onCreate}/>
      ) : (
        <div className="agent-grid">
          {agents.map(a => (
            <AgentCard
              key={a.id}
              agent={a}
              onOpen={() => onOpen(a.id)}
              onEdit={() => onEdit(a.id)}
              onDelete={() => setConfirmId(a.id)}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!target}
        onClose={() => setConfirmId(null)}
        title={`Delete "${target?.name}"?`}
        body="This permanently removes the agent and all its embedded documents. The original files are not affected."
        actions={<>
          <button className="btn subtle" onClick={() => setConfirmId(null)}>Cancel</button>
          <button className="btn primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={() => { onDelete(confirmId); setConfirmId(null); }}>
            Delete agent
          </button>
        </>}
      />
    </main>
  );
};

window.Dashboard = Dashboard;
