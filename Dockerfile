# ── Stage 1: dependency resolver ─────────────────────────────────────────────
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

# Enable uv's build cache and bytecode compilation for faster boots
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Copy only the files uv needs to resolve & install dependencies
COPY pyproject.toml uv.lock* ./

# Install production dependencies into /app/.venv
RUN uv sync --no-dev --frozen --no-install-project

# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS runtime

WORKDIR /app

# Create a non-root user with a real home directory
RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup --home /app/home appuser

# Copy the pre-built virtual environment from the builder stage
COPY --from=builder /app/.venv /app/.venv

# Copy application source
COPY app/ ./app/
COPY alembic.ini* ./
COPY migrations/ ./migrations/

# Create upload + cache directories and set permissions
RUN mkdir -p /app/uploads /app/home/.cache/huggingface && \
    chown -R appuser:appgroup /app

# Activate the venv; point HF and torch caches to writable paths
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=0 \
    HOME=/app/home \
    HF_HOME=/app/home/.cache/huggingface \
    TORCH_HOME=/app/home/.cache/torch \
    TRANSFORMERS_CACHE=/app/home/.cache/huggingface

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
