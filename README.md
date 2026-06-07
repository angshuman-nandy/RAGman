# RAGman

A local-first experiment lab for building, iterating, and comparing document Q&A pipelines. Every stage of the RAG stack is swappable — create multiple agents with different configurations against the same documents and compare their answers side by side to find what actually works for your content.

---

## What it does

RAGman lets you build a complete RAG pipeline through a guided wizard, ingest documents into it, and chat with the result. The key insight is that every stage is independently configurable: swap chunking strategies, retrieval methods, rerankers, or LLMs without re-uploading documents. The document overview gives you deep visibility into how each stage transforms your content.

---

## Screenshots

### Dashboard

![Dashboard — agent list](ss/01-dashboard.png)

The main agents dashboard. Each card shows the agent's live status (Ready · Ingesting · Failed), its full pipeline configuration as chips (chunking strategy, embedding provider, vector store, retrieval method), and document count. Click **Open** to jump straight to the chat tab.

---

### Creating an agent — the 11-step wizard

#### Step 1 · Basics

![Wizard — Basics](ss/02-wizard-basics.png)

Name your agent and add an optional description. The left sidebar lists all 11 pipeline stages; completed stages are checked off as you advance.

#### Step 2 · Ingestion

![Wizard — Ingestion](ss/03-wizard-ingestion.png)

Choose the primary document format. PDF is selected here — RAGman splits PDFs one page per document, preserving page boundaries before chunking.

#### Step 3 · Chunking

![Wizard — Chunking](ss/04-wizard-chunking.png)

Pick a chunking strategy. **Recursive** is the recommended default — it tries paragraphs → sentences → words, giving clean boundaries for most content. Advanced parameters expose chunk size and overlap.

#### Step 4 · Embedding

![Wizard — Embedding](ss/05-wizard-embedding.png)

Select an embedding provider. OpenAI's `text-embedding-3-small` is shown selected; HuggingFace Sentence Transformers and Ollama both run fully locally with no API key.

#### Step 5 · Vector Store

![Wizard — Vector Store](ss/06-wizard-vector-store.png)

Choose where vectors are persisted. ChromaDB is the lightweight built-in default; PostgreSQL + pgvector is the production-grade option sharing the existing Postgres container.

#### Step 6 · Retriever

![Wizard — Retriever](ss/07-wizard-retriever.png)

Select a retrieval strategy. **Hybrid BM25 + Vector** (recommended) combines keyword and semantic search for the broadest coverage. Top K and BM25/vector weight are tunable in the advanced panel.

#### Step 7 · Reranker *(optional)*

![Wizard — Reranker](ss/08-wizard-reranker.png)

Optionally add a reranking pass after retrieval. **Cohere Rerank** (cloud, API key required) is selected; **HuggingFace cross-encoder** runs locally, and **LLM-based** uses the agent's own model to score chunks.

#### Step 8 · LLM

![Wizard — LLM](ss/09-wizard-llm.png)

Choose the generation model. Anthropic Claude (`claude-sonnet-4-6`) is selected. Temperature and max tokens are adjustable. OpenAI and Ollama (fully local) are the other options.

#### Step 9 · System Prompt *(optional)*

![Wizard — System Prompt](ss/10-wizard-system-prompt.png)

Customise the agent's personality. **Append** mode adds your instructions after the built-in RAG prompt; **Replace** mode gives complete control over the system prompt. The character counter helps you stay within model context limits.

#### Step 10 · Guardrails *(optional)*

![Wizard — Guardrails](ss/11-wizard-guardrails.png)

Set quality controls: define a topic scope (questions outside it are politely declined), list forbidden subjects, specify response format rules, and set a minimum confidence score below which the agent refuses to answer.

---

### Documents tab

#### Empty state — drop zone

![Documents tab — empty state](ss/12-documents-empty.png)

A fresh agent with no documents yet. Drop PDF, DOCX, TXT, or Markdown files onto the upload zone. The tab bar (Documents · Chat · History · Settings) is visible across the top.

#### Ingestion pipeline progress

![Documents tab — ingestion in progress](ss/13-documents-ingesting.png)

