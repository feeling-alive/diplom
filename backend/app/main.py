"""FinTrack backend entrypoint: FastAPI app with CORS, routers and Redis lifespan.

Run: ``uvicorn app.main:app --reload --port 8000`` (from the ``backend/`` dir).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import log_startup_config, settings
from app.routes import crypto, forex, quotes
from app.services.cache import close_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("backend.main")

API_PREFIX = "/api/quotes"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    log_startup_config()
    logger.info("[main] startup — routes mounted at %s", API_PREFIX)
    yield
    await close_client()
    logger.info("[main] shutdown")


app = FastAPI(title="FinTrack Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(quotes.router, prefix=API_PREFIX)
app.include_router(crypto.router, prefix=API_PREFIX)
app.include_router(forex.router, prefix=API_PREFIX)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}
