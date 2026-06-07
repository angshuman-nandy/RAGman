# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import json
import logging
import re

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext
from app.pipeline.registry import register

logger = logging.getLogger(__name__)


def _parse_meta(raw) -> dict:
    """Decode a JSONB row value that asyncpg may return as a string or dict."""
    if not raw:
        return {}
    if isinstance(raw, str):
        return json.loads(raw)
    return dict(raw)

# Only allow safe characters in table name suffixes derived from agent UUIDs.
_SAFE_ID_RE = re.compile(r"[^a-zA-Z0-9_]")


def _table_name(agent_id: str) -> str:
    """Return a safe PostgreSQL table name for *agent_id*."""
    sanitized = _SAFE_ID_RE.sub("_", agent_id)
    return f"vectors_{sanitized}"


def _dsn(database_url: str) -> str:
    """Strip any SQLAlchemy dialect suffix so asyncpg can accept the URL."""
    # e.g. "postgresql+asyncpg://..." -> "postgresql://..."
    return re.sub(r"\+[^:/]+", "", database_url, count=1)


@register("vector_store", "pgvector")
class PGVectorStoreTask(BaseTask):
    """Persist embedded chunks to PostgreSQL using the pgvector extension.

    Uses ``asyncpg`` for raw SQL so vector literals can be passed directly
    without an ORM layer.

    Connection string is read from ``settings.DATABASE_URL`` and requires no
    task-level config.

    Table per agent
    ---------------
    ``vectors_{agent_id_sanitized}``

    Schema
    ------
    ::

        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid()
        content     TEXT
        embedding   vector(N)
        metadata    JSONB
        created_at  TIMESTAMPTZ DEFAULT now()

    An IVFFlat cosine index is created alongside the table.
    """

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_connection(self):
        """Open and return a new asyncpg connection."""
        import asyncpg

        from app.core.config import get_settings

        settings = get_settings()
        conn = await asyncpg.connect(_dsn(settings.DATABASE_URL))
        return conn

    async def _ensure_table(self, conn, table: str, dim: int) -> None:
        """Create the table and index for *table* if they do not already exist."""
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")

        await conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {table} (
                id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                content     TEXT        NOT NULL,
                embedding   vector({dim}),
                metadata    JSONB       NOT NULL DEFAULT '{{}}',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )

        index_name = f"{table}_embedding_idx"
        await conn.execute(
            f"""
            CREATE INDEX IF NOT EXISTS {index_name}
            ON {table}
            USING ivfflat (embedding vector_cosine_ops)
            """
        )

    # ------------------------------------------------------------------
    # BaseTask
    # ------------------------------------------------------------------

    async def run(self, context: PipelineContext) -> PipelineContext:
        chunks = context.chunks
        if not chunks:
            logger.debug("PGVectorStoreTask: no chunks to store, skipping.")
            return context

        missing = [i for i, c in enumerate(chunks) if c.embedding is None]
        if missing:
            msg = (
                f"PGVectorStoreTask: {len(missing)} chunk(s) have no embedding "
                f"(indices {missing[:10]}{'...' if len(missing) > 10 else ''}). "
                "Run an embedding task before this vector-store task."
            )
            logger.error(msg)
            context.errors.append(msg)
            return context

        dim = len(chunks[0].embedding)  # type: ignore[arg-type]
        table = _table_name(context.agent_id)

        conn = await self._get_connection()
        try:
            # Check existing dimension before creating/inserting to surface a
            # clear error instead of a cryptic DataError from pgvector.
            existing_dim = await conn.fetchval(
                """
                SELECT atttypmod
                FROM pg_attribute
                JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
                WHERE pg_class.relname = $1
                  AND pg_attribute.attname = 'embedding'
                  AND pg_attribute.attnum > 0
                """,
                table,
            )
            if existing_dim is not None and existing_dim != dim:
                raise ValueError(
                    f"Embedding dimension mismatch: this agent's table was built "
                    f"with {existing_dim}-dim vectors but the current embedding model "
                    f"produces {dim}-dim vectors. "
                    f"Delete this agent and recreate it to switch embedding models."
                )

            await self._ensure_table(conn, table, dim)

            # Bulk-insert using a prepared statement for efficiency.
            rows = [
                (
                    c.content,
                    # pgvector expects the text representation "[1,2,3,...]"
                    "[" + ",".join(str(v) for v in c.embedding) + "]",
                    json.dumps(c.metadata),
                )
                for c in chunks
            ]
            await conn.executemany(
                f"""
                INSERT INTO {table} (content, embedding, metadata)
                VALUES ($1, $2::vector, $3::jsonb)
                """,
                rows,
            )
            logger.debug(
                "PGVectorStoreTask: stored %d chunks in table %r for agent %r.",
                len(chunks),
                table,
                context.agent_id,
            )
        except Exception as exc:
            msg = f"PGVectorStoreTask: failed to store chunks: {exc}"
            logger.error(msg)
            context.errors.append(msg)
            raise
        finally:
            await conn.close()

        return context

    # ------------------------------------------------------------------
    # Retrieval helpers (used by retriever tasks)
    # ------------------------------------------------------------------

    async def similarity_search(
        self,
        agent_id: str,
        query_embedding: list[float],
        top_k: int,
        source_filter: list[str] | None = None,
    ) -> list[dict]:
        """Return the *top_k* most similar chunks to *query_embedding*.

        Uses the cosine-distance operator ``<=>`` provided by pgvector.

        Returns
        -------
        list of dicts with keys ``content``, ``metadata``, ``score``.
        """
        table = _table_name(agent_id)
        vec_literal = "[" + ",".join(str(v) for v in query_embedding) + "]"

        conn = await self._get_connection()
        try:
            if source_filter:
                rows = await conn.fetch(
                    f"""
                    SELECT
                        content,
                        metadata,
                        1 - (embedding <=> $1::vector) AS score
                    FROM {table}
                    WHERE metadata->>'source' = ANY($2::text[])
                    ORDER BY embedding <=> $1::vector
                    LIMIT $3
                    """,
                    vec_literal,
                    source_filter,
                    top_k,
                )
            else:
                rows = await conn.fetch(
                    f"""
                    SELECT
                        content,
                        metadata,
                        1 - (embedding <=> $1::vector) AS score
                    FROM {table}
                    ORDER BY embedding <=> $1::vector
                    LIMIT $2
                    """,
                    vec_literal,
                    top_k,
                )
        except Exception as exc:
            logger.error(
                "PGVectorStoreTask.similarity_search: query failed for agent %r: %s",
                agent_id,
                exc,
            )
            raise
        finally:
            await conn.close()

        return [
            {
                "content": row["content"],
                "metadata": _parse_meta(row["metadata"]),
                "score": float(row["score"]),
            }
            for row in rows
        ]

    async def fetch_all_chunks(
        self,
        agent_id: str,
        source_filename: str,
    ) -> list[dict]:
        """Return all chunks for *source_filename* with their embeddings."""
        table = _table_name(agent_id)
        conn = await self._get_connection()
        try:
            # Check table exists first
            exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=$1)",
                table,
            )
            if not exists:
                return []
            rows = await conn.fetch(
                f"""
                SELECT content, metadata, embedding::text
                FROM {table}
                WHERE metadata->>'source' = $1
                ORDER BY (metadata->>'chunk_index')::int NULLS LAST
                """,
                source_filename,
            )
        finally:
            await conn.close()

        result = []
        for row in rows:
            # Parse pgvector text representation "[1.0,2.0,...]" to list[float]
            emb_str = row["embedding"] or "[]"
            emb = [float(x) for x in emb_str.strip("[]").split(",") if x.strip()]
            result.append({
                "content": row["content"],
                "metadata": _parse_meta(row["metadata"]),
                "embedding": emb,
            })
        return result

    async def delete_chunks_for_source(self, agent_id: str, source_filename: str) -> int:
        """Delete all chunks for source_filename. Returns count deleted."""
        table = _table_name(agent_id)
        conn = await self._get_connection()
        try:
            exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=$1)", table
            )
            if not exists:
                return 0
            result = await conn.execute(
                f"DELETE FROM {table} WHERE metadata->>'source' = $1", source_filename
            )
            return int(result.split()[-1])
        finally:
            await conn.close()

    async def delete_chunks_for_doc(self, agent_id: str, doc_id: str) -> int:
        """Delete all chunks tagged with doc_id. Returns count deleted."""
        table = _table_name(agent_id)
        conn = await self._get_connection()
        try:
            exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=$1)", table
            )
            if not exists:
                return 0
            result = await conn.execute(
                f"DELETE FROM {table} WHERE metadata->>'doc_id' = $1", doc_id
            )
            return int(result.split()[-1])
        finally:
            await conn.close()

    async def delete_table(self, agent_id: str) -> None:
        """Drop the vectors table for *agent_id* — called when an agent or
        document set is removed."""
        table = _table_name(agent_id)
        conn = await self._get_connection()
        try:
            await conn.execute(f"DROP TABLE IF EXISTS {table}")
            logger.info(
                "PGVectorStoreTask: dropped table %r for agent %r.", table, agent_id
            )
        except Exception as exc:
            logger.error(
                "PGVectorStoreTask.delete_table: failed to drop %r: %s", table, exc
            )
            raise
        finally:
            await conn.close()
