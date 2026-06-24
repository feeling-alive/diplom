"""One-off maintenance script: wipe ALL comments and their dependent rows.

Round 3 (D1). Deletes, in FK-safe order:
    1. comment_reactions  (likes/dislikes on comments)
    2. notifications of comment-related types ('reaction', 'comment_reply')
    3. comments           (top-level + replies)

User accounts and news data are NOT touched.

Usage (from backend/ directory):
    python scripts/clear_comments.py            # asks for confirmation
    python scripts/clear_comments.py --yes      # non-interactive (CI / scripted)

Safe to re-run: on an already-clean database it just deletes 0 rows.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Allow running from both backend/ and project root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.models import Comment, CommentReaction, Notification

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("clear_comments")

# Notification.type values created for comment activity (see models.Notification).
_COMMENT_NOTIFICATION_TYPES = ("reaction", "comment_reply")


async def _count(db: AsyncSession, model: object) -> int:
    return int((await db.execute(select(func.count()).select_from(model))).scalar_one())  # type: ignore[arg-type]


async def clear_comments(assume_yes: bool = False) -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)  # type: ignore[call-overload]

    async with async_session() as db:
        n_comments = await _count(db, Comment)
        n_reactions = await _count(db, CommentReaction)
        logger.info("Found %d comments and %d comment reactions.", n_comments, n_reactions)

        if n_comments == 0 and n_reactions == 0:
            logger.info("Nothing to delete — database already clean.")
            await engine.dispose()
            return

        if not assume_yes:
            answer = input(
                f"Delete ALL {n_comments} comments + {n_reactions} reactions "
                "and related notifications? Type 'yes' to confirm: "
            ).strip().lower()
            if answer != "yes":
                logger.info("Aborted — no changes made.")
                await engine.dispose()
                return

        # FK-safe order: reactions -> comment notifications -> comments.
        r1 = await db.execute(delete(CommentReaction))
        logger.info("Deleted %s comment_reactions.", r1.rowcount)

        r2 = await db.execute(
            delete(Notification).where(Notification.type.in_(_COMMENT_NOTIFICATION_TYPES))
        )
        logger.info("Deleted %s comment-related notifications.", r2.rowcount)

        r3 = await db.execute(delete(Comment))
        logger.info("Deleted %s comments.", r3.rowcount)

        await db.commit()
        logger.info("Done — comments wiped. Users and news data untouched.")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wipe all comments and dependent rows.")
    parser.add_argument("--yes", action="store_true", help="Skip the interactive confirmation.")
    args = parser.parse_args()
    asyncio.run(clear_comments(assume_yes=args.yes))
