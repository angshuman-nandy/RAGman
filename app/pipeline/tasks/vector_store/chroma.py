# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Angshuman Nandy
from __future__ import annotations

import logging
from uuid import uuid4

from app.pipeline.base import BaseTask
from app.pipeline.context import PipelineContext
from app.pipeline.registry import register

logger = logging.getLogger(__name__)


@register("vector_store", "chroma")
class ChromaVectorStoreTask(BaseTask):
    """Persist embedded chunks to a remote ChromaDB instance.

    Connection parameters are taken from application settings
    (``CHROMA_HOST``, ``CHROMA_PORT``) and require no task-level config.

    The collection is named ``agent_{context.agent_id}`` and uses cosine
    similarity (HNSW index).
    """

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_collection(self, agent_id: str):
        """Return (or create) the ChromaDB collection for *agent_id*."""
        import chromadb

        from app.core.config import get_settings

        settings = get_settings()
        client = await chromadb.AsyncHttpClient(
            host=settings.CHROMA_HOST,
            port=settings.CHROMA_PORT,
        )
        collection_name = f"agent_{agent_id}"
        collection = await client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        return collection

    # ------------------------------------------------------------------
    # BaseTask
    # ------------------------------------------------------------------

    async def run(self, context: PipelineContext) -> PipelineContext:
        chunks = context.chunks
        if not chunks:
            logger.debug("ChromaVectorStoreTask: no chunks to store, skipping.")
            return context

        missing = [i for i, c in enumerate(chunks) if c.embedding is None]
        if missing:
            msg = (
                f"ChromaVectorStoreTask: {len(missing)} chunk(s) have no embedding "
                f"(indices {missing[:10]}{'...' if len(missing) > 10 else ''}). "
                "Run an embedding task before this vector-store task."
            )
            logger.error(msg)
            context.errors.append(msg)
            return context

        try:
            collection = await self._get_collection(context.agent_id)

            # Validate embedding dimension against the existing collection before
            # writing, so we surface a clear error instead of a cryptic ChromaDB crash.
            new_dim = len(chunks[0].embedding)  # type: ignore[arg-type]
            collection_meta = await collection.get(limit=1, include=["embeddings"])
            existing_embeddings = collection_meta.get("embeddings")
            if (
                existing_embeddings is not None
                and len(existing_embeddings) > 0
                and existing_embeddings[0] is not None
                and len(existing_embeddings[0]) > 0
            ):
                existing_dim = len(existing_embeddings[0])
                if existing_dim != new_dim:
                    raise ValueError(
                        f"Embedding dimension mismatch: this agent's collection was built "
                        f"with {existing_dim}-dim vectors but the current embedding model "
                        f"produces {new_dim}-dim vectors. "
                        f"Delete this agent and recreate it to switch embedding models."
                    )

            await collection.add(
                ids=[str(uuid4()) for _ in chunks],
                documents=[c.content for c in chunks],
                embeddings=[c.embedding for c in chunks],  # type: ignore[arg-type]
                metadatas=[c.metadata for c in chunks],
            )
            logger.debug(
                "ChromaVectorStoreTask: stored %d chunks for agent %r.",
                len(chunks),
                context.agent_id,
            )
        except Exception as exc:
            msg = f"ChromaVectorStoreTask: failed to store chunks: {exc}"
            logger.error(msg)
            context.errors.append(msg)
            raise

        return context

    # ------------------------------------------------------------------
    # Retrieval helpers (used by retriever tasks)
    # ------------------------------------------------------------------

    async def similarity_search(
        self,
        agent_id: str,
        query_embedding: list[float],
        top_k: int,
        where: dict | None = None,
        source_filter: list[str] | None = None,
    ) -> list[dict]:
        """Return the *top_k* most similar chunks to *query_embedding*.

        Returns
        -------
        list of dicts with keys ``content``, ``metadata``, ``score``.
        """
        # Build where from source_filter when no explicit where is given
        if source_filter and not where:
            if len(source_filter) == 1:
                where = {"source": source_filter[0]}
            else:
                where = {"$or": [{"source": s} for s in source_filter]}

        try:
            collection = await self._get_collection(agent_id)

            # Cap n_results to the actual collection size — ChromaDB raises
            # InvalidArgumentError if you request more results than exist.
            count = await collection.count()
            if count == 0:
                return []
            n_results = min(top_k, count)

            query_kwargs: dict = dict(
                query_embeddings=[query_embedding],
                n_results=n_results,
                include=["documents", "metadatas", "distances"],
            )
            if where:
                query_kwargs["where"] = where

            result = await collection.query(**query_kwargs)
        except Exception as exc:
            logger.error(
                "ChromaVectorStoreTask.similarity_search: query failed: %s", exc
            )
            raise

        docs = result["documents"][0]
        metas = result["metadatas"][0]
        # Chroma returns L2 or cosine *distances*; convert distance → similarity.
        distances = result["distances"][0]

        return [
            {"content": doc, "metadata": meta, "score": 1.0 - dist}
            for doc, meta, dist in zip(docs, metas, distances)
        ]

    async def mmr_search(
        self,
        agent_id: str,
        query_embedding: list[float],
        top_k: int,
        fetch_k: int,
        lambda_mult: float = 0.5,
    ) -> list[dict]:
        """Maximal Marginal Relevance search.

        Fetches *fetch_k* candidates from Chroma, then re-ranks them with MMR
        to balance relevance and diversity before returning *top_k* results.

        Returns
        -------
        list of dicts with keys ``content``, ``metadata``, ``score``.
        """
        import numpy as np

        try:
            collection = await self._get_collection(agent_id)
            count = await collection.count()
            if count == 0:
                return []
            result = await collection.query(
                query_embeddings=[query_embedding],
                n_results=min(fetch_k, count),
                include=["documents", "metadatas", "distances", "embeddings"],
            )
        except Exception as exc:
            logger.error(
                "ChromaVectorStoreTask.mmr_search: candidate fetch failed: %s", exc
            )
            raise

        docs = result["documents"][0]
        metas = result["metadatas"][0]
        distances = result["distances"][0]
        embeddings = result["embeddings"][0]  # list of vectors

        if not docs:
            return []

        q = np.array(query_embedding, dtype=float)
        candidate_vecs = np.array(embeddings, dtype=float)

        selected_indices: list[int] = []
        remaining = list(range(len(docs)))

        while remaining and len(selected_indices) < top_k:
            if not selected_indices:
                # First pick: most similar to query.
                sims_to_query = candidate_vecs[remaining] @ q / (
                    np.linalg.norm(candidate_vecs[remaining], axis=1) * np.linalg.norm(q) + 1e-10
                )
                best_local = int(np.argmax(sims_to_query))
                best_global = remaining[best_local]
            else:
                selected_vecs = candidate_vecs[selected_indices]
                sims_to_query = candidate_vecs[remaining] @ q / (
                    np.linalg.norm(candidate_vecs[remaining], axis=1) * np.linalg.norm(q) + 1e-10
                )
                # Similarity to already-selected items.
                sims_to_selected = (
                    candidate_vecs[remaining] @ selected_vecs.T
                ) / (
                    np.linalg.norm(candidate_vecs[remaining], axis=1, keepdims=True)
                    * np.linalg.norm(selected_vecs, axis=1, keepdims=True).T
                    + 1e-10
                )
                max_sim_to_selected = sims_to_selected.max(axis=1)
                mmr_scores = (
                    lambda_mult * sims_to_query
                    - (1.0 - lambda_mult) * max_sim_to_selected
                )
                best_local = int(np.argmax(mmr_scores))
                best_global = remaining[best_local]

            selected_indices.append(best_global)
            remaining.remove(best_global)

        return [
            {
                "content": docs[i],
                "metadata": metas[i],
                "score": 1.0 - distances[i],
            }
            for i in selected_indices
        ]

    async def fetch_all_chunks(
        self,
        agent_id: str,
        source_filename: str,
    ) -> list[dict]:
        """Return all chunks for *source_filename* with their embeddings.

        Returns list of dicts: {content, metadata, embedding: list[float]}
        """
        collection = await self._get_collection(agent_id)
        count = await collection.count()
        if count == 0:
            return []
        result = await collection.get(
            where={"source": source_filename},
            include=["documents", "metadatas", "embeddings"],
        )
        def _safe_list(val):
            if val is None:
                return []
            if hasattr(val, "tolist"):
                return val.tolist()
            return list(val)

        docs = _safe_list(result.get("documents"))
        metas = _safe_list(result.get("metadatas"))
        embeddings = _safe_list(result.get("embeddings"))
        return [
            {
                "content": doc,
                "metadata": meta,
                "embedding": list(emb) if emb is not None else [],
            }
            for doc, meta, emb in zip(docs, metas, embeddings)
        ]

    async def delete_chunks_for_source(self, agent_id: str, source_filename: str) -> int:
        """Delete all chunks for source_filename. Returns count deleted."""
        collection = await self._get_collection(agent_id)
        count = await collection.count()
        if count == 0:
            return 0
        # Chroma delete by metadata filter
        existing = await collection.get(where={"source": source_filename}, include=[])
        ids = existing.get("ids") or []
        if ids:
            await collection.delete(ids=ids)
        return len(ids)

    async def delete_collection(self, agent_id: str) -> None:
        """Delete the collection for *agent_id* — called when an agent or
        document set is removed."""
        import chromadb

        from app.core.config import get_settings

        settings = get_settings()
        client = await chromadb.AsyncHttpClient(
            host=settings.CHROMA_HOST,
            port=settings.CHROMA_PORT,
        )
        collection_name = f"agent_{agent_id}"
        try:
            await client.delete_collection(name=collection_name)
            logger.info(
                "ChromaVectorStoreTask: deleted collection %r.", collection_name
            )
        except Exception as exc:
            logger.error(
                "ChromaVectorStoreTask.delete_collection: failed to delete %r: %s",
                collection_name,
                exc,
            )
            raise
