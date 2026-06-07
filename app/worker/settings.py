# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

from arq.connections import RedisSettings

from app.core.config import get_settings
from app.worker.tasks import run_deletion_job, run_ingestion_job

_settings = get_settings()


class WorkerSettings:
    functions = [run_ingestion_job, run_deletion_job]
    redis_settings = RedisSettings.from_dsn(_settings.REDIS_URL)
