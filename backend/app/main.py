"""FinTrack backend entrypoint: FastAPI app with CORS, routers and Redis lifespan.

Run: ``uvicorn app.main:app --reload --port 8000`` (from the ``backend/`` dir).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.config import log_startup_config, settings
from app.database import Base, engine
from app.routes import crypto, forex, quotes
from app.services.cache import close_client

# Importing models registers all tables on Base.metadata (needed for create_all).
import app.models  # noqa: E402,F401  (side-effect import: table registration)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("backend.main")

API_PREFIX = "/api/quotes"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    log_startup_config()
    # Dev convenience: create tables from ORM metadata on startup. In a real
    # deployment Alembic migrations own the schema; this is a no-op when tables
    # already exist. Wrapped so an unreachable DB degrades gracefully (same
    # philosophy as the Redis cache) instead of crashing the whole service —
    # the /api/quotes/* proxy must stay up even without PostgreSQL.
    logger.info("[main] creating tables via metadata.create_all (dev)")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("[main] tables ready: %s", list(Base.metadata.tables))
    except Exception as err:  # noqa: BLE001 — degrade gracefully, never block startup
        logger.warning("[main] DB init skipped: %s", err)
    logger.info("[main] startup — routes mounted at %s", API_PREFIX)
    yield
    await close_client()
    logger.info("[main] shutdown")


app = FastAPI(title="FinTrack Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    # POST added for the auth routes (register/login/logout); cookies require
    # allow_credentials=True. The frontend normally calls these via the Vite proxy
    # (same-origin), so CORS mainly matters for direct calls / Swagger.
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(quotes.router, prefix=API_PREFIX)
app.include_router(crypto.router, prefix=API_PREFIX)
app.include_router(forex.router, prefix=API_PREFIX)
app.include_router(auth_router)  # carries its own /auth prefix
logger.info("[main] auth routes mounted at /auth")


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}
