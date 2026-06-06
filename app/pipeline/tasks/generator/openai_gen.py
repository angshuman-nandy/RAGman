# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging
from typing import AsyncIterator

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext, RetrievedChunk
from app.pipeline.registry import register

logger = logging.getLogger(__name__)

_SYSTEM_TEMPLATE = (
    "You are a helpful assistant. Answer the user's question based ONLY on the provided context.\n"
    "If the context doesn't contain enough information, say so.\n"
    "Format your response using Markdown: use **bold** for key terms, bullet lists for multiple points, "
    "code blocks for any code or technical identifiers, and headers only when the answer is long enough to warrant sections.\n\n"
    "Context:\n{context_text}"
)


def _best_chunks(context: PipelineContext) -> list[RetrievedChunk]:
    """Return reranked chunks if available, otherwise retrieved chunks."""
    return context.reranked_chunks if context.reranked_chunks else context.retrieved_chunks


@register("generator", "openai")
class OpenAIGeneratorTask(BaseTask):
    """Generate an answer using OpenAI chat completions with streaming.

    Config keys
    -----------
    model : str
        OpenAI chat model name (default: ``"gpt-4o"``).
    temperature : float
        Sampling temperature (default: ``0.3``).
    max_tokens : int
        Maximum tokens in the completion (default: ``1024``).
    """

    def _build_system_prompt(self, context: PipelineContext, context_text: str) -> str:
        sp_cfg = context.pipeline_config.get("system_prompt") or {}
        mode = sp_cfg.get("mode", "append") if isinstance(sp_cfg, dict) else "append"
        custom_content = (sp_cfg.get("content", "") if isinstance(sp_cfg, dict) else "").strip()

        if mode == "replace" and custom_content:
            base = custom_content + "\n\nContext:\n" + context_text
        else:
            base = _SYSTEM_TEMPLATE.format(context_text=context_text)
            if custom_content:
                base = base.rstrip() + "\n\n" + custom_content

        g = context.pipeline_config.get("guardrails") or {}
        if isinstance(g, dict):
            parts = []
            if g.get("topic_restrictions"):
                parts.append(
                    f"TOPIC SCOPE: {g['topic_restrictions']} "
                    "Only answer questions within this scope; politely decline anything outside it."
                )
            if g.get("forbidden_content"):
                joined = ", ".join(g["forbidden_content"])
                parts.append(f"FORBIDDEN TOPICS: Do not discuss or provide information about: {joined}.")
            if g.get("format_rules"):
                parts.append(f"RESPONSE FORMAT: {g['format_rules']}")
            if parts:
                base += "\n\n[GUARDRAILS]\n" + "\n".join(parts)

        return base

    def _build_messages(self, context: PipelineContext) -> tuple[list[dict], list[RetrievedChunk]]:
        """Build the messages list and return the best chunks used."""
        best_chunks = _best_chunks(context)
        context_text = "\n\n".join(
            f"[{i + 1}] {chunk.content}" for i, chunk in enumerate(best_chunks)
        )
        system_prompt = self._build_system_prompt(context, context_text)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": context.query},
        ]
        return messages, best_chunks

    async def stream(self, context: PipelineContext) -> AsyncIterator[str]:
        import openai

        from app.core.config import get_settings

        settings = get_settings()
        model: str = self.config.get("model", "gpt-4o")
        temperature: float = float(self.config.get("temperature", 0.3))
        max_tokens: int = int(self.config.get("max_tokens", 1024))

        client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        messages, best_chunks = self._build_messages(context)

        # Populate sources before we start streaming so callers can access them.
        context.sources = [
            {"content": c.content[:200], "metadata": c.metadata, "score": c.score}
            for c in best_chunks
        ]

        try:
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            async for chunk in response:
                delta_content = chunk.choices[0].delta.content
                if delta_content:
                    yield delta_content
        except openai.OpenAIError as exc:
            logger.error("OpenAIGeneratorTask: API error during stream: %s", exc)
            context.errors.append(f"OpenAIGeneratorTask: {exc}")
            yield f"Error generating response: {exc}"

    async def run(self, context: PipelineContext) -> PipelineContext:
        tokens: list[str] = []
        try:
            async for token in self.stream(context):
                tokens.append(token)
        except Exception as exc:
            logger.error("OpenAIGeneratorTask: error collecting stream: %s", exc)
            context.errors.append(f"OpenAIGeneratorTask: {exc}")

        context.answer = "".join(tokens)
        logger.debug(
            "OpenAIGeneratorTask: generated answer (%d chars) with model %r.",
            len(context.answer),
            self.config.get("model", "gpt-4o"),
        )
        return context
