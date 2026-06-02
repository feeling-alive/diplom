"""Alembic environment configured for async SQLAlchemy (asyncpg).

The DB URL is taken from ``app.config.settings`` (single source of truth), and
``target_metadata`` is ``Base.metadata`` with every model imported so that
``--autogenerate`` sees all tables. Online migrations run through an async
engine via ``connection.run_sync(...)``.
"""

from __future__ import annotations

import asyncio
import logging
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# App imports: settings for the URL, Base + models for the metadata.
from app.config import settings
from app.database import Base
import app.models  # noqa: F401 — side-effect import registers all tables

# Alembic Config object (values from alembic.ini).
config = context.config

# Override the static ini URL with the app's runtime DSN (honours DATABASE_URL).
config.set_main_option("sqlalchemy.url", settings.database_url)

# Set up Python logging from the ini file.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

target_metadata = Base.metadata
logger.info("[alembic] target metadata tables: %s", list(target_metadata.tables))


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL without a live DBAPI)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Configure the context against a live (sync-facing) connection and run."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations within ``run_sync``."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Entry point for online mode — drives the async migration coroutine."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
