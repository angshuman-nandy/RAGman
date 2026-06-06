# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext, RetrievedChunk
from app.pipeline.registry import register

logger = logging.getLogger(__name__)

_SCORE_PROMPT = (
    "Given the question: '{query}'\n"
    "Rate the relevance of this passage (1-10):\n"
    "'{content}'\n"
    "Respond with only a number."
)

_DEFAULT_TOP_N = 5
_PRE_FILTER_LIMIT = 10  # if more than this many chunks, pre-filter by existing score


@register("reranker", "llm")
class LLMRerankerTask(BaseTask):
    """Rerank retrieved chunks by asking the agent's configured LLM to score each one.

    Config keys
    -----------
    top_n : int
        Number of top chunks to keep after reranking (default: ``5``).

    The LLM provider is read from ``context.pipeline_config["llm"]["provider"]``.
    Supported providers: ``"openai"``, ``"anthropic"``, ``"ollama"``.
    """

    # ------------------------------------------------------------------
    # Provider-specific scoring helpers
    # ------------------------------------------------------------------

    async def _score_openai(
        self, query: str, content: str, llm_config: dict
    ) -> float:
        import openai

        from app.core.config import get_settings

        settings = get_settings()
        model: str = llm_config.get("model", "gpt-4o-mini")
        client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        prompt = _SCORE_PROMPT.format(query=query, content=content)
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=8,
                temperature=0.0,
            )
            raw = response.choices[0].message.content or ""
            return float(raw.strip())
        except (openai.OpenAIError, ValueError) as exc:
            logger.warning("LLMRerankerTask[openai]: scoring error: %s", exc)
            return 0.0

    async def _score_anthropic(
        self, query: str, content: str, llm_config: dict
    ) -> float:
        import anthropic

        from app.core.config import get_settings

        settings = get_settings()
        model: str = llm_config.get("model", "claude-haiku-4-5")
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        prompt = _SCORE_PROMPT.format(query=query, content=content)
        try:
            message = await client.messages.create(
                model=model,
                max_tokens=8,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text if message.content else ""
            return float(raw.strip())
        except (anthropic.APIError, ValueError) as exc:
            logger.warning("LLMRerankerTask[anthropic]: scoring error: %s", exc)
            return 0.0

    async def _score_ollama(
        self, query: str, content: str, llm_config: dict
    ) -> float:
        import json

        import httpx

        from app.core.config import get_settings
        from app.core.ollama_utils import ensure_ollama_model

        settings = get_settings()
        model: str = llm_config.get("model", "llama3.2")
        await ensure_ollama_model(model)
        url = f"{settings.OLLAMA_BASE_URL}/api/chat"

        prompt = _SCORE_PROMPT.format(query=query, content=content)
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                raw = data.get("message", {}).get("content", "")
                return float(raw.strip())
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            logger.warning("LLMRerankerTask[ollama]: scoring error: %s", exc)
            return 0.0

    # ------------------------------------------------------------------
    # Core logic
    # ------------------------------------------------------------------

    async def _score_chunk(
        self, query: str, content: str, llm_config: dict, provider: str
    ) -> float:
        if provider == "openai":
            return await self._score_openai(query, content, llm_config)
        elif provider == "anthropic":
            return await self._score_anthropic(query, content, llm_config)
        elif provider == "ollama":
            return await self._score_ollama(query, content, llm_config)
        else:
            logger.warning(
                "LLMRerankerTask: unsupported provider %r, returning score 0.", provider
            )
            return 0.0

    async def run(self, context: PipelineContext) -> PipelineContext:
        chunks = context.retrieved_chunks
        if not chunks:
            logger.debug("LLMRerankerTask: no retrieved chunks to rerank, skipping.")
            context.reranked_chunks = []
            return context

        top_n: int = int(self.config.get("top_n", _DEFAULT_TOP_N))
        llm_config: dict = context.pipeline_config.get("llm", {})
        provider: str = llm_config.get("provider", "openai")

        # Pre-filter: if we have more than _PRE_FILTER_LIMIT chunks, trim by
        # existing score first to keep LLM calls bounded.
        candidates = list(chunks)
        if len(candidates) > _PRE_FILTER_LIMIT:
            candidates.sort(key=lambda c: c.score, reverse=True)
            candidates = candidates[:_PRE_FILTER_LIMIT]
            logger.debug(
                "LLMRerankerTask: pre-filtered %d → %d chunks by existing score.",
                len(chunks),
                len(candidates),
            )

        # Score each candidate concurrently.
        import asyncio

        score_tasks = [
            self._score_chunk(context.query, chunk.content, llm_config, provider)
            for chunk in candidates
        ]
        try:
            scores: list[float] = await asyncio.gather(*score_tasks)
        except Exception as exc:
            logger.error("LLMRerankerTask: gather error during scoring: %s", exc)
            context.errors.append(f"LLMRerankerTask: {exc}")
            context.reranked_chunks = list(chunks)
            return context

        scored: list[tuple[float, RetrievedChunk]] = [
            (
                score,
                RetrievedChunk(
                    content=chunk.content, metadata=chunk.metadata, score=score
                ),
            )
            for score, chunk in zip(scores, candidates)
        ]
        scored.sort(key=lambda t: t[0], reverse=True)
        scored = scored[:top_n]

        context.reranked_chunks = [chunk for _, chunk in scored]

        logger.debug(
            "LLMRerankerTask: reranked %d candidates → %d kept, provider=%r.",
            len(candidates),
            len(context.reranked_chunks),
            provider,
        )
        return context
