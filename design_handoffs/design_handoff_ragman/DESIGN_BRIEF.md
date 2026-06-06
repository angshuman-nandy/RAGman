# RAGman — UI Design Brief

## What is RAGman?

RAGman is a tool that lets users build custom AI document Q&A agents without writing code. A user creates an **Agent** by choosing which RAG pipeline steps to use and which models/strategies to apply at each step. Once created, the agent can ingest documents and answer questions about them using streaming AI responses.

Think of each Agent as a customisable "brain" that reads your documents and talks to you about them.

---

## Tech stack (for the developer)

- **Framework:** React (Vite or Next.js)
- **API base URL:** `http://localhost:8000/api/v1`
- **Streaming:** Server-Sent Events (`text/event-stream`) — each token arrives as `data: {"token": "..."}`, ending with `data: {"done": true}`
- **No auth** — single-user app for now

---

## Pages & Screens

### 1. Dashboard (`/`)

The home screen. Shows all agents the user has created.

**Layout:**
- Top navbar: app logo/name "RAGman" on the left, a prominent **"+ New Agent"** button on the right
- Below: a grid of **Agent Cards** (2 columns on desktop, 1 on mobile)
- Empty state: centered illustration + "No agents yet. Create your first one." + big CTA button

**Agent Card contains:**
- Agent name (bold, large)
- Description (muted, 2-line clamp)
- Pipeline summary chips — small coloured tags showing key choices, e.g. `PDF` `Recursive` `OpenAI Embed` `Chroma` `Hybrid` `Claude`
- Document count: "12 documents"
- Status badge: "Ready" (green) / "Ingesting" (amber, pulsing) / "No documents" (grey)
- Two action buttons: **Open** (primary) and a `⋮` menu with Edit / Delete

**Mobile:** full-width cards stacked vertically, chips wrap to multiple lines.

---

### 2. Create / Edit Agent (`/agents/new` and `/agents/:id/edit`)

A **multi-step wizard** (stepper) for configuring the pipeline. Each step is one pipeline stage. Users cannot skip mandatory steps; the optional Reranker step has a toggle to include/exclude it.

**Stepper tabs (always visible at top):**
1. Basics
2. Ingestion
3. Chunking
4. Embedding
5. Vector Store
6. Retriever
7. Reranker *(optional — toggled on/off)*
8. LLM
9. Review & Save

On mobile: stepper collapses to "Step 3 of 9 — Chunking" with prev/next arrows.

---

#### Step 1 — Basics
- **Agent Name** (text input, required)
- **Description** (textarea, optional)

---

#### Step 2 — Ingestion
**"What type of documents will this agent read?"**

Radio card group (large tap targets):
| Option | Icon | Label |
|---|---|---|
| `pdf` | 📄 | PDF files |
| `docx` | 📝 | Word documents (.docx) |
| `txt` | 🗒️ | Plain text (.txt) |
| `md` | # | Markdown (.md) |

---

#### Step 3 — Chunking
**"How should documents be split into pieces?"**

Radio card group:
| Option | Label | Description shown under label |
|---|---|---|
| `fixed_size` | Fixed size | Split by exact character count |
| `recursive` | Recursive *(Recommended)* | Smart splitting by paragraphs → sentences → words |
| `semantic` | Semantic | Split at meaning boundaries using embeddings |
| `sentence_window` | Sentence window | One sentence per chunk, retrieves surrounding context |

Below the selection: an **Advanced Parameters** collapsible section with numeric inputs:
- `chunk_size` (default 500)
- `chunk_overlap` (default 50, hidden for sentence_window)
- `similarity_threshold` (0.0–1.0 slider, only shown for semantic)
- `window_size` (only shown for sentence_window, default 3)

---

#### Step 4 — Embedding
**"Which model will convert text to vectors?"**

Radio card group:
| Option | Label | Sub-label |
|---|---|---|
| `openai` | OpenAI | Requires API key |
| `huggingface` | HuggingFace | Runs locally |
| `ollama` | Ollama | Runs locally via Ollama |

Below: a **Model** text input pre-filled with the default for the chosen provider:
- OpenAI → `text-embedding-3-small`
- HuggingFace → `sentence-transformers/all-MiniLM-L6-v2`
- Ollama → `nomic-embed-text`

---

#### Step 5 — Vector Store
**"Where should vectors be stored?"**

