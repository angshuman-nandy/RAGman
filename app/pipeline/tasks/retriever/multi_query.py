# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import asyncio
import hashlib
import logging

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext, RetrievedChunk
from app.pipeline.registry import register

logger = logging.getLogger(__name__)


def _get_embedder(embedding_config: dict):
    provider = embedding_config["provider"]
    if provider == "openai":
        from app.pipeline.tasks.embedding.openai_embed import OpenAIEmbeddingTask

        return OpenAIEmbeddingTask(config=embedding_config)
    elif provider == "ollama":
        from app.pipeline.tasks.embedding.ollama_embed import OllamaEmbeddingTask

        return OllamaEmbeddingTask(config=embedding_config)
    else:
        from app.pipeline.tasks.embedding.huggingface_embed import HuggingFaceEmbeddingTask

        return HuggingFaceEmbeddingTask(config=embedding_config)


def _get_vector_store(vs_config: dict):
    vs_type = vs_config["type"]
    if vs_type == "chroma":
        from app.pipeline.tasks.vector_store.chroma import ChromaVectorStoreTask

        return ChromaVectorStoreTask(config=vs_config)
    else:
        from app.pipeline.tasks.vector_store.pgvector import PGVectorStoreTask

        return PGVectorStoreTask(config=vs_config)


# ---------------------------------------------------------------------------
# LLM helpers — one per supported provider
# ---------------------------------------------------------------------------

async def _generate_queries_openai(
    llm_config: dict, query: str, num_queries: int
) -> list[str]:
    import openai

    from app.core.config import get_settings

    settings = get_settings()
    model: str = llm_config.get("model", "gpt-4o-mini")
    prompt = (
        f"Generate {num_queries} different versions of the following question "
        "to retrieve relevant documents. "
        "Output only the questions, one per line.\n"
        f"Question: {query}"
    )

    client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    text = response.choices[0].message.content or ""
    return _parse_query_lines(text, num_queries)


