"""Notification routes (prefix ``/api/notifications``).

Endpoints:
  GET  /api/notifications           — current user's notifications (newest first, limit 50)
  POST /api/notifications/read-all  — mark all as read
  POST /api/notifications/{id}/read — mark one as read
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Notification, User

logger = logging.getLogger("backend.notifications")
router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    message: str
    link: str
    is_read: bool
    created_at: str
    sender_username: str | None = None
    sender_avatar_url: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[NotificationOut]:
    rows = await session.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    result: list[NotificationOut] = []
    for n in rows:
        sender_username: str | None = None
        sender_avatar_url: str | None = None
        if n.sender_id:
            sender = await session.get(User, n.sender_id)
            if sender:
                sender_username = sender.username
                sender_avatar_url = sender.avatar_url
        result.append(NotificationOut(
            id=n.id,
            type=n.type,
            message=n.message,
            link=n.link,
            is_read=n.is_read,
            created_at=n.created_at.isoformat(),
            sender_username=sender_username,
            sender_avatar_url=sender_avatar_url,
        ))
    logger.debug("[notifications] list user=%s count=%d", user.id, len(result))
    return result


@router.post("/read-all", status_code=200)
async def mark_all_read(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    await session.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await session.commit()
    logger.debug("[notifications] mark_all_read user=%s", user.id)
    return {"status": "ok"}


@router.post("/{notification_id}/read", status_code=200)
async def mark_one_read(
    notification_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    notif = await session.get(Notification, notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    notif.is_read = True
    await session.commit()
    logger.debug("[notifications] mark_read id=%s user=%s", notification_id, user.id)
    return {"status": "ok"}