Radio card group:
| Option | Label | Description |
|---|---|---|
| `chroma` | ChromaDB *(Recommended)* | Lightweight, built-in |
| `pgvector` | PostgreSQL + pgvector | Production-grade, SQL-compatible |

---

#### Step 6 — Retriever
**"How should relevant chunks be found at query time?"**

Radio card group:
| Option | Label | Description |
|---|---|---|
| `similarity` | Similarity search | Fast cosine similarity |
| `mmr` | MMR — Diverse results | Balances relevance and diversity |
| `hybrid` | Hybrid BM25 + Vector *(Recommended)* | Combines keyword and semantic search |
| `multi_query` | Multi-query | Generates multiple query variants |

Advanced Parameters collapsible:
- `top_k` — number of chunks to retrieve (default 5)
- `bm25_weight` (0.0–1.0 slider, only for hybrid, default 0.3)
- `num_queries` (only for multi_query, default 3)
- `lambda_mult` (0.0–1.0 slider, only for MMR, default 0.5)

---

#### Step 7 — Reranker *(Optional)*

At the top of this step: a large **toggle switch** — "Include a reranker" (off by default). When off, show a muted explanation: "Reranking re-scores retrieved chunks for better relevance. Adds latency but improves answer quality."

When toggled on, show:

Radio card group:
| Option | Label | Description |
|---|---|---|
| `cohere` | Cohere Rerank | Requires API key |
| `huggingface` | HuggingFace cross-encoder | Runs locally |
| `llm` | LLM-based | Uses your chosen LLM to score |

Advanced: `top_n` input (default: same as top_k).

---

#### Step 8 — LLM
**"Which model will generate the final answer?"**

Radio card group:
| Option | Label | Description |
|---|---|---|
| `openai` | OpenAI | GPT-4o, GPT-4, etc. |
| `anthropic` | Anthropic Claude | Claude Sonnet, Haiku, Opus |
| `ollama` | Ollama | Local open-source models |

Below: **Model** text input pre-filled with provider default:
- OpenAI → `gpt-4o`
- Anthropic → `claude-sonnet-4-6`
- Ollama → `llama3.2`

Advanced Parameters collapsible:
- `temperature` (0.0–1.0 slider, default 0.3)
- `max_tokens` (number input, default 1024)

---

#### Step 9 — Review & Save

A **read-only summary card** showing all chosen options in a clean two-column layout:

```
Pipeline Configuration
──────────────────────────────────────
Ingestion       PDF
Chunking        Recursive  (chunk_size: 500, overlap: 50)
Embedding       OpenAI  (text-embedding-3-small)
Vector Store    ChromaDB
Retriever       Hybrid BM25 + Vector  (top_k: 5, bm25_weight: 0.3)
Reranker        —
LLM             Anthropic Claude  (claude-sonnet-4-6, temp: 0.3)
```

Below: **Save Agent** button (primary, large). On success → navigate to Agent Detail.

---

### 3. Agent Detail (`/agents/:id`)

Split into two tabs: **Documents** and **Chat**.

**Header (always visible):**
- Agent name + description
- Pipeline chips (same as dashboard card)
- Edit button (pencil icon) and Delete button

---

#### Tab 1 — Documents

**Upload area** (top):
- A drag-and-drop zone: dashed border, cloud-upload icon, "Drop your files here or click to browse"
- Shows accepted formats below: PDF, DOCX, TXT, MD
- On file select: shows a list of pending files with a progress spinner per file

**Document list** (below upload area):
A table / list with columns:
| Filename | Type | Status | Chunks | Uploaded |
|---|---|---|---|---|
| report.pdf | PDF | ✅ Ready | 142 | Jun 5, 2026 |
| notes.md | Markdown | 🔄 Ingesting… | — | Jun 5, 2026 |
| old.docx | Word | ❌ Failed | — | Jun 4, 2026 |

- Status badge colours: green (Ready), amber pulsing (Ingesting), red (Failed)
- Hover on Failed row shows the error message in a tooltip
- Delete icon on each row (with a confirmation popover)
- On mobile: collapse table into cards, one per document

---

#### Tab 2 — Chat

A **chat interface**, similar to a messaging app.

**Layout (desktop):** Right panel takes up ~60% of the screen. Left sidebar shows the document list summary (collapsed on mobile).

