"""Smoke tests for the ORM metadata — no live PostgreSQL required.

These assert the table set, key constraints and that DDL compiles by running
``create_all`` against an in-memory SQLite async engine (JSON variant kicks in).
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import create_async_engine

from app.database import Base
import app.models as models

EXPECTED_TABLES = {
    "users",
    "dashboard_configs",
    "chat_sessions",
    "comments",
    "comment_reactions",
    "favorites",
    "news_articles",
    "news_reactions",
    "news_favorites",
    "notifications",
    "api_keys",
    "admin_logs",
}


def test_all_tables_registered() -> None:
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_user_unique_columns() -> None:
    cols = models.User.__table__.columns
    assert cols["email"].unique is True
    assert cols["username"].unique is True
    # password_hash is nullable for Google-only accounts.
    assert cols["password_hash"].nullable is True


def test_favorite_unique_constraint() -> None:
    names = {c.name for c in models.Favorite.__table__.constraints if c.name}
    assert "uq_favorite_user_symbol" in names


def test_enum_names_present() -> None:
    role_type = models.User.__table__.columns["role"].type
    assert role_type.name == "user_role"


@pytest.mark.asyncio
async def test_create_all_compiles_on_sqlite() -> None:
    """DDL for every table must compile and run on a non-Postgres backend."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    finally:
        await engine.dispose()