After dropping a PDF, a progress modal tracks each pipeline stage in the ARQ background worker: **Document parsing** → **Chunking** → **Embedding** → **Storing vectors**. The spinner shows which step is active; completed steps are checked.

---

### Document overview (per-document analytics)

Click any document filename to open a four-tab analytics view.

#### Chunks tab

![Document overview — Chunks](ss/14-overview-chunks.png)

All 42 stored chunks listed with their content preview and character count. A search bar lets you filter by text content; clicking a chunk shows its full text and metadata.

#### Chunking tab — strategy comparison

![Document overview — Chunking](ss/15-overview-chunking.png)

Current chunks on the left; a live preview of any alternative strategy on the right. Switch strategy, tune chunk size, and click **Re-ingest** to switch without re-uploading the file.

#### Retrieval tab — all strategies in parallel

![Document overview — Retrieval query](ss/16-overview-retrieval-query.png)

Enter a query and run it through all four retrieval strategies simultaneously. Each strategy's Top K and tuning parameters are set independently before running.

#### Retrieval results + score chart

![Document overview — Retrieval results](ss/17-overview-retrieval-results.png)

Results from each strategy laid out side by side. A **Score vs Rank** scatter chart below shows how steeply relevance drops off — useful for deciding how many chunks to pass to the LLM.

#### Reranker tab — before and after

![Document overview — Reranker](ss/18-overview-reranker.png)

Original retrieval order on the left; reranked order on the right. Switch between Cohere Rerank, HuggingFace cross-encoder, and LLM-based and click **Run** to compare reordering behaviour on the same query.

#### Embeddings tab — UMAP + heatmap

![Document overview — Embeddings](ss/19-overview-embeddings.png)

A UMAP 2D projection of all chunk vectors (clusters indicate semantic similarity groups) and a cosine similarity heatmap across all chunks. Hover any point on the scatter to see a content preview.

---

### Chat tab

![Chat tab — streamed answer](ss/20-chat.png)

The primary Q&A interface. Indexed documents appear in the left sidebar with chunk counts; click any document to scope retrieval to only that file (or select multiple for a subset). Answers stream token-by-token via SSE. The active pipeline configuration (LLM, model) is shown below the document list.

---

### History tab

#### Conversation history list

![History tab — list view](ss/21-history-list.png)

All past Q&A sessions for this agent in a two-panel layout. Metadata chips on each entry show the retrieval strategy used, whether reranking was applied, and how many chunks were retrieved. The right panel shows the full question and streamed answer.

#### History detail — retrieval scores

![History — retrieval scores and context chunks](ss/22-history-scores.png)

Drill into any past query: see which documents were used, a bar chart of per-chunk retrieval scores (colour-coded by score threshold), and the full context sent to the LLM — click **Show full chunk** on any entry to expand the exact text the model saw.

#### History detail — context chunks

![History — context chunks continued](ss/23-history-chunks.png)

Continuation of the context chunk list. Each chunk shows its source document, chunk index, and relevance score, making it easy to diagnose why the model gave a particular answer.

---

## Stack

| Layer | Technology |
|---|---|
| API | FastAPI + SQLAlchemy (async) + Alembic |
| Background jobs | ARQ (Redis-backed task queue) |
| Vector stores | ChromaDB · PostgreSQL + pgvector |
| Embeddings | OpenAI · HuggingFace Sentence Transformers · Ollama |
| LLMs | OpenAI · Anthropic Claude · Ollama |
| Rerankers | Cohere Rerank · HuggingFace cross-encoder · LLM-based |
| Frontend | React 18 + Vite + TypeScript + React Query |
| Infrastructure | Docker Compose (Postgres, Redis, Chroma, Ollama) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│          Vite dev server · React Query · SSE             │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼──────────────────────────────────┐
│                    FastAPI (port 8000)                   │
│   /agents   /documents   /query   /capabilities         │
└────────┬─────────────────────────┬───────────────────────┘
         │ SQL (async)             │ arq jobs
