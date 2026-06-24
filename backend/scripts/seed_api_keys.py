"""Seed script: import configured ``.env`` API keys into the ``api_keys`` table.

Usage (from backend/ directory):
    python scripts/seed_api_keys.py

The admin panel only lists keys stored (encrypted) in the ``api_keys`` table.
Keys that live solely in ``.env`` work at runtime via the DB→.env resolver
(:mod:`app.services.api_keys`) but never show up as "Сохранён" in the panel.

This script reads each known service's ``.env`` fallback from settings, encrypts
it with the same Fernet helper the admin route uses, and upserts it into
``api_keys`` so the admin panel displays every configured key. Idempotent: an
existing row for the service is overwritten with the current ``.env`` value.
Services with no ``.env`` value are skipped.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Allow running from both backend/ and project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.models import ApiKey
from app.services.api_keys import _SERVICE_SETTINGS_ATTR
from app.utils_crypto import encrypt_value, mask_value

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed_api_keys")


async def seed() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)  # type: ignore[call-overload]

    seeded = 0
    async with async_session() as db:
        for service, attr in _SERVICE_SETTINGS_ATTR.items():
            value = (getattr(settings, attr, "") or "").strip()
            if not value:
                logger.info("%-11s — no .env value, skipping", service)
                continue

            encrypted = encrypt_value(value)
            stmt = (
                pg_insert(ApiKey)
                .values(id=uuid.uuid4(), service=service, encrypted_value=encrypted)
                .on_conflict_do_update(
                    index_elements=["service"],
                    set_={"encrypted_value": encrypted, "updated_at": func.now()},
                )
            )
            await db.execute(stmt)
            seeded += 1
            logger.info("%-11s — seeded (%s)", service, mask_value(value))

        await db.commit()

    # Report the resulting table state.
    async with async_session() as db:
        rows = (await db.execute(select(ApiKey.service))).scalars().all()
        logger.info("api_keys table now holds %d row(s): %s", len(rows), sorted(rows))

    logger.info("Done. Seeded/updated %d key(s).", seeded)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