**Chat area:**
- Scrollable message list
- User messages: right-aligned, dark bubble
- Agent responses: left-aligned, light bubble, with the agent name/avatar
- Streaming: agent response types out token by token (typewriter effect)
- Below each agent response: collapsible **Sources** section showing the retrieved document chunks that were used:
  ```
  Sources (3)
  ▼
  [1] report.pdf — page 4   "The quarterly revenue grew by..."
  [2] report.pdf — page 7   "Operating costs declined..."
  [3] notes.md              "Key takeaway: margins improved..."
  ```

**Input area (pinned to bottom):**
- Text input: "Ask a question about your documents…"
- Send button (arrow icon)
- On mobile: full-width, keyboard-aware (input lifts above keyboard)
- Disabled with tooltip "Upload documents first" if no Ready documents exist

**Empty state:** Centered message — "Upload some documents, then ask anything about them."

---

## Design Direction

**Style:** Clean, minimal, professional. Think Linear or Vercel dashboard — dark-mode first but with a solid light mode too.

**Colours:**
- Primary accent: a vibrant indigo/violet (e.g. `#6366f1`)
- Success: green (`#22c55e`)
- Warning/Ingesting: amber (`#f59e0b`)
- Error: red (`#ef4444`)
- Background (dark): `#0f0f0f` / `#18181b`
- Surface (dark): `#27272a`
- Background (light): `#fafafa`
- Surface (light): `#ffffff`

**Typography:** Inter or Geist — clean sans-serif. Agent names large and bold. Descriptions and metadata in muted grey.

**Spacing:** Generous padding. Cards have rounded corners (`rounded-xl`). Buttons are rounded (`rounded-lg`).

**Animations:**
- Stepper transitions: slide left/right between steps
- Streaming text: smooth character-by-character reveal
- Status badges: amber ingesting badge pulses with a CSS animation
- Card hover: subtle lift (translateY -2px + shadow)

**Icons:** Use Lucide React throughout (consistent, lightweight).

---

## API Reference (for the developer)

```
GET    /api/v1/agents                          → list agents
POST   /api/v1/agents                          → create agent
GET    /api/v1/agents/:id                      → get agent
PUT    /api/v1/agents/:id                      → update agent
DELETE /api/v1/agents/:id                      → delete agent

GET    /api/v1/agents/:id/documents            → list documents
POST   /api/v1/agents/:id/documents            → upload files (multipart/form-data, field: "files")
DELETE /api/v1/agents/:id/documents/:docId     → delete document

POST   /api/v1/agents/:id/query                → ask a question
                                                 body: { "question": "...", "stream": true }
                                                 response: text/event-stream
                                                 each event: data: {"token": "..."}
                                                 final event: data: {"done": true}
```

**Agent pipeline config shape (POST /api/v1/agents body):**
```json
{
  "name": "My Agent",
  "description": "...",
  "pipeline": {
    "ingestion":    { "type": "pdf" },
    "chunking":     { "type": "recursive", "params": { "chunk_size": 500, "chunk_overlap": 50 } },
    "embedding":    { "provider": "openai", "model": "text-embedding-3-small" },
    "vector_store": { "type": "chroma" },
    "retriever":    { "type": "hybrid", "params": { "top_k": 5 } },
    "reranker":     null,
    "llm":          { "provider": "anthropic", "model": "claude-sonnet-4-6", "params": { "temperature": 0.3 } }
  }
}
```

---

## Responsive Breakpoints

| Breakpoint | Layout notes |
|---|---|
| Mobile < 640px | Single column. Stepper collapses to "Step N of 9". Tables become cards. Chat is full screen. Sidebar hidden. |
| Tablet 640–1024px | Two-column dashboard grid. Stepper shows step labels (no descriptions). |
| Desktop > 1024px | Full layout as described. Chat has sidebar. |

---

## Key UX Rules

1. **Never lose form state** when navigating between wizard steps — keep all values in memory.
2. **Validate before advancing** each step — show inline errors, not a toast.
3. **Poll document status** every 3 seconds when any document is in "Ingesting" state, stop when all are Ready or Failed.
4. **Disable chat input** until at least one document has status "Ready".
5. **Streaming errors** arrive as `data: {"error": "..."}` — display inline in the chat bubble as a red error message.
6. **Confirm before delete** — use a popover/modal, not a browser confirm dialog.