┌────────▼────────┐    ┌───────────▼──────────────────────┐
│   PostgreSQL    │    │          ARQ Worker               │
│  + pgvector     │    │   ingestion · chunking            │
│  agent configs  │    │   embedding · vector store        │
│  document meta  │    └───────┬──────────────┬────────────┘
└─────────────────┘            │              │
                    ┌──────────▼───┐   ┌──────▼──────┐
                    │   ChromaDB   │   │   Ollama    │
                    │  (vectors)   │   │  (local LLM)│
                    └──────────────┘   └─────────────┘
```

### Query path (streaming)

```
question
   → embed query
   → retrieve chunks  [similarity | mmr | hybrid BM25+vec | multi-query]
   → rerank (optional) [cohere | huggingface cross-encoder | llm]
   → generate answer  [openai | anthropic | ollama]
   → SSE stream tokens back to browser
```

Responses are cached in Redis keyed by `agent_id + question + document_filter`. Cache TTL and per-agent cap are configurable in `.env`.

---

## Pipeline stages

### Ingestion
Supported file types: **PDF**, **DOCX**, **TXT**, **Markdown**.

- PDF: one `Document` per page (preserves page boundaries for chunking)
- DOCX: paragraph-level extraction
- TXT / MD: raw text

### Chunking (5 strategies)

| Strategy | Description |
|---|---|
| `fixed_size` | Split by exact character count |
| `recursive` | Paragraph → sentence → word fallback *(recommended default)* |
| `semantic` | Group text at embedding-based meaning boundaries |
| `sentence_window` | One sentence per chunk with surrounding context window |
| `doc_aware` | Structure-respecting: Markdown headers → sections, PDF page boundaries, DOCX paragraphs |

### Embedding (3 providers)

| Provider | Notes |
|---|---|
| OpenAI | `text-embedding-3-small` default · requires `OPENAI_API_KEY` |
| HuggingFace | `all-MiniLM-L6-v2` default · runs locally, no key needed |
| Ollama | `nomic-embed-text` default · requires Ollama container |

### Vector stores (2 options)

| Store | Notes |
|---|---|
| ChromaDB | Lightweight, built-in, good for local experimentation *(default)* |
| pgvector | Production-grade, SQL-compatible, shares the Postgres container |

### Retrieval (4 strategies)

| Strategy | Description |
|---|---|
| `similarity` | Cosine similarity over the vector store |
| `mmr` | Maximal Marginal Relevance — balances relevance with diversity |
| `hybrid` | BM25 keyword search + vector search, score fusion *(recommended)* |
| `multi_query` | LLM generates N query variants, results are union-merged |

All retrievers support **document-scoped queries** — select specific documents in the chat sidebar to restrict retrieval to only those files.

### Reranker (optional, 3 options)

| Option | Notes |
|---|---|
| Cohere Rerank | Cloud API · requires valid `COHERE_API_KEY` |
| HuggingFace cross-encoder | Runs locally, no key needed |
| LLM-based | Uses the agent's configured LLM to score and reorder chunks |

Cohere availability is validated on startup (real API call, cached 5 min). If the key is missing or invalid, the Cohere option is shown disabled in the UI with an "API KEY NOT CONFIGURED" tooltip.

### LLM (3 providers)

| Provider | Models |
|---|---|
| OpenAI | `gpt-4o` default |
| Anthropic | `claude-sonnet-4-6` default |
| Ollama | `llama3.2` default · runs fully locally |

---

## Getting started

### Prerequisites

- Docker + Docker Compose
- API keys for whichever cloud providers you want to use (all optional if using Ollama)

### 1. Clone and configure

```bash
git clone <repo>
cd RAGman
cp .env.example .env
```

Edit `.env` and fill in the keys you have:

```env
# Required — infrastructure (pre-filled for local Docker)
DATABASE_URL=postgresql+asyncpg://ragman:ragman@postgres:5432/ragman
REDIS_URL=redis://redis:6379/0
CHROMA_HOST=chroma
CHROMA_PORT=8000
OLLAMA_BASE_URL=http://ollama:11434

# Optional — cloud providers (leave blank to use Ollama only)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
COHERE_API_KEY=...

