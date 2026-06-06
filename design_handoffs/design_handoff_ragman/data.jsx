// data.jsx — sample agents + pipeline option metadata

const SAMPLE_AGENTS = [
  {
    id: 'a1',
    name: 'Legal Contract Reader',
    description: 'Reviews NDAs, MSAs, and SOWs across our vendor portfolio and answers compliance questions cited to the source paragraph.',
    docCount: 14,
    status: 'ready',
    pipeline: {
      ingestion: { type: 'pdf' },
      chunking: { type: 'recursive', params: { chunk_size: 800, chunk_overlap: 100 } },
      embedding: { provider: 'openai', model: 'text-embedding-3-small' },
      vector_store: { type: 'chroma' },
      retriever: { type: 'hybrid', params: { top_k: 6, bm25_weight: 0.4 } },
      reranker: { type: 'cohere', params: { top_n: 4 } },
      llm: { provider: 'anthropic', model: 'claude-sonnet-4-6', params: { temperature: 0.2, max_tokens: 1024 } },
    },
    documents: [
      { id: 'd1', name: 'master_services_agreement_v3.pdf', type: 'PDF', status: 'ready', chunks: 142, uploaded: 'Jun 5, 2026' },
      { id: 'd2', name: 'vendor_nda_acme.pdf', type: 'PDF', status: 'ready', chunks: 38, uploaded: 'Jun 4, 2026' },
      { id: 'd3', name: 'sow_2026_q2.pdf', type: 'PDF', status: 'ingest', chunks: null, uploaded: 'Jun 5, 2026' },
      { id: 'd4', name: 'legacy_terms_2019.docx', type: 'Word', status: 'failed', chunks: null, uploaded: 'Jun 3, 2026', error: 'Could not parse: unsupported encoding (CP-1252)' },
    ],
  },
  {
    id: 'a2',
    name: 'Engineering Wiki Bot',
    description: 'Internal docs and runbooks across infra, deploy, on-call playbooks. Trained on our markdown notes export.',
    docCount: 87,
    status: 'ready',
    pipeline: {
      ingestion: { type: 'md' },
      chunking: { type: 'semantic', params: { chunk_size: 500, similarity_threshold: 0.7 } },
      embedding: { provider: 'huggingface', model: 'sentence-transformers/all-MiniLM-L6-v2' },
      vector_store: { type: 'pgvector' },
      retriever: { type: 'mmr', params: { top_k: 5, lambda_mult: 0.6 } },
      reranker: null,
      llm: { provider: 'openai', model: 'gpt-4o', params: { temperature: 0.3, max_tokens: 1500 } },
    },
    documents: [],
  },
  {
    id: 'a3',
    name: 'Earnings Call Analyst',
    description: 'Quarterly transcripts and 10-K filings. Pulls quantitative claims with their source quote.',
    docCount: 0,
    status: 'empty',
    pipeline: {
      ingestion: { type: 'pdf' },
      chunking: { type: 'fixed_size', params: { chunk_size: 500, chunk_overlap: 50 } },
      embedding: { provider: 'openai', model: 'text-embedding-3-small' },
      vector_store: { type: 'chroma' },
      retriever: { type: 'similarity', params: { top_k: 5 } },
      reranker: null,
      llm: { provider: 'anthropic', model: 'claude-sonnet-4-6', params: { temperature: 0.1, max_tokens: 2048 } },
    },
    documents: [],
  },
];

