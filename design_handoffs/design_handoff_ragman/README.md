# Handoff: RAGman UI

## Overview

RAGman is a no-code tool for building custom AI document Q&A agents. A user creates an **Agent** by choosing which RAG pipeline steps to use and which models/strategies to apply at each step. Once created, the agent ingests documents and answers questions about them using streaming AI responses.

This handoff covers the full client-side UI: **Dashboard**, a **9-step pipeline-configuration Wizard**, and an **Agent Detail** page with Documents (upload + status) and Chat (streaming Q&A with citations) tabs.

---

## About the Design Files

The files in this bundle (`RAGman UI.html`, `styles.css`, and the `*.jsx` files) are **design references created in HTML**. They are prototypes showing the intended look and behaviour — not production code to copy directly.

Your task is to **recreate these designs in the target codebase's environment** using its established patterns and libraries. Per the brief, that target is **React (Vite or Next.js)** with **Lucide React** icons. The CSS in `styles.css` is hand-written; in the target app you will likely use Tailwind, CSS Modules, or whichever styling solution the codebase already uses — port the design tokens (see below) rather than copying the stylesheet verbatim.

The interactive behaviours (file-upload poll → ready, token streaming, optimistic state updates, conditional advanced parameters per step) are mocked with `setTimeout`/canned data. In production they should be backed by the API documented in the brief (`http://localhost:8000/api/v1`, with SSE for streaming).

---

## Fidelity

**High-fidelity.** Final colours, typography, spacing, motion, and responsive behaviour are decided. Recreate pixel-perfectly using the codebase's component primitives. Where the codebase has its own button/input/badge components, prefer those over reimplementing — match the visual spec by mapping it onto the existing API.

---

## Screens / Views

### 1. Dashboard (`/`)

**Purpose:** lists every agent the user has built. Entry point for creating, opening, editing, deleting.

**Layout**
- Sticky top navbar (`14px 20px` padding, `1px` bottom border, translucent background with `backdrop-filter: blur(14px)`)
  - Left: RAGman wordmark + 28×28 gradient `R` logo (`linear-gradient(135deg, #6366f1, #a78bfa)`)
  - Right: theme toggle (sun/moon, ghost icon-only), primary `+ New Agent` button
- Page content max-width `1200px`, centered, `28px 20px 80px` padding
- Page head: title `Agents` (28px / weight 600 / `-0.02em`), subtitle in `--text-dim`, `+ New Agent` button on the right (hidden when empty state shows)
- Agent grid: `1fr` on mobile, `1fr 1fr` from 760px

**Agent Card**
- Surface card, `border-radius: 18px`, `1px` border, `20px` padding, `14px` internal gap
- Hover: `translateY(-2px)` + `box-shadow` lift + border-strong colour
- Row 1: name (`17px` / 600) on the left, **Status badge** on the right (Ready / Ingesting / Failed / No documents)
- Row 2: description, muted, 2-line clamp (`min-height: 42px`)
- Row 3: **Pipeline chips** — coloured tags, max 5 shown, "+N" overflow chip. Each chip has a 6px coloured dot, palette per pipeline stage (see Design Tokens)
- Row 4 (dashed top border): "N documents" with file icon (left), `Open` primary button + `⋮` menu (right)

**`⋮` Menu items:** Edit pipeline · Delete agent (danger, opens confirm modal)

**Empty state**
- 88×88 rounded gradient illustration containing a bot icon
- Heading "No agents yet", paragraph, primary "Create your first agent" button

### 2. New / Edit Agent Wizard (`/agents/new`, `/agents/:id/edit`)

**Purpose:** step-by-step configuration of the pipeline.

**Layout**
- Page head: back link "← Back to agents", title (`New agent` / `Edit agent`), subtitle
- Two-column grid `240px 1fr` (single column < 900px)
  - **Stepper** (left): sticky, vertical list of 9 steps. Each step has a `22px` numbered circle (filled accent when done, soft accent ring when active, checkmark when done), label, and `Optional` tag where applicable. Click any earlier-or-equal step to jump.
  - **Step panel** (right): white surface card, `28px` padding (`20px` on mobile), min-height `380px`
- **Mobile stepper** (< 900px): horizontal bar with prev arrow / center label `Step N of 9 — Title` / next arrow, plus a 9-segment progress bar below.

