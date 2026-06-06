# RAGman Backend Refactor Plan

**Scope:** Backend only (`app/`). Every item below is behavior-preserving — no API contract, response shape, or pipeline output changes. Grouped by risk/confidence so they can be tackled independently.

---

## Tier 1 — Safe (byte-identical duplication)

These are exact copies today; extracting them carries near-zero risk.

### 1.1 Shared retriever helpers
**Problem:** `_get_embedder()` and `_get_vector_store()` are byte-identical in all 4 retriever files:
- `app/pipeline/tasks/retriever/similarity.py` (lines 12–37)
- `app/pipeline/tasks/retriever/mmr.py` (lines 14–39)
- `app/pipeline/tasks/retriever/hybrid.py` (lines 17–42)
- `app/pipeline/tasks/retriever/multi_query.py` (lines 14–39)

**Fix:** Create `app/pipeline/tasks/_helpers.py` exposing `get_embedder(embedding_config)` and `get_vector_store(vs_config)`. Replace the 4 local copies with `from app.pipeline.tasks._helpers import get_embedder, get_vector_store`.

**Note:** Keep the lazy imports of embedding/vector-store classes *inside* the helper functions (they exist to avoid circular imports) — just move them into the single shared copy.

### 1.2 Shared generator prompt logic
**Problem:** `_SYSTEM_TEMPLATE`, `_best_chunks()`, and `_build_system_prompt()` are byte-identical across:
- `app/pipeline/tasks/generator/openai_gen.py`
- `app/pipeline/tasks/generator/anthropic_gen.py`
- `app/pipeline/tasks/generator/ollama_gen.py`

(~60 lines duplicated × 3.)

**Fix:** Create `app/pipeline/tasks/generator/_shared.py` with:
- `SYSTEM_TEMPLATE` (constant)
- `best_chunks(context) -> list[RetrievedChunk]`
- `build_system_prompt(context, context_text) -> str`

`build_system_prompt` is currently an instance method but uses **no instance state** (only `context` + `context_text`), so it converts cleanly to a module-level function. Each generator changes `self._build_system_prompt(context, ctx_text)` → `build_system_prompt(context, ctx_text)` and drops its local copies.

**Verification:** The produced system prompt string must be identical for the same inputs. Spot-check with one agent that has a custom system prompt + guardrails and one without.

### 1.3 Shared agent-fetch 404 helper
**Problem:** `_get_agent_or_404()` is duplicated in:
- `app/api/routes/documents.py` (lines 47–55)
- `app/api/routes/query.py` (lines 35–43)

and `documents.py` also has `_get_agent_and_doc()` (lines 58–74) with a redundant inline `import Agent` and ad-hoc `status_code=404` literals.

**Fix:** Add `get_agent_or_404(agent_id, db)` and `get_agent_and_doc_or_404(agent_id, doc_id, db)` to `app/api/deps.py` (or a new `app/api/helpers.py`). Import in both routers. Normalize the inline `404` literals to `status.HTTP_404_NOT_FOUND` and move the `Agent` import to module top.

---

## Tier 2 — Low risk (small structural cleanups)

### 2.1 Vector-store `_safe_list` utility
**Problem:** `_safe_list()` (numpy→list coercion) lives only in `chroma.py` (lines 268–273); the same numpy-vs-list ambiguity has already caused 2 production bugs this project.

**Fix:** Move `_safe_list()` to `app/pipeline/tasks/vector_store/_helpers.py` and import it in both `chroma.py` and `pgvector.py`. Use it anywhere embeddings come back from the store (defensive, prevents the recurring "truth value of an array is ambiguous" class of bug).

### 2.2 Doc-count subquery helper
**Problem:** The correlated `func.count(Document.id)` subquery is hand-built 3× in `app/api/routes/agents.py` (list, get, update endpoints).

**Fix:** Add a small `_document_count_subquery()` (or `_document_count_for(agent_id)`) helper at the top of `agents.py` and reuse it in all three endpoints. Keep `_agent_to_response(agent, document_count)` signature unchanged.

### 2.3 Embedding `run()` consolidation
**Problem:** The `run()` method (iterate chunks → `embed_texts()` → assign `.embedding` → log) is identical across `openai_embed.py`, `ollama_embed.py`, `huggingface_embed.py`. Only `embed_texts()` differs per provider.

**Fix:** Introduce a thin `BaseEmbeddingTask(BaseTask)` in `app/pipeline/tasks/embedding/_base.py` that implements `run()` and declares `embed_texts()` as the abstract hook. Each provider subclass keeps only its `embed_texts()`. **Do not** try to share the batching loop — it differs (sync thread-executor for HF vs async API calls) and is intentionally provider-specific.

---

## Tier 3 — Medium risk (more involved; optional)

### 3.1 Shared LLM provider dispatch
**Problem:** `multi_query.py` (query-variant generation) and `reranker/llm_reranker.py` (relevance scoring) both implement an openai/anthropic/ollama dispatch with near-identical client setup and provider branching — only the prompt and response parsing differ.

**Fix:** Add `app/pipeline/_llm_helpers.py` with a single `async def call_llm(llm_config, system, user, max_tokens) -> str` that owns the provider branching + client creation. The two call sites keep their own prompt construction and result parsing but delegate the actual call.

**Risk:** Each call site has slightly different params (e.g. `max_tokens`, temperature handling). Verify multi-query still returns N variants and the reranker still parses integer scores. Test all 3 providers.

---

## Cross-cutting (apply during the above)

- **Inline imports:** Many functions do `from app.core.config import get_settings` inline. Keep inline imports only where they guard *optional SDKs* (openai, anthropic, cohere, chromadb) or break import cycles. `get_settings` itself can move to module top in files that already import other app modules. Low priority — do opportunistically, don't churn files solely for this.

---

## Suggested order

1. Tier 1.1 (retriever helpers) — isolated, 4 files
2. Tier 1.2 (generator shared) — isolated, 3 files
3. Tier 1.3 (agent-fetch helper) — 2 routers + deps
4. Tier 2.1 / 2.2 (vector-store util, doc-count helper)
5. Tier 2.3 (embedding base class)
6. Tier 3.1 (LLM dispatch) — only if appetite remains

Each tier is independent and can ship separately.

---

## Verification (per tier)

Run the stack (`docker compose up`) and confirm no behavioral change:

1. **Retriever (1.1):** Run the Retrieval Playground (Document Overview → Retrieval) with all 4 strategies — same ranked results as before.
2. **Generator (1.2):** Chat with one agent that has a custom system prompt + guardrails and one default agent — answers stream identically; guardrails still enforced.
3. **API helpers (1.3, 2.2):** `GET /api/v1/agents` returns correct `document_count`; querying a missing agent/doc still returns 404 with the same message.
4. **Vector store (2.1):** Re-run Embeddings tab (UMAP + heatmap) for both Chroma and pgvector agents — no numpy errors.
5. **Embedding (2.3):** Upload + ingest a doc with each provider (OpenAI, HuggingFace, Ollama) — chunk counts and statuses unchanged.
6. **LLM dispatch (3.1):** Multi-query retriever returns the configured number of variants; LLM reranker reorders results, across all 3 providers.

No DB migration required. No frontend changes. No `pyproject.toml` changes.