// Step metadata — used by chips, summary, wizard
const PIPELINE_META = {
  ingestion: {
    title: 'Ingestion',
    chipClass: 'sky',
    options: {
      pdf:  { label: 'PDF',       sub: 'Portable Document Format', icon: '📄' },
      docx: { label: 'DOCX',      sub: 'Microsoft Word documents', icon: '📝' },
      txt:  { label: 'Plain text',sub: 'Raw .txt files',           icon: '🗒️' },
      md:   { label: 'Markdown',  sub: 'GitHub-flavored .md',      icon: '#'  },
    },
  },
  chunking: {
    title: 'Chunking',
    chipClass: 'violet',
    options: {
      fixed_size:      { label: 'Fixed size',       sub: 'Split by exact character count' },
      recursive:       { label: 'Recursive',        sub: 'Smart split by paragraphs → sentences → words', rec: true },
      semantic:        { label: 'Semantic',         sub: 'Split at meaning boundaries via embeddings' },
      sentence_window: { label: 'Sentence window',  sub: 'One sentence per chunk + context window' },
    },
  },
  embedding: {
    title: 'Embedding',
    chipClass: 'indigo',
    options: {
      openai:      { label: 'OpenAI',      sub: 'Requires API key',         default: 'text-embedding-3-small' },
      huggingface: { label: 'HuggingFace', sub: 'Runs locally',              default: 'sentence-transformers/all-MiniLM-L6-v2' },
      ollama:      { label: 'Ollama',      sub: 'Local via Ollama runtime',  default: 'nomic-embed-text' },
    },
  },
  vector_store: {
    title: 'Vector Store',
    chipClass: 'teal',
    options: {
      chroma:   { label: 'ChromaDB',          sub: 'Lightweight, built-in', rec: true },
      pgvector: { label: 'PostgreSQL + pgvector', sub: 'Production-grade, SQL-compatible' },
    },
  },
  retriever: {
    title: 'Retriever',
    chipClass: 'amber',
    options: {
      similarity:  { label: 'Similarity search',     sub: 'Fast cosine similarity' },
      mmr:         { label: 'MMR — Diverse results', sub: 'Balances relevance and diversity' },
      hybrid:      { label: 'Hybrid BM25 + Vector',  sub: 'Combines keyword and semantic search', rec: true },
      multi_query: { label: 'Multi-query',           sub: 'Generates multiple query variants' },
    },
  },
  reranker: {
    title: 'Reranker',
    chipClass: 'rose',
    options: {
      cohere:      { label: 'Cohere Rerank',          sub: 'Requires API key' },
      huggingface: { label: 'HuggingFace cross-encoder', sub: 'Runs locally' },
      llm:         { label: 'LLM-based',              sub: 'Uses your chosen LLM to score' },
    },
  },
  llm: {
    title: 'LLM',
    chipClass: 'indigo',
    options: {
      openai:    { label: 'OpenAI',           sub: 'GPT-4o, GPT-4, etc.',         default: 'gpt-4o' },
      anthropic: { label: 'Anthropic Claude', sub: 'Claude Sonnet, Haiku, Opus',  default: 'claude-sonnet-4-6' },
      ollama:    { label: 'Ollama',           sub: 'Local open-source models',    default: 'llama3.2' },
    },
  },
};

const STEPS = [
  { key: 'basics',       label: 'Basics',        icon: 'sparkles' },
  { key: 'ingestion',    label: 'Ingestion',     icon: 'file-text' },
  { key: 'chunking',     label: 'Chunking',      icon: 'scissors' },
  { key: 'embedding',    label: 'Embedding',     icon: 'layers' },
  { key: 'vector_store', label: 'Vector Store',  icon: 'database' },
  { key: 'retriever',    label: 'Retriever',     icon: 'search' },
  { key: 'reranker',     label: 'Reranker',      icon: 'sliders', optional: true },
  { key: 'llm',          label: 'LLM',           icon: 'cpu' },
  { key: 'review',       label: 'Review & Save', icon: 'check-circle' },
];

const DEFAULT_PIPELINE = {
  ingestion: { type: 'pdf' },
  chunking: { type: 'recursive', params: { chunk_size: 500, chunk_overlap: 50 } },
  embedding: { provider: 'openai', model: 'text-embedding-3-small' },
  vector_store: { type: 'chroma' },
  retriever: { type: 'hybrid', params: { top_k: 5, bm25_weight: 0.3 } },
  reranker: null,
  llm: { provider: 'anthropic', model: 'claude-sonnet-4-6', params: { temperature: 0.3, max_tokens: 1024 } },
};

Object.assign(window, { SAMPLE_AGENTS, PIPELINE_META, STEPS, DEFAULT_PIPELINE });
