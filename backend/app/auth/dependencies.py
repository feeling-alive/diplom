"""FastAPI auth dependencies: resolve the current user from the JWT cookie."""

from __future__ import annotations

import logging
import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.utils import decode_access_token
from app.database import get_db
from app.models import User, UserRole

logger = logging.getLogger("backend.auth.deps")

COOKIE_NAME = "access_token"


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Return the authenticated user or raise 401.

    Reads the JWT from the ``access_token`` cookie, decodes it, loads the user by
    id, and rejects missing/invalid tokens, unknown users, and inactive accounts.
    """
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        logger.warning("[auth] no access_token cookie")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Не авторизован")

    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        logger.warning("[auth] invalid/expired token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия недействительна")

    try:
        user_id = uuid.UUID(str(payload["sub"]))
    except ValueError:
        logger.warning("[auth] token sub is not a valid uuid")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия недействительна")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        logger.warning("[auth] user from token not found: %s", user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    if not user.is_active:
        logger.warning("[auth] inactive user attempted access: %s", user_id)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аккаунт заблокирован")

    logger.debug("[auth] resolved user %s (role=%s)", user.id, user.role.value)
    return user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Return the current user if authenticated, or None if not.

    Used in public endpoints that optionally enrich the response with
    user-specific fields (e.g. is_favorited, user_reaction).
    """
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Return the current user if admin, else raise 403."""
    if current_user.role != UserRole.admin:
        logger.warning("[auth] non-admin denied: %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Доступ только для администратора"
        )
    return current_user
