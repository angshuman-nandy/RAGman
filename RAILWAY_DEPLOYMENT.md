# Deploying RAGman to Railway

This guide covers deploying RAGman to Railway's free tier.  
Local development with `docker-compose` is unchanged.

---

## Architecture on Railway

| Service  | Type                        | Notes                                      |
|----------|-----------------------------|--------------------------------------------|
| api      | Custom (Dockerfile)         | FastAPI — uses `$PORT` set by Railway      |
| worker   | Custom (same Dockerfile)    | ARQ — different start command              |
| postgres | Railway managed Postgres    | pgvector extension enabled via SQL command |
| redis    | Railway managed Redis       | Drop-in, no extra config needed            |
| chroma   | Custom (Docker image)       | `chromadb/chroma:latest`, needs a volume   |

**Ollama is not supported on Railway free tier** (no GPU, 512 MB RAM limit).  
Use OpenAI, Anthropic, or Cohere API keys instead.

---

## Step 1 — Create a new Railway project

1. Go to [railway.app](https://railway.app) and create a new project.
2. Choose **Empty project**.

---

## Step 2 — Add managed plugins

### Postgres
1. Click **+ New** → **Database** → **PostgreSQL**.
2. Once provisioned, open the Postgres service → **Query** tab and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   This enables pgvector.

### Redis
1. Click **+ New** → **Database** → **Redis**.
2. No extra configuration needed.

---

## Step 3 — Add the ChromaDB service

1. Click **+ New** → **Docker Image** → enter `chromadb/chroma:latest`.
2. In the service settings:
   - **Start command**: leave blank (uses the image default).
   - **Port**: `8000` (Railway will route internally).
3. Add a **Volume**:
   - Mount path: `/chroma/chroma`
   - This persists your vector store data across deploys.
4. Add environment variables for this service:
   ```
   ALLOW_RESET=true
   ```
5. Note the **internal hostname** Railway assigns (e.g. `chroma.railway.internal`).  
   You will use it when configuring the api and worker services.

---

## Step 4 — Deploy the API service

1. Click **+ New** → **GitHub Repo** → select your RAGman repository.
2. Railway detects `railway.toml` and uses the Dockerfile automatically.
3. The start command from `railway.toml` is:
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. Add a **Volume** to this service:
   - Mount path: `/app/uploads`
5. Set all environment variables listed in [Environment Variables](#environment-variables) below.

---

## Step 5 — Deploy the Worker service

The worker uses the **same Docker image** as the API but with a different start command.

1. Click **+ New** → **GitHub Repo** → select the same RAGman repository.
2. Go to the service settings → **Deploy** tab.
3. Override the start command to:
   ```
   python -m arq app.worker.settings.WorkerSettings
   ```
4. Add the **same Volume** as the API (mount at `/app/uploads`) so the worker
   can access uploaded files during ingestion.
   > Note: Railway volumes cannot be shared between services on the free tier.
   > If uploads are small, you can mount separate volumes and rely on the
   > document file path stored in the database pointing to the same logical path.
   > Alternatively, store uploads in an S3-compatible bucket (Cloudflare R2 has
   > a free tier) and remove the local volume dependency entirely.
5. Set the same environment variables as the API service.

---

## Environment Variables

Set these on **both** the api and worker services unless noted otherwise.

### Injected automatically by Railway (reference syntax)

| Variable        | Railway reference                       | Notes                                              |
|-----------------|-----------------------------------------|----------------------------------------------------|
| `DATABASE_URL`  | `${{Postgres.DATABASE_URL}}`            | Railway injects `postgresql://...`; the app normalises it to `postgresql+asyncpg://` automatically |
| `REDIS_URL`     | `${{Redis.REDIS_URL}}`                  | Injected as `redis://...`                          |

### Set manually in the Railway dashboard

| Variable              | Value / notes                                                       |
|-----------------------|---------------------------------------------------------------------|
| `CHROMA_HOST`         | Internal hostname of your Chroma service, e.g. `chroma.railway.internal` |
| `CHROMA_PORT`         | `8000`                                                              |
| `SECRET_KEY`          | A random 32+ character string — generate with `openssl rand -hex 32` |
| `APP_ENV`             | `production`                                                        |
| `LOG_LEVEL`           | `INFO`                                                              |
| `UPLOAD_DIR`          | `/app/uploads`                                                      |
| `MAX_UPLOAD_SIZE_MB`  | `50` (adjust as needed)                                             |
| `OPENAI_API_KEY`      | Your OpenAI key (required if using OpenAI embeddings / LLM)         |
| `ANTHROPIC_API_KEY`   | Your Anthropic key (required if using Claude models)                |
| `COHERE_API_KEY`      | Your Cohere key (optional, for reranking)                           |
| `OLLAMA_BASE_URL`     | Leave unset or set to `""` — Ollama is not available on Railway     |

---

## Step 6 — Run Alembic migrations

Migrations must be run once after the Postgres service is up and before the API
receives traffic.

### Option A — Railway shell (simplest)

1. Open the **api** service in the Railway dashboard.
2. Click **Shell** (available when the service is running).
3. Run:
   ```bash
   alembic upgrade head
   ```

### Option B — One-shot migration service

1. Create another service from the same GitHub repo.
2. Set the start command to:
   ```
   alembic upgrade head
   ```
3. Set the same `DATABASE_URL` environment variable.
4. Deploy it once; it will run, exit 0, and Railway will mark it as stopped.
5. Delete or disable the service afterwards.

---

## Step 7 — Deployment order

Deploy in this order to avoid connection errors on startup:

1. **Postgres** (managed plugin) — must be ready first
2. **Redis** (managed plugin)
3. **ChromaDB** (custom service) — wait until healthy
4. **api** — run `alembic upgrade head` via shell immediately after first deploy
5. **worker** — after api is confirmed healthy

---

## Known limitations on Railway free tier

| Limitation                        | Impact                                                    |
|-----------------------------------|-----------------------------------------------------------|
| No GPU                            | Ollama will not work; use OpenAI / Anthropic / Cohere     |
| 512 MB RAM per service            | HuggingFace `sentence-transformers` models may OOM during embedding. Use the OpenAI `text-embedding-3-small` model instead, which calls the API rather than loading weights into RAM. |
| Volumes not shared between services | api and worker each need their own volume mount at `/app/uploads`. Files uploaded via the API must be accessible to the worker. Consider S3/R2 for production. |
| Free tier sleep / execution limits | Services may be paused after inactivity on the Hobby plan. Upgrade for always-on. |
| No persistent shell across restarts | The Railway shell is ephemeral; run migrations immediately after deploy. |

---

## Local development

Nothing changes locally. Continue using:

```bash
docker compose up --build
```

The `railway.toml` file is ignored by docker-compose.

---

## Quick reference — start commands

| Service | Start command                                              |
|---------|------------------------------------------------------------|
| api     | `uvicorn app.main:app --host 0.0.0.0 --port $PORT`        |
| worker  | `python -m arq app.worker.settings.WorkerSettings`         |
| chroma  | (image default — no override needed)                       |
