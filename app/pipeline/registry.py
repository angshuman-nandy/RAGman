# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import importlib
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.pipeline.base import BaseTask

logger = logging.getLogger(__name__)

# (stage, name) -> BaseTask subclass
REGISTRY: dict[tuple[str, str], type[BaseTask]] = {}


def register(stage: str, name: str):
    """
    Class decorator that registers a BaseTask subclass under (stage, name).

    Usage::

        @register("chunking", "fixed_size")
        class FixedSizeChunker(BaseTask):
            ...
    """
    def decorator(cls: type[BaseTask]) -> type[BaseTask]:
        key = (stage, name)
        if key in REGISTRY:
            logger.warning(
                "Task %r is already registered under (%r, %r); overwriting.",
                REGISTRY[key].__name__,
                stage,
                name,
            )
        REGISTRY[key] = cls
        logger.debug("Registered task %r as (%r, %r).", cls.__name__, stage, name)
        return cls

    return decorator


def get_task_class(stage: str, name: str) -> type[BaseTask]:
    """
    Return the task class registered under (stage, name).

    Raises
    ------
    KeyError
        With a human-readable message listing what *is* registered for that
        stage so the caller can correct a typo quickly.
    """
    key = (stage, name)
    if key not in REGISTRY:
        available = [n for (s, n) in REGISTRY if s == stage]
        raise KeyError(
            f"No task registered for stage={stage!r}, name={name!r}. "
            f"Available names for stage {stage!r}: {sorted(available) or '(none)'}"
        )
    return REGISTRY[key]


def list_tasks() -> dict[tuple[str, str], type[BaseTask]]:
    """Return a copy of the full registry for introspection."""
    return dict(REGISTRY)


# ---------------------------------------------------------------------------
# Lazy bulk-import — call this once at application start-up so every task
# module executes its @register() decorators.
# ---------------------------------------------------------------------------

_TASK_MODULES: list[str] = [
    # ingestion
    "app.pipeline.tasks.ingestion.pdf",
    "app.pipeline.tasks.ingestion.docx",
    "app.pipeline.tasks.ingestion.text",
    # chunking
    "app.pipeline.tasks.chunking.fixed_size",
    "app.pipeline.tasks.chunking.recursive",
    "app.pipeline.tasks.chunking.semantic",
    "app.pipeline.tasks.chunking.sentence_window",
    "app.pipeline.tasks.chunking.doc_aware",
    # embedding
    "app.pipeline.tasks.embedding.openai_embed",
    "app.pipeline.tasks.embedding.huggingface_embed",
    "app.pipeline.tasks.embedding.ollama_embed",
    # vector store
    "app.pipeline.tasks.vector_store.chroma",
    "app.pipeline.tasks.vector_store.pgvector",
    # retriever
    "app.pipeline.tasks.retriever.similarity",
    "app.pipeline.tasks.retriever.mmr",
    "app.pipeline.tasks.retriever.hybrid",
    "app.pipeline.tasks.retriever.multi_query",
    # reranker
    "app.pipeline.tasks.reranker.cohere",
    "app.pipeline.tasks.reranker.huggingface",
    "app.pipeline.tasks.reranker.llm_reranker",
    # generator
    "app.pipeline.tasks.generator.openai_gen",
    "app.pipeline.tasks.generator.anthropic_gen",
    "app.pipeline.tasks.generator.ollama_gen",
]

_tasks_loaded = False


def load_all_tasks() -> None:
    """
    Import every task module so their @register() decorators fire.

    Safe to call multiple times — subsequent calls are no-ops.
    """
    global _tasks_loaded
    if _tasks_loaded:
        return

    for module_path in _TASK_MODULES:
        try:
            importlib.import_module(module_path)
        except ModuleNotFoundError as exc:
            # A missing optional dependency (e.g. chromadb not installed) should
            # not crash the whole application — warn and skip.
            logger.warning("Could not import task module %r: %s", module_path, exc)
        except Exception:
            logger.exception("Unexpected error importing task module %r.", module_path)

    _tasks_loaded = True