# App settings
APP_ENV=development
LOG_LEVEL=INFO
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE_MB=50
QUERY_CACHE_TTL=3600
QUERY_CACHE_MAX_PER_AGENT=100
```

### 2. Start the stack

```bash
docker compose up --build
```

This starts: FastAPI API, ARQ worker, PostgreSQL + pgvector, Redis, ChromaDB, Ollama.

The API is available at `http://localhost:8000`. Interactive API docs at `http://localhost:8000/docs`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### 4. Pull an Ollama model (if using local LLMs)

```bash
docker exec -it ragman-ollama-1 ollama pull llama3.2
docker exec -it ragman-ollama-1 ollama pull nomic-embed-text
```

---

## Usage

### Creating an agent

1. Click **New agent** on the dashboard
2. Step through the wizard — name, ingestion type, chunking strategy, embedding provider, vector store, retriever, optional reranker, LLM
3. Save — the agent is created with your pipeline configuration

### Ingesting documents

1. Open an agent → **Documents** tab
2. Upload one or more files (PDF, DOCX, TXT, MD)
3. Ingestion runs asynchronously in the ARQ worker — watch the step-by-step progress indicator
4. Status moves from `pending → ingesting → ready` (or `failed` with an error message)

### Chatting

1. Open an agent → **Chat** tab
2. Ask questions about your documents
3. Responses stream token-by-token via SSE
4. Sources panel shows retrieved chunks with scores and page references
5. **Document filtering** — click individual documents in the sidebar to restrict retrieval to only those files. The header shows "N of M selected"; click **All** to reset.

### Document Overview (per-document analytics)

Click any document filename to open its overview. Four tabs:

| Tab | What it shows |
|---|---|
| **Chunks** | All stored chunks with metadata, filterable |
| **Chunking** | Side-by-side preview: current chunks vs. any strategy with custom params. Apply re-ingests with the new strategy. |
| **Retrieval** | Run a query through all four retrievers in parallel, compare ranked results and score distributions on a scatter chart |
| **Reranker** | *(appears only when agent has a reranker configured)* Run a query, see chunks before and after reranking side by side |
| **Embeddings** | UMAP 2D scatter of all chunk embeddings + cosine similarity heatmap |

### Editing an agent

Open an agent → **Edit** (top right). The edit wizard skips the system prompt and guardrails tabs and lets you jump freely between stages — save from any tab without stepping through the entire flow.

---

## Project structure

```
RAGman/
├── app/
│   ├── api/
│   │   └── routes/
│   │       ├── agents.py      # CRUD for agents
│   │       ├── documents.py   # upload, ingest, chunks, retrieval, rerank, embeddings
│   │       └── query.py       # streaming + cached Q&A
│   ├── core/
│   │   ├── config.py          # pydantic-settings, reads .env
│   │   ├── database.py        # async SQLAlchemy engine + session
│   │   └── cache.py           # Redis connection pool
│   ├── models/
│   │   ├── agent.py           # Agent + Document SQLAlchemy models
│   │   └── schemas.py         # Pydantic request/response schemas
│   ├── pipeline/
│   │   ├── context.py         # PipelineContext dataclass (shared state)
│   │   ├── executor.py        # orchestrates ingestion and query pipelines
│   │   ├── registry.py        # @register decorator + task lookup
│   │   └── tasks/
│   │       ├── ingestion/     # pdf · docx · text
│   │       ├── chunking/      # fixed_size · recursive · semantic · sentence_window · doc_aware
│   │       ├── embedding/     # openai · huggingface · ollama
│   │       ├── vector_store/  # chroma · pgvector
│   │       ├── retriever/     # similarity · mmr · hybrid · multi_query
│   │       ├── reranker/      # cohere · huggingface · llm
│   │       └── generator/     # openai · anthropic · ollama
│   ├── worker/
│   │   ├── settings.py        # ARQ worker config
│   │   └── tasks.py           # background ingestion job
│   └── main.py                # FastAPI app, middleware, capability check
├── frontend/
│   └── src/
│       ├── api/               # React Query hooks (agents, documents, overview, stream)
│       ├── components/
│       │   ├── dashboard/     # agent list, empty state
│       │   ├── detail/        # agent detail, chat, documents, settings tabs
│       │   ├── overview/      # per-document analytics tabs
│       │   ├── wizard/        # multi-step pipeline builder
│       │   └── shared/        # modal, status badge, pipeline chips, help panel
│       ├── data/pipeline.ts   # pipeline metadata (labels, options, defaults)
│       └── types/index.ts     # shared TypeScript types
├── migrations/                # Alembic migration scripts
├── docker-compose.yml
├── Dockerfile                 # multi-stage uv build
└── .env.example
```

