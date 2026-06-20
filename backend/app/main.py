"""FinTrack backend entrypoint: FastAPI app with CORS, routers and Redis lifespan.

Run: ``uvicorn app.main:app --reload --port 8000`` (from the ``backend/`` dir).
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import AsyncIterator

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth.router import router as auth_router
from app.config import log_startup_config, settings
from app.database import Base, engine
from app.routes import admin, chat, crypto, dashboard, forex, news, notifications, profile, quotes, search
from app.services.cache import close_client
from app.services.news_fetcher import fetch_and_store_news

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
    # Local PatchTST weights: download once from HF Hub if absent. Wrapped so an
    # offline start degrades gracefully — patchtst.py falls back to a neutral
    # prediction when the file is missing (same philosophy as Redis/DB above).
    model_path = Path("app/ml/pytorch_model.pt")
    if not model_path.exists():
        try:
            import shutil

            from huggingface_hub import hf_hub_download

            logger.info("[main] pytorch_model.pt absent — downloading from HF Hub...")
            p = hf_hub_download(
                "nikasq/PatchTST-Time-Series-Classifier",
                "pytorch_model.pt",
            )
            shutil.copy(p, model_path)
            logger.info("[main] pytorch_model.pt downloaded -> %s", model_path)
        except Exception as err:  # noqa: BLE001 — degrade gracefully, never block startup
            logger.warning("[main] model download failed: %s — AI prediction will degrade", err)

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

    # News scheduler: fetch + AI-enrich articles every 4 hours.
    # next_run_time=now() triggers the first run immediately on startup.
    scheduler = AsyncIOScheduler()
    if settings.news_api_key:
        scheduler.add_job(
            fetch_and_store_news,
            "interval",
            hours=4,
            next_run_time=datetime.now(),
            id="news_fetcher",
        )
        scheduler.start()
        logger.info("[main] APScheduler started — news fetch every 4 h")
    else:
        logger.warning("[main] NEWS_API_KEY absent — APScheduler not started")

    yield

    if scheduler.running:
        scheduler.shutdown(wait=False)
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
    # PATCH added for profile updates (PATCH /users/me).
    # PUT added for dashboard layout persistence (PUT /dashboard/config).
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(quotes.router, prefix=API_PREFIX)
app.include_router(crypto.router, prefix=API_PREFIX)
app.include_router(forex.router, prefix=API_PREFIX)
app.include_router(auth_router)  # carries its own /auth prefix
app.include_router(profile.router)  # carries its own /users prefix
app.include_router(dashboard.router)  # carries its own /dashboard prefix
app.include_router(news.router)        # carries its own /api/news prefix
app.include_router(chat.router)          # carries its own /api/chat prefix
app.include_router(search.router)        # carries its own /api/search prefix
app.include_router(notifications.router) # carries its own /api/notifications prefix
app.include_router(admin.router)         # carries its own /admin prefix
logger.info("[main] auth/users/dashboard/news/chat/search/notifications/admin routes mounted")

# Serve uploaded avatars under /uploads. The directory must exist before mount,
# so create it eagerly (idempotent). Wrapped to degrade gracefully if the
# filesystem is read-only — the quote proxy must stay up regardless.
try:
    _avatars_dir = os.path.join(settings.uploads_dir, "avatars")
    os.makedirs(_avatars_dir, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")
    logger.info("[main] static /uploads mounted from %s", settings.uploads_dir)
except OSError as err:  # pragma: no cover — environment-dependent
    logger.warning("[main] /uploads mount skipped: %s", err)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}
