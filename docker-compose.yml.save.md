# Сейв оригинального docker-compose.yml (до правок под Railway)
# FinTrack local stack: PostgreSQL + Redis + FastAPI backend.
#
#   docker compose up -d postgres redis   # just the datastores (for host-run uvicorn/alembic)
#   docker compose up --build             # full stack incl. backend
#
# The frontend (Vite) is not containerized here — it runs on the host and
# proxies /api/quotes -> backend:8000.

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: fintrack
      POSTGRES_USER: fintrack
      POSTGRES_PASSWORD: fintrack_pass
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fintrack"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://fintrack:fintrack_pass@postgres:5432/fintrack
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./backend:/app
      - uploads_data:/app/uploads

volumes:
  postgres_data:
  uploads_data:
