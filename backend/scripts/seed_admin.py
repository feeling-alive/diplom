"""Seed script: create an admin user if none exists.

Usage (from backend/ directory):
    python scripts/seed_admin.py

Environment variables (from .env or shell):
    ADMIN_EMAIL     — admin email (default: admin@fintrack.local)
    ADMIN_USERNAME  — admin username (default: admin)
    ADMIN_PASSWORD  — admin password (default: Admin1234!)

The script is idempotent: re-running it when the admin already exists is a no-op.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Allow running from both backend/ and project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.models import Base, Subscription, SubscriptionPlan, User, UserRole

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed_admin")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@fintrack.local")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin1234!")


async def seed() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)  # type: ignore[call-overload]

    async with async_session() as db:
        existing = (
            await db.execute(
                select(User).where(
                    (User.email == ADMIN_EMAIL) | (User.username == ADMIN_USERNAME)
                )
            )
        ).scalar_one_or_none()

        if existing is not None:
            logger.info("Admin already exists: %s (%s) — skipping.", existing.username, existing.email)
            return

        hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        admin = User(
            email=ADMIN_EMAIL,
            username=ADMIN_USERNAME,
            password_hash=hashed,
            role=UserRole.admin,
            is_active=True,
        )
        db.add(admin)
        await db.flush()

        sub = Subscription(user_id=admin.id, plan=SubscriptionPlan.free)
        db.add(sub)
        await db.commit()

        logger.info("Admin created: %s (%s)", ADMIN_USERNAME, ADMIN_EMAIL)
        logger.info("Password: %s", ADMIN_PASSWORD)
        logger.warning("Change the password after first login!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
