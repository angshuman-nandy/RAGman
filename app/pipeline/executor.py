# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging
from typing import AsyncIterator

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext
from app.pipeline.registry import get_task_class, load_all_tasks

# Ensure all @register() decorators have executed before the executor is used.
load_all_tasks()

logger = logging.getLogger(__name__)


def _get_stage_config(pipeline_config: dict, stage: str) -> dict:
    """
    Pull out the sub-config dict for a given pipeline stage.

    The pipeline_config is expected to have a top-level key per stage, e.g.::

        {
            "ingestion":    {"type": "pdf"},
            "chunking":     {"type": "fixed_size", "chunk_size": 512, ...},
            "embedding":    {"provider": "openai", "model": "text-embedding-3-small"},
            ...
        }

    Returns an empty dict if the stage key is missing so task constructors
    always receive a dict (never None).
    """
    return dict(pipeline_config.get(stage) or {})


def _resolve_task_name(stage_config: dict, stage: str) -> str:
    """
    Extract the logical task name from a stage config dict.

    Tries ``type`` first (ingestion/chunking/vector_store/retriever),
    then ``provider`` (embedding/reranker/generator), falling back to the
    bare stage name so callers get a clear KeyError from the registry.
    """
    return stage_config.get("type") or stage_config.get("provider") or stage


def _build_task(pipeline_config: dict, stage: str) -> BaseTask:
    """Instantiate the correct BaseTask subclass for *stage*."""
    stage_config = _get_stage_config(pipeline_config, stage)
    name = _resolve_task_name(stage_config, stage)
    task_cls = get_task_class(stage, name)
    return task_cls(config=stage_config)


class PipelineExecutor:
    """
    Orchestrates the two pipeline phases — ingestion and query — for a single
    RAGman agent.

    Parameters
    ----------
    agent_id:
        UUID (as string) of the owning agent.
    pipeline_config:
        The agent's full pipeline configuration dict (mirrors the ``pipeline_config``
        JSONB column on the ``agents`` table).
    """

    def __init__(self, agent_id: str, pipeline_config: dict) -> None:
        self.agent_id = agent_id
        self.pipeline_config = pipeline_config

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _make_context(self) -> PipelineContext:
        return PipelineContext(
            agent_id=self.agent_id,
            pipeline_config=self.pipeline_config,
        )

    async def _run_task(self, stage: str, context: PipelineContext) -> PipelineContext:
        """
        Resolve, instantiate, and execute a single pipeline task.

        Errors are appended to *context.errors* and re-raised so the caller
        can decide whether to continue or abort.
        """
        task = _build_task(self.pipeline_config, stage)
        logger.debug("Running stage=%r task=%r", stage, type(task).__name__)
        try:
            context = await task.run(context)
        except Exception as exc:
            msg = f"[{stage}] {type(exc).__name__}: {exc}"
            logger.exception("Pipeline task failed: %s", msg)
            context.errors.append(msg)
            raise
        return context

    # ------------------------------------------------------------------
    # Ingestion phase
    # ------------------------------------------------------------------

    async def run_ingestion(
        self,
        file_path: str,
        filename: str,
        file_type: str,
    ) -> PipelineContext:
        """
        Execute the ingestion pipeline for a single file.

        Stages (in order):
            1. ingestion   — parse the raw file into Document objects
            2. chunking    — split Documents into Chunks
            3. embedding   — compute vector embeddings for each Chunk
            4. vector_store — persist embedded Chunks to the vector database

        Returns the final PipelineContext.  The caller should inspect
        ``context.errors`` and ``context.chunks`` after the call.

        Any stage failure raises an exception (after recording it in
        ``context.errors``) so the caller can mark the document as failed.
        """
        context = self._make_context()
        # Seed the context with file metadata so the ingestion task knows
        # what to open.
        context.metadata.update(
            {
                "file_path": file_path,
                "filename": filename,
                "file_type": file_type,
            }
        )

        for stage in ("ingestion", "chunking", "embedding", "vector_store"):
            context = await self._run_task(stage, context)

        logger.info(
            "Ingestion complete for agent=%r file=%r: %d chunks, %d errors",
            self.agent_id,
            filename,
            len(context.chunks),
            len(context.errors),
        )
        return context

    # ------------------------------------------------------------------
    # Query phase
    # ------------------------------------------------------------------

    async def run_query(
        self, question: str, document_filter: list[str] | None = None
    ) -> AsyncIterator[str]:
        """
        Execute the query pipeline for *question* and yield token strings
        suitable for Server-Sent Events streaming.

        Stages (in order):
            1. retriever   — similarity / MMR / hybrid / multi-query search
            2. reranker    — (optional) reorder retrieved chunks
            3. generator   — stream an LLM answer token by token

        If a non-generator stage fails the error is yielded as a special
        ``data: [ERROR] …`` token and the generator is skipped.  If the
        generator itself fails mid-stream, a trailing error token is emitted.
        """
        context = self._make_context()
        context.query = question
        context.document_filter = document_filter

        # --- retriever -------------------------------------------------
        try:
            context = await self._run_task("retriever", context)
        except Exception as exc:
            yield f"[ERROR] retriever: {exc}"
            return

        # --- guard: nothing retrieved -----------------------------------
        if not context.retrieved_chunks:
            yield (
                "No relevant content found in the indexed documents. "
                "Make sure your documents have finished ingesting (status: Ready) "
                "before querying."
            )
            return

        # --- reranker (optional) ---------------------------------------
        reranker_config = _get_stage_config(self.pipeline_config, "reranker")
        if reranker_config:
            try:
                context = await self._run_task("reranker", context)
            except Exception as exc:
                # Reranker failure is non-fatal — fall back to retrieved_chunks.
                logger.warning("Reranker failed (%s); using un-reranked results.", exc)
                context.reranked_chunks = list(context.retrieved_chunks)
        else:
            # No reranker configured — pass retrieved chunks through unchanged.
            context.reranked_chunks = list(context.retrieved_chunks)

        # --- confidence threshold guardrail --------------------------------
        guardrails_cfg = _get_stage_config(self.pipeline_config, "guardrails")
        threshold = float(guardrails_cfg.get("confidence_threshold", 0.0)) if guardrails_cfg else 0.0
        best_chunks = context.reranked_chunks or context.retrieved_chunks
        if threshold > 0.0 and best_chunks:
            avg_score = sum(c.score for c in best_chunks) / len(best_chunks)
            if avg_score < threshold:
                yield (
                    f"I don't have enough confidence in the available information to answer "
                    f"this question reliably. "
                    f"(avg retrieval score: {avg_score:.2f}, required: {threshold:.2f})"
                )
                return

        # --- generator (streaming) ------------------------------------
        # Pipeline config stores LLM settings under "llm" key; registry uses "generator" stage.
        llm_config = _get_stage_config(self.pipeline_config, "llm")
        generator_name = _resolve_task_name(llm_config, "generator")

        try:
            generator_cls = get_task_class("generator", generator_name)
        except KeyError as exc:
            yield f"[ERROR] generator: {exc}"
            return

        generator_task: BaseTask = generator_cls(config=llm_config)

        try:
            async for token in generator_task.stream(context):
                yield token
        except Exception as exc:
            msg = f"[ERROR] generator stream: {type(exc).__name__}: {exc}"
            logger.exception("Generator stream failed.")
            context.errors.append(msg)
            yield msg
