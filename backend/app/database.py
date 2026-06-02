"""Async SQLAlchemy 2.0 data layer: engine, session factory, Base and get_db.

This is the single channel between the app and PostgreSQL. Routes consume an
``AsyncSession`` via the ``get_db`` FastAPI dependency; they never construct
engines or sessions themselves. The DSN comes from ``settings.database_url``
(asyncpg driver) — see ``app.config``.
"""

from __future__ import annotations

import logging
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger("backend.database")

# ``echo=False`` keeps logs clean; flip to True locally to see emitted SQL.
engine = create_async_engine(settings.database_url, echo=False)

# ``expire_on_commit=False`` so ORM objects stay usable after commit inside a
# request handler (no implicit lazy-reload on attribute access post-commit).
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

logger.info("[database] async engine initialized (driver=asyncpg)")


class Base(DeclarativeBase):
    """Declarative base for all ORM models. ``Base.metadata`` drives migrations."""


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a single-request async session.

    The session is closed automatically when the request finishes (``async with``).
    """
    async with AsyncSessionLocal() as session:
        logger.debug("[database] session opened")
        try:
            yield session
        finally:
            logger.debug("[database] session closed")
