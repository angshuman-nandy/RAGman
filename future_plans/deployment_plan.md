# RAGman — Free-Tier Deployment Options

## Why HF Spaces Free Tier Doesn't Fit

RAGman requires 6 services (FastAPI, Postgres+pgvector, Redis, ChromaDB, ARQ worker, Ollama).
HF Spaces free tier is a single ephemeral container — no multi-service support, no persistent storage.

---

## Platform Comparison

| Platform | Multi-service? | Persistent storage? | Postgres? | Free limits | Verdict |
|---|---|---|---|---|---|
| **HF Spaces** | ❌ Single container | ❌ Ephemeral | ❌ | 2 vCPU / 16 GB | Demo only — data lost on restart |
| **Railway** | ✅ via services | ✅ Volumes | ✅ Managed | $5 credit/mo, then pay-as-go | Best fit — minimal changes needed |
| **Render** | ✅ via services | ✅ Disks ($) | ✅ Free 90 days | 512 MB RAM free web service | RAM too tight for HF models |
| **Fly.io** | ✅ via apps | ✅ Volumes | ✅ Fly Postgres | 3 shared VMs, 3 GB storage | Good fit, CLI-heavy setup |
| **Koyeb** | ✅ | ✅ | ✅ | 2 nano instances free | Limited, no GPU |
| **Google Cloud Run** | ⚠️ Stateless | ❌ (need GCS) | ✅ Cloud SQL ($) | 2M req/mo free | Stateless — needs redesign |

---

## Recommended: Railway

Closest to a zero-changes deployment. Supports multiple services, managed Postgres with pgvector, Redis, persistent volumes for uploads + Chroma data, and $5/month free credit (enough for light usage).

**Changes needed:**
- Add `railway.toml` config file mapping each service
- Remove `ollama` from the default stack (add back as optional)
- Set env vars via Railway dashboard instead of `.env`

---

## HF Spaces — Demo-Only Version

Feasible with significant architecture surgery:
- Swap Postgres → SQLite (lose pgvector, use Chroma-only)
- Drop Redis + ARQ worker (run ingestion synchronously in-process)
- Drop Ollama
- Chroma runs in local filesystem mode (data wiped on restart)
- Pack everything into one container

Result: a stateless demo that resets on every Space restart. Not suitable for real use.

---

## Fly.io — Best Free Tier for Full Persistence

Free allowance includes 3 shared-CPU VMs, 3 GB persistent volume storage, 160 GB outbound transfer.

**Changes needed:**
- Write `fly.toml` for each service (api, worker, postgres, redis, chroma)
- Use Fly Postgres (managed) or a volume-backed Postgres app
- Persistent volumes for uploads + chroma data

---

## Summary

| Goal | Platform |
|---|---|
| Quick demo / shareable link | HF Spaces (with surgery) |
| Real deployment, minimal hassle | **Railway** |
| Real deployment, maximum free tier | **Fly.io** |
| Already on Google Cloud | Cloud Run + Cloud SQL |
