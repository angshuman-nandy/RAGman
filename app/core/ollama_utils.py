# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import json
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Process-level cache — once a model is confirmed present we don't check again.
_confirmed: set[str] = set()


async def ensure_ollama_model(model: str) -> None:
    """Pull *model* from the Ollama registry if it is not already present.

    Safe to call on every request — subsequent calls for the same model are
    instant (guarded by an in-process set).  The pull streams progress lines
    from Ollama and waits until the model is fully downloaded before returning.
    """
    if model in _confirmed:
        return

    settings = get_settings()
    base_url = settings.OLLAMA_BASE_URL

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Check if the model already exists.
        try:
            resp = await client.get(f"{base_url}/api/tags")
            resp.raise_for_status()
            tags = resp.json()
            present = {m["name"].split(":")[0] for m in tags.get("models", [])}
            model_base = model.split(":")[0]
            if model_base in present:
                logger.info("Ollama model %r already present — skipping pull.", model)
                _confirmed.add(model)
                return
        except httpx.HTTPError as exc:
            logger.warning("Could not reach Ollama at %s: %s", base_url, exc)
            return

    # Pull the model — this can take a while on first run.
    logger.info("Pulling Ollama model %r — this may take a few minutes…", model)
    async with httpx.AsyncClient(timeout=600.0) as client:
        try:
            async with client.stream(
                "POST",
                f"{base_url}/api/pull",
                json={"name": model, "stream": True},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    status = data.get("status", "")
                    if status:
                        logger.debug("Ollama pull [%s]: %s", model, status)
                    if data.get("status") == "success":
                        break
            logger.info("Ollama model %r is ready.", model)
            _confirmed.add(model)
        except httpx.HTTPError as exc:
            logger.error("Failed to pull Ollama model %r: %s", model, exc)