**Step panel contents**
- Kicker (`Step X of 9 · Section`, accent, uppercase, `11px`, letter-spacing `.08em`)
- Title `22px` / 600 / `-0.02em`
- Subtitle in `--text-dim`
- Step content
- Bottom nav: `Back` ↔ `Continue` (or `Save agent` on step 9) separated by a 1px dashed border

**Step transitions:** the step content slide-fades 12px from the side based on direction; gated behind `prefers-reduced-motion: no-preference` so reduced-motion shows the static end state.

#### Step 1 — Basics
Two stacked fields: required text input "Agent name", optional textarea "Description". Inline validation: cannot advance without a name; error renders as `--danger` text with alert icon below the field.

#### Step 2 — Ingestion
4-card grid (2 columns ≥ 640px). Each card: 38×38 icon tile + title + sub. Options: `pdf` 📄, `docx` 📝, `txt` 🗒️, `md` `#`.

#### Step 3 — Chunking
Single-column radio cards: `fixed_size`, `recursive` (**Recommended** badge), `semantic`, `sentence_window`. Advanced parameters section below (collapsible `<details>`, open by default):
- `chunk_size` (number, default 500)
- `chunk_overlap` (number, default 50; hidden when type is `sentence_window`)
- `similarity_threshold` (slider 0–1, only for `semantic`)
- `window_size` (number, only for `sentence_window`, default 3)

#### Step 4 — Embedding
Radio cards: `openai` / `huggingface` / `ollama`. Below: "Model" text input that auto-fills with provider default when switching:
- openai → `text-embedding-3-small`
- huggingface → `sentence-transformers/all-MiniLM-L6-v2`
- ollama → `nomic-embed-text`

#### Step 5 — Vector Store
2-column radio cards: `chroma` (Recommended) / `pgvector`.

#### Step 6 — Retriever
Radio cards: `similarity`, `mmr`, `hybrid` (Recommended), `multi_query`. Advanced parameters:
- `top_k` (default 5)
- `bm25_weight` slider 0–1, default 0.3 — only for `hybrid`
- `lambda_mult` slider 0–1, default 0.5 — only for `mmr`
- `num_queries` (default 3) — only for `multi_query`