async def _generate_queries_anthropic(
    llm_config: dict, query: str, num_queries: int
) -> list[str]:
    import anthropic

    from app.core.config import get_settings

    settings = get_settings()
    model: str = llm_config.get("model", "claude-3-haiku-20240307")
    prompt = (
        f"Generate {num_queries} different versions of the following question "
        "to retrieve relevant documents. "
        "Output only the questions, one per line.\n"
        f"Question: {query}"
    )

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = await client.messages.create(
        model=model,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    text = message.content[0].text if message.content else ""
    return _parse_query_lines(text, num_queries)


async def _generate_queries_ollama(
    llm_config: dict, query: str, num_queries: int
) -> list[str]:
    import httpx

    from app.core.config import get_settings
    from app.core.ollama_utils import ensure_ollama_model

    settings = get_settings()
    base_url: str = llm_config.get("base_url", settings.OLLAMA_BASE_URL)
    model: str = llm_config.get("model", "llama3")
    await ensure_ollama_model(model)
    prompt = (
        f"Generate {num_queries} different versions of the following question "
        "to retrieve relevant documents. "
        "Output only the questions, one per line.\n"
        f"Question: {query}"
    )

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(f"{base_url}/api/chat", json=payload)
        response.raise_for_status()
        data = response.json()

    text: str = data.get("message", {}).get("content", "")
    return _parse_query_lines(text, num_queries)


def _parse_query_lines(text: str, num_queries: int) -> list[str]:
    """Parse one-per-line query output, stripping numbering artifacts."""
    lines: list[str] = []
    for line in text.strip().splitlines():
        # Strip leading numbering like "1.", "1)", "-", "*"
        stripped = line.strip().lstrip("0123456789.-)*• ").strip()
        if stripped:
            lines.append(stripped)
    # Return at most num_queries variants
    return lines[:num_queries]


async def _generate_query_variants(
    llm_config: dict, query: str, num_queries: int
) -> list[str]:
    """Dispatch LLM query generation to the correct provider."""
    provider: str = llm_config.get("provider", "openai")
    try:
        if provider == "openai":
            return await _generate_queries_openai(llm_config, query, num_queries)
        elif provider == "anthropic":
            return await _generate_queries_anthropic(llm_config, query, num_queries)
        elif provider == "ollama":
            return await _generate_queries_ollama(llm_config, query, num_queries)
        else:
            logger.warning(
                "MultiQueryRetrieverTask: unknown LLM provider %r; skipping query expansion.",
                provider,
            )
            return []
    except Exception as exc:
        logger.error(
            "MultiQueryRetrieverTask: failed to generate query variants: %s", exc
        )
        return []


# ---------------------------------------------------------------------------
# Content hashing for deduplication
# ---------------------------------------------------------------------------

def _content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

@register("retriever", "multi_query")
class MultiQueryRetrieverTask(BaseTask):
    """Retrieve chunks by expanding the query into multiple phrasings and fusing results.

    Config keys
    -----------
    top_k : int
        Number of final chunks to return (default: ``5``).
    num_queries : int
        Number of alternative phrasings to generate (default: ``3``).
    """

    async def run(self, context: PipelineContext) -> PipelineContext:
        top_k: int = int(self.config.get("top_k", 5))
        num_queries: int = int(self.config.get("num_queries", 3))

        embedding_config: dict = context.pipeline_config["embedding"]
        vs_config: dict = context.pipeline_config["vector_store"]
        llm_config: dict = context.pipeline_config.get("llm", {})

        embedder = _get_embedder(embedding_config)
        vector_store = _get_vector_store(vs_config)

        # --- 1. Generate alternative query phrasings ---
        variants: list[str] = await _generate_query_variants(
            llm_config=llm_config,
            query=context.query,
            num_queries=num_queries,
        )
        all_queries: list[str] = [context.query] + variants

        logger.debug(
            "MultiQueryRetrieverTask: using %d queries (1 original + %d variants) for agent %r.",
            len(all_queries),
            len(variants),
            context.agent_id,
        )

        # --- 2. Embed all queries concurrently ---
        embed_tasks = [embedder.embed_texts([q]) for q in all_queries]
        embeddings_list = await asyncio.gather(*embed_tasks)
        # embeddings_list[i] is list[list[float]] with one element
        query_embeddings: list[list[float]] = [embs[0] for embs in embeddings_list]

        # --- 3. Similarity search for each query concurrently ---
        search_tasks = [
            vector_store.similarity_search(
                agent_id=context.agent_id,
                query_embedding=qe,
                top_k=top_k,
                source_filter=context.document_filter,
            )
            for qe in query_embeddings
        ]
        per_query_results: list[list[dict]] = await asyncio.gather(*search_tasks)

        # --- 4. Deduplicate by content hash; track frequency + cumulative score ---
        seen: dict[str, dict] = {}           # hash -> {"content", "metadata", "total_score", "count"}

        for results in per_query_results:
            for r in results:
                h = _content_hash(r["content"])
                if h not in seen:
                    seen[h] = {
                        "content": r["content"],
                        "metadata": r.get("metadata", {}),
                        "total_score": float(r.get("score", 0.0)),
                        "count": 1,
                    }
                else:
                    seen[h]["total_score"] += float(r.get("score", 0.0))
                    seen[h]["count"] += 1

        # --- 5. Score = frequency * avg_similarity; sort descending ---
        def _fused_score(entry: dict) -> float:
            avg_sim = entry["total_score"] / entry["count"]
            return entry["count"] * avg_sim

        ranked = sorted(seen.values(), key=_fused_score, reverse=True)

        # --- 6. Populate context ---
        context.retrieved_chunks = [
            RetrievedChunk(
                content=r["content"],
                metadata=r.get("metadata", {}),
                score=_fused_score(r),
            )
            for r in ranked[:top_k]
        ]

        logger.debug(
            "MultiQueryRetrieverTask: deduplicated to %d unique chunks (top_k=%d) for agent %r.",
            len(seen),
            top_k,
            context.agent_id,
        )
        return context

    async def validate_config(self, config: dict) -> None:
        for key in ("top_k", "num_queries"):
            if key in config and (not isinstance(config[key], int) or config[key] < 1):
                raise ValueError(f"{key} must be a positive integer.")
