"""Test fixtures: an isolated in-memory DB and an ASGI client per test.

Each test gets a fresh ``sqlite+aiosqlite`` database (StaticPool → one shared
connection so the in-memory schema persists across sessions). ``get_db`` is
overridden to use it, and the app is driven via httpx ASGITransport — which does
NOT run the lifespan, so no real PostgreSQL connection is attempted.
"""

from __future__ import annotations

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    test_session = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with test_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Expose session factory on client for fixtures that need direct DB access.
        ac._test_session = test_session  # type: ignore[attr-defined]
        yield ac

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(client: AsyncClient):
    """Direct DB session sharing the same in-memory DB as the test client."""
    session_factory = client._test_session  # type: ignore[attr-defined]
    async with session_factory() as session:
        yield session