#### Step 7 — Reranker (optional)
Top of step: a wrapped row containing a 40×22 toggle switch + "Include a reranker" + supporting copy. When off, the explanation reads "Reranking re-scores retrieved chunks for better relevance. Adds latency but improves answer quality." When on:
- Radio cards: `cohere`, `huggingface`, `llm`
- Advanced: `top_n` (defaults to the retriever's `top_k`)

#### Step 8 — LLM
Radio cards: `openai`, `anthropic` (default for new agents), `ollama`. Model text input pre-filled with defaults (`gpt-4o`, `claude-sonnet-4-6`, `llama3.2`). Advanced:
- `temperature` slider 0–1, default 0.3
- `max_tokens` number, default 1024

#### Step 9 — Review & Save
Two stacked cards:
1. **Agent** card showing name (or `Untitled agent` muted-italic if blank) and description.
2. **Pipeline configuration** — a two-column table with surface-2 left column (label) and surface right column (value). Params trail the value in monospace muted (e.g. `· chunk_size: 500, chunk_overlap: 50`). Collapses to a single column < 560px with the label sitting above the value. Reranker row reads `—` when off.

Bottom-right primary button: `Save agent` (or `Save changes` in edit mode).

### 3. Agent Detail (`/agents/:id`)

**Purpose:** manage documents and chat with the agent.

**Layout**
- "← All agents" link
- Header: name (`26px` / 600), description (max-width 640, muted), action buttons on the right (`Edit` subtle + `⋮` menu). On mobile the Edit button collapses to icon-only.
- Chip row below: Status badge + all pipeline chips
- Tabs: `Documents · count` / `Chat`. Active tab gets a 2px accent underline.

#### Tab 1 — Documents

**Dropzone (top)**
- Dashed border, surface background, `28px` padding, centered content. Has a hover/drag highlighted state (`drag` class) — accent border + soft-accent background tint.
- 48×48 accent-tinted cloud-upload icon, heading "Drop your files here or click to browse", muted helper, format chips (`PDF` `DOCX` `TXT` `MD`).
- Clicking opens the file picker. Drag-and-drop is supported via `dragenter`/`dragover`/`drop`.

**Document table (below)**
- Surface card, `1px` border, rounded `18px`
- Columns: Filename (file-type pill + name) · Type · Status · Chunks (right-aligned) · Uploaded · `⋮` actions
- Status badges identical to dashboard (Ready / Ingesting / Failed). The amber "Ingesting" dot pulses (1.4s loop).
- Failed rows tint danger on hover; the row's `title` attribute carries the error message
- Delete: trash icon → confirmation modal

**Mobile (< 760px):** table head hidden, each row becomes a stacked card with field labels ("Type", "Status", "Chunks", "Uploaded") prepended via `::before` pseudo-elements.

**Empty state:** muted "No documents yet. Drop files above to get started."

#### Tab 2 — Chat

**Layout:** 280px sidebar + main panel (single column on < 900px, sidebar hidden).

**Sidebar (`chat-sidebar`)**
- Section title `Indexed documents (N)` (uppercase, faint)
- One line per Ready document: file icon + name + chunk count
- Bottom card: small "Pipeline" panel with sparkles icon and current LLM provider/model

**Chat main (`chat-main`)**
- Surface card with internal vertical flex: scrollable stream + pinned input
- **Empty state (no messages):** centered icon bubble + "Ask anything about your documents" / "Upload some documents first" + 3 suggestion-chip buttons that pre-fill the input when there are ready docs.
- **Messages**
  - User: right-aligned, accent-coloured bubble, `border-bottom-right-radius: 4px`
  - Agent: left-aligned bubble with 30×30 gradient avatar (bot icon). `border-bottom-left-radius: 4px`. Surface-2 background, `1px` border.
  - Streaming: cursor `▊` blinks at end of message (1s `blink` keyframes). Tokens append 1–4 chars every 18–40ms (mock).
  - Error: `bubble.agent.err` — danger text + danger-soft background + red border. Triggered when SSE delivers `{"error": "..."}`.
- **Sources** (under each agent reply, collapsed `<details>`):
  - Summary chip: `Sources (N)` with rotating chevron
  - Each source: 22×22 accent number tile + meta line (`filename — page X`) + italic muted quote
- **Input row** (`chat-input`)
  - Surface card row with internal `input-wrap` (surface-2, rounded 12px, focus ring on focus-within) containing an auto-sizing textarea (max 140px height; Enter = send, Shift+Enter = newline)
  - 36×36 accent send button with arrow-up icon, disabled when input empty, mid-stream, or no Ready documents

**Disabled chat:** placeholder reads "Upload documents first"; send button is disabled.

---

## Interactions & Behavior

### Navigation
Single-page client routing (the prototype uses an in-memory `route` object — in production, use the router of choice: Next.js App Router or React Router v6).
- `/` → Dashboard
- `/agents/new` → Wizard (mode: new)
- `/agents/:id` → Detail
- `/agents/:id/edit` → Wizard (mode: edit, pre-populated)
- After Save in wizard → navigate to `/agents/:id`

### Wizard
- All values held in a single `form` state object, never destroyed when jumping between steps (UX Rule 1 in brief)
- Validation runs on attempt to advance; errors render inline (UX Rule 2)
- Stepper allows jumping back to any prior step freely. Jumping forward triggers validation of the current step first.
- Slide-in transition direction is `1` for forward, `-1` for back. `key={stepIdx}` on the wrapper retriggers the animation.

### Document ingestion
- On upload, each file appears immediately with `status: 'ingest'` and a placeholder ID
- The brief's UX Rule 3 specifies **polling every 3 seconds** while any document is `Ingesting`, stopping when all settle. In the prototype this is mocked with `setTimeout`. In production:
  ```ts
  useEffect(() => {
    const hasIngesting = docs.some(d => d.status === 'ingesting');
    if (!hasIngesting) return;
    const id = setInterval(() => refetch(), 3000);
    return () => clearInterval(id);
  }, [docs]);
  ```

### Chat streaming (Server-Sent Events)
- POST to `/api/v1/agents/:id/query` with `{ question, stream: true }`
- Each event: `data: {"token": "..."}` → append to current message
- Final event: `data: {"done": true}` → mark message non-streaming, reveal Sources
- Error event: `data: {"error": "..."}` → flip the bubble to `.err` class and stop streaming (UX Rule 5)

Use `fetch` + `ReadableStream` (not `EventSource`, which doesn't support POST):
```ts
const res = await fetch(url, { method: 'POST', headers: {...}, body: JSON.stringify(body) });
const reader = res.body!.getReader();
// decode chunks, split on `\n\n`, parse `data: ` prefix
```

### Delete confirmations
Every destructive action (delete agent, delete document) opens a centered modal with a translucent backdrop (`backdrop-filter: blur(4px)`), not the browser's `confirm()` (UX Rule 6).

### Animations
| Element | Animation |
|---|---|
| Card hover | `transform: translateY(-2px)` + shadow lift, 150ms |
| Step transitions | `translateX(±12px)` + opacity fade in, 250ms ease — gated behind `prefers-reduced-motion: no-preference` |
| Ingesting status dot | `pulse` 1.4s infinite — opacity + scale + ring |
| Streaming cursor | `blink` 1s infinite |
| Modal | backdrop `fadeIn` 150ms + modal `popIn` 180ms (`scale(.96) → 1` + opacity) |

### Theme toggle
Header sun/moon button flips `document.documentElement.dataset.theme` between `"dark"` and `"light"`. Both palettes are first-class — light mode adjusts surfaces, borders, chip backgrounds, and shadow values. Persist to localStorage.

---

## State Management

The prototype keeps everything in `App` state and persists to `localStorage` under `ragman.state.v1`. In production, model it as:

| State | Source |
|---|---|
| `agents: Agent[]` | `GET /api/v1/agents` (refetch on focus, optimistic on create/edit/delete) |
| `agent: Agent` (detail) | `GET /api/v1/agents/:id` |
| `documents: Document[]` | `GET /api/v1/agents/:id/documents` (poll every 3s when any ingesting) |
| `messages: Message[]` (chat) | Local only — not persisted in the brief |
| `theme` | `localStorage` |
| `wizardForm` | Local component state — never persisted (URL search params are fine for resumability) |

**Suggested fetch layer:** TanStack Query for `agents`/`documents`, with `useMutation` for create/edit/delete and `refetchInterval: 3000` conditional on `hasIngesting`.

### Agent shape
```ts
type Agent = {
  id: string;
  name: string;
  description: string;
  pipeline: PipelineConfig;
  documents?: Document[];
  docCount: number;
  status: 'ready' | 'ingest' | 'failed' | 'empty';
};

type PipelineConfig = {
  ingestion:    { type: 'pdf' | 'docx' | 'txt' | 'md' };
  chunking:     { type: 'fixed_size' | 'recursive' | 'semantic' | 'sentence_window';
                  params: { chunk_size?: number; chunk_overlap?: number;
                            similarity_threshold?: number; window_size?: number } };
  embedding:    { provider: 'openai' | 'huggingface' | 'ollama'; model: string };
  vector_store: { type: 'chroma' | 'pgvector' };
  retriever:    { type: 'similarity' | 'mmr' | 'hybrid' | 'multi_query';
                  params: { top_k?: number; bm25_weight?: number; lambda_mult?: number; num_queries?: number } };
  reranker:     null | { type: 'cohere' | 'huggingface' | 'llm'; params: { top_n?: number } };
  llm:          { provider: 'openai' | 'anthropic' | 'ollama'; model: string;
                  params: { temperature?: number; max_tokens?: number } };
};

type Document = {
  id: string;
  name: string;
  type: 'PDF' | 'Word' | 'Markdown' | 'Text';
  status: 'ready' | 'ingest' | 'failed';
  chunks: number | null;
  uploaded: string;       // ISO in production
  error?: string;
};
```

This matches the POST body the brief specifies. See `data.jsx` for the canonical default pipeline.

---

## Design Tokens

All tokens live as CSS custom properties at the top of `styles.css`. Port them to the codebase's token system (Tailwind config, CSS variables, theme object).

### Colours — Dark (default)
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0a0a0b` | Page background |
| `--bg-2` | `#111114` | Secondary background |
| `--surface` | `#16161a` | Card / panel |
| `--surface-2` | `#1c1c22` | Nested surface |
| `--surface-3` | `#232329` | Hover / chip background |
| `--border` | `#26262e` | Default border |
| `--border-strong` | `#34343f` | Stronger border, ghost button border |
| `--text` | `#f4f4f5` | Primary text |
| `--text-dim` | `#a1a1aa` | Secondary text |
| `--text-faint` | `#71717a` | Tertiary / labels |

### Colours — Light
| Token | Value |
|---|---|
| `--bg` | `#fafafa` |
| `--bg-2` | `#f4f4f5` |
| `--surface` | `#ffffff` |
| `--surface-2` | `#fafafa` |
| `--surface-3` | `#f4f4f5` |
| `--border` | `#e4e4e7` |
| `--border-strong` | `#d4d4d8` |
| `--text` | `#18181b` |
| `--text-dim` | `#52525b` |
| `--text-faint` | `#71717a` |

### Accent + semantic
| Token | Dark | Light | Usage |
|---|---|---|---|
| `--accent` | `#818cf8` (indigo-400) | `#6366f1` (indigo-500) | Hover, active step ring, links |
| `--accent-strong` | `#6366f1` | `#4f46e5` | Primary button, active stepper number |
| `--accent-soft` | `rgba(99,102,241,.14)` | `rgba(99,102,241,.10)` | Soft fills |
| `--success` | `#22c55e` | — | Ready badge |
| `--warn` | `#f59e0b` | — | Ingesting badge |
| `--danger` | `#ef4444` | — | Failed / destructive |

### Chip palettes (each stage gets a colour family)
| Stage | Class | Dot |
|---|---|---|
| Ingestion | `sky` | `#38bdf8` |
| Chunking | `violet` | `#a78bfa` |
| Embedding | `indigo` | `#818cf8` |
| Vector Store | `teal` | `#2dd4bf` |
| Retriever | `amber` | `#f59e0b` |
| Reranker | `rose` | `#fb7185` |
| LLM | `indigo` | `#818cf8` |

### Typography
- **Family:** `Inter` (Google Fonts), with feature settings `'cv11', 'ss01'` for cleaner numerals. Monospace `JetBrains Mono` for param hints.
- **Type scale:**
  - Page title: 28px / 600 / `-0.02em`
  - Detail title: 26px / 600 / `-0.02em`
  - Step title: 22px / 600 / `-0.02em`
  - Card title: 17px / 600 / `-0.015em`
  - Section heading: 15–16px / 600 / `-0.01em`
  - Radio card title: 14.5px / 600 / `-0.01em`
  - Body: 13.5–14px / 400–500 / line-height 1.5
  - Subtitle / hint: 13px / 400 / `--text-dim`
  - Kicker / table head / sidebar heading: 11–11.5px / 600 / uppercase / letter-spacing `.06–.08em` / `--text-faint`
  - Chip / badge: 11.5px / 500

### Radii
| Token | Value | Usage |
|---|---|---|
| `--r-sm` | 8px | Small chips, dropdown items |
| `--r-md` | 10px | Buttons (default), inputs |
| `--r-lg` | 14px | Lift cards, drop zone tiles, advanced grid groupings |
| `--r-xl` | 18px | Main surface cards |
| `--r-2xl` | 22px | Empty-state cards |

### Shadows
| Token | Value (dark) |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.4)` |
| `--shadow-md` | `0 4px 18px -4px rgba(0,0,0,.55), 0 2px 6px rgba(0,0,0,.4)` |
| `--shadow-lg` | `0 18px 40px -12px rgba(0,0,0,.6), 0 4px 10px rgba(0,0,0,.4)` |

Light-mode equivalents are softer — see the `[data-theme="light"]` block in `styles.css`.

### Spacing
The design uses a loose 4/6/8/10/12/14/18/20/24/28/32px scale. Notable:
- Card internal padding: 18px (small), 20px (card), 24px (large), 28px (wizard panel)
- Gap inside cards: 14px between rows
- Page padding: `28px 20px 80px`
- Navbar padding: `14px 20px`

### Background gradients
The app shell paints two soft radial gradients on top of `--bg`:
```css
background:
  radial-gradient(1200px 600px at 80% -10%, rgba(99,102,241,.08), transparent 60%),
  radial-gradient(900px 500px at -10% 10%, rgba(129,140,248,.06), transparent 60%),
  var(--bg);
```
Light mode uses the same gradients at lower opacity.

---

## Responsive Breakpoints

| Width | Behaviour |
|---|---|
| `< 560px` | Advanced-parameter grid collapses to 1 column |
| `< 640px` | Single-column dashboard grid; `+ New Agent` shrinks to `+ New`; status badge label hidden where space-constrained; navbar crumb truncates |
| `< 760px` | Document table → stacked cards with pseudo-element labels |
| `< 900px` | Wizard stepper → compact mobile bar; chat sidebar hidden |
| `≥ 900px` | Full chat layout (sidebar + main) |
| `≥ 1024px` | Designed for full layout per brief |

Use the brief's official breakpoints (`640 / 1024`) in the codebase; the prototype has a couple of intermediate breakpoints to handle dense controls cleanly.

---

## Icons

Lucide React (per brief). The prototype hand-rolls the icons as inline SVGs in `icons.jsx` because of the no-build constraint. Map:

| Prototype `<Icon name=…>` | Lucide React |
|---|---|
| `plus`, `arrow-right`, `arrow-left`, `arrow-up`, `chevron-right`, `chevron-down`, `check`, `x`, `edit`, `trash`, `more` (`MoreVertical`), `bot`, `sparkles`, `sun`, `moon`, `file`, `file-text`, `upload-cloud` (`UploadCloud`), `message` (`MessageSquare`), `send`, `database`, `search`, `layers`, `scissors`, `cpu`, `sliders` (`SlidersHorizontal`), `list`, `box`, `check-circle` (`CheckCircle2`), `alert` (`AlertCircle`), `loader` (`Loader2`), `menu`, `arrow-back` (`ArrowLeft`) | Same names; replace inline SVGs at usage sites |

Default stroke is `2`. Default sizes used: 12, 14, 16, 18, 26, 44 px.

---

## Assets

No raster assets are used. Everything is CSS / SVG / text.

- **Logo:** the gradient "R" tile in the navbar is a 28×28 `display: grid; place-items: center;` div with `linear-gradient(135deg, #6366f1, #a78bfa)` and a soft shadow. Replace with a real wordmark when one exists.
- **Favicon:** inlined as a `data:` SVG in `RAGman UI.html`.
- **Fonts:** Inter + JetBrains Mono via Google Fonts CDN. Self-host or use `next/font` in production.

---

## Files

All files sit at the root of the prototype project; in the handoff, they're copied into this folder alongside this README.

| File | Purpose |
|---|---|
| `RAGman UI.html` | Entry point — loads React + Babel from a CDN and mounts the JSX files |
| `styles.css` | All design tokens, base styles, and component styles |
| `icons.jsx` | Inline SVG icon component (Lucide-style) |
| `data.jsx` | Sample agents, pipeline metadata (`PIPELINE_META`), step list (`STEPS`), `DEFAULT_PIPELINE` |
| `shared.jsx` | `StatusBadge`, `PipelineChips`, `Modal`, `DotMenu` |
| `dashboard.jsx` | `Dashboard`, `AgentCard`, `EmptyDashboard` |
| `wizard.jsx` | `Wizard` shell + all 9 step components |
| `detail.jsx` | `AgentDetail`, `DocumentsTab`, `ChatTab`, `ChatBubble`, sample streaming responses |
| `app.jsx` | Root component, in-memory router, theme + localStorage persistence |
| `DESIGN_BRIEF.md` | The original design brief from the product owner |

---

## Implementation Notes

1. **Streaming UX** — keep the typewriter "cursor" cheap. Either an animated pseudo-element on the last text node, or render a `▊` character with a CSS `blink` keyframe. Don't re-render every token at React's top level; batch updates with `useRef` + `flushSync` or use a dedicated text-display component.
2. **Wizard state in URL** — consider serialising the wizard form to a `?step=N` search param so a reload doesn't lose progress. (The prototype only persists agents post-save.)
3. **Optimistic uploads** — show the uploading file immediately with `status: 'ingest'`. Poll until backend reports `ready` or `failed`.
4. **Empty-state ergonomics** — chat suggestion chips populate (not send) the input, so the user can tweak before submitting. Mirror this in production.
5. **Accessibility** — focus rings (`box-shadow: 0 0 0 3px var(--accent-ring)`) are set on inputs and buttons. Ensure interactive icons have `aria-label`s (the prototype does this), and that the radio cards announce as `role="radio"` inside a `role="radiogroup"` in your reimplementation (the prototype uses native `<button>`s for simplicity).
6. **Confirm modals** — bind Escape to close, focus the cancel button on open, and trap focus inside.
7. **Reduced motion** — the step-transition animation is already gated behind `prefers-reduced-motion: no-preference`. Verify your own animations follow the same pattern.

---

## Quick Start

To view the prototype locally:
```bash
# any static server — files use <script type="text/babel"> so they need to be served, not opened as file://
npx serve .
# then open http://localhost:3000/RAGman%20UI.html
```

The prototype writes to `localStorage` under `ragman.state.v1`. Clear it from devtools to reset to the sample agents.
