# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterator

from app.pipeline.context import PipelineContext


class BaseTask(ABC):
    """Base class for all pipeline tasks."""

    def __init__(self, config: dict | None = None) -> None:
        self.config: dict = config or {}

    @abstractmethod
    async def run(self, context: PipelineContext) -> PipelineContext:
        """Execute the task, mutate context, and return it."""
        ...

    async def validate_config(self, config: dict) -> None:
        """Optional: validate task-specific config. Raise ValueError on bad config."""
        pass

    async def stream(self, context: PipelineContext) -> AsyncIterator[str]:
        """
        Stream tokens from this task.

        By default, falls back to run() and yields the resulting answer as a
        single chunk.  Generator subclasses should override this method to
        yield tokens progressively as they arrive from the LLM.
        """
        context = await self.run(context)
        yield context.answer