### Adding a new pipeline stage implementation

All pipeline tasks use a registry pattern. To add a new chunking strategy (for example):

```python
# app/pipeline/tasks/chunking/my_strategy.py
from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext
from app.pipeline.registry import register

@register("chunking", "my_strategy")
class MyChunkingTask(BaseTask):
    async def run(self, context: PipelineContext) -> PipelineContext:
        # context.documents → list[Document]
        # populate context.chunks → list[Chunk]
        return context
```

Then add the key to the `ChunkingConfig.type` Literal in `app/models/schemas.py` and the frontend label in `frontend/src/data/pipeline.ts`. No other changes needed — the registry picks it up automatically.

---

## API reference highlights

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/agents` | List all agents |
| `POST` | `/api/v1/agents` | Create agent |
| `PUT` | `/api/v1/agents/{id}` | Update agent pipeline config |
| `DELETE` | `/api/v1/agents/{id}` | Delete agent + embeddings |
| `POST` | `/api/v1/agents/{id}/documents` | Upload documents (multipart) |
| `GET` | `/api/v1/agents/{id}/documents/{docId}/chunks` | Fetch stored chunks |
| `POST` | `/api/v1/agents/{id}/documents/{docId}/rechunk` | Preview alternative chunking |
| `POST` | `/api/v1/agents/{id}/documents/{docId}/reprocess` | Re-ingest with new chunking |
| `POST` | `/api/v1/agents/{id}/documents/{docId}/retrieve` | Test retrieval strategies |
| `POST` | `/api/v1/agents/{id}/documents/{docId}/rerank` | Test reranking (before/after) |
| `GET` | `/api/v1/agents/{id}/documents/{docId}/embeddings` | UMAP + heatmap data |
| `POST` | `/api/v1/agents/{id}/query` | Q&A — streaming SSE or cached JSON |
| `GET` | `/api/v1/capabilities` | Which provider keys are valid |
| `GET` | `/health` | Health check |

Full interactive docs: `http://localhost:8000/docs`

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Async postgres connection string |
| `REDIS_URL` | — | Redis connection string |
| `CHROMA_HOST` | `chroma` | ChromaDB hostname |
| `CHROMA_PORT` | `8000` | ChromaDB port |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Ollama API base URL |
| `OPENAI_API_KEY` | `""` | OpenAI key (embedding + generation) |
| `ANTHROPIC_API_KEY` | `""` | Anthropic key (generation) |
| `COHERE_API_KEY` | `""` | Cohere key (reranking) · validated on startup |
| `APP_ENV` | `development` | Environment tag |
| `LOG_LEVEL` | `INFO` | Python logging level |
| `UPLOAD_DIR` | `/app/uploads` | Where uploaded files are stored |
| `MAX_UPLOAD_SIZE_MB` | `50` | Per-file upload limit |
| `QUERY_CACHE_TTL` | `3600` | Redis cache TTL in seconds |
| `QUERY_CACHE_MAX_PER_AGENT` | `100` | Max cached queries per agent |

---

## Development

### Running without Docker (API only)

```bash
# Install dependencies with uv
uv sync

# Run migrations
uv run alembic upgrade head

# Start the API
uv run uvicorn app.main:app --reload --port 8000

# Start the worker (separate terminal)
uv run python -m arq app.worker.settings.WorkerSettings
```

Requires Postgres, Redis, and Chroma running locally or via Docker.

### Linting and type checking

```bash
uv run ruff check .
uv run mypy app/
```

### Rebuilding after backend changes

```bash
docker compose up --build api worker
```

Frontend changes (Vite) hot-reload automatically — no rebuild needed.
