"""User profile routes (prefix ``/users``).

Exposes the current user's profile, username editing with uniqueness validation,
a live username-availability probe, and avatar upload (cropped to a 200x200
square via Pillow).

All endpoints require authentication through :func:`get_current_user`; the
dependency raises 401 when the JWT cookie is missing or invalid.
"""

from __future__ import annotations

import io
import logging
import os
import re

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from PIL import Image
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import get_db
from app.models import User

logger = logging.getLogger("backend.routes.profile")

router = APIRouter(prefix="/users", tags=["users"])

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]+$")
AVATAR_MAX_BYTES = 5 * 1024 * 1024  # 5MB
AVATAR_ALLOWED_CT = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
AVATAR_SIZE = 200


# --- Schemas ----------------------------------------------------------------

class ProfileResponse(BaseModel):
    """Profile returned by GET/PATCH ``/users/me``."""

    id: str
    email: str
    username: str
    avatar_url: str | None
    role: str
    created_at: str


class UpdateUsernameRequest(BaseModel):
    """Payload for PATCH ``/users/me``."""

    username: str = Field(min_length=3, max_length=20)


class CheckUsernameResponse(BaseModel):
    available: bool


class AvatarResponse(BaseModel):
    avatar_url: str


# --- Helpers ----------------------------------------------------------------

def _build_profile(user: User) -> ProfileResponse:
    """Assemble the profile DTO from a user."""
    return ProfileResponse(
        id=str(user.id),
        email=user.email,
        username=user.username,
        avatar_url=user.avatar_url,
        role=user.role.value,
        created_at=user.created_at.isoformat(),
    )


def _validate_username(username: str) -> None:
    """Raise 422-style 400 if the username breaks the format contract."""
    if not (3 <= len(username) <= 20) or not USERNAME_RE.match(username):
        logger.warning("[profile] invalid username format: %r", username)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя пользователя: 3-20 символов, латиница/цифры/подчёркивание",
        )


# --- Routes -----------------------------------------------------------------

@router.get("/me", response_model=ProfileResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    """Return the current user's profile."""
    logger.debug("[profile] get_me user=%s", current_user.id)
    return _build_profile(current_user)


@router.patch("/me", response_model=ProfileResponse)
async def update_me(
    payload: UpdateUsernameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    """Update the username (3-20 chars, alnum/underscore, unique)."""
    new_username = payload.username
    _validate_username(new_username)

    if new_username != current_user.username:
        taken = (
            await db.execute(
                select(User).where(
                    User.username == new_username, User.id != current_user.id
                )
            )
        ).scalar_one_or_none()
        if taken is not None:
            logger.warning("[profile] username taken: %s", new_username)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Имя пользователя уже занято",
            )
        current_user.username = new_username
        await db.commit()
        await db.refresh(current_user)
        logger.debug("[profile] username updated user=%s -> %s", current_user.id, new_username)

    return _build_profile(current_user)


@router.get("/me/check-username", response_model=CheckUsernameResponse)
async def check_username(
    username: str = Query(..., min_length=1, max_length=64),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckUsernameResponse:
    """Report whether ``username`` is free. The caller's own name counts as free."""
    if username == current_user.username:
        logger.debug("[profile] check-username own name -> available")
        return CheckUsernameResponse(available=True)

    other = (
        await db.execute(
            select(User).where(User.username == username, User.id != current_user.id)
        )
    ).scalar_one_or_none()
    available = other is None
    logger.debug("[profile] check-username %r -> %s", username, available)
    return CheckUsernameResponse(available=available)


@router.post("/me/avatar", response_model=AvatarResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AvatarResponse:
    """Accept an image, center-crop to a 200x200 square JPEG, store it, return its URL."""
    if file.content_type not in AVATAR_ALLOWED_CT:
        logger.warning("[profile] avatar rejected content_type=%s", file.content_type)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Допустимы только jpg, png, webp",
        )

    raw = await file.read()
    if len(raw) > AVATAR_MAX_BYTES:
        logger.warning("[profile] avatar too large: %d bytes", len(raw))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Файл больше 5MB"
        )

    try:
        image = Image.open(io.BytesIO(raw))
        image = image.convert("RGB")
    except Exception as err:  # noqa: BLE001 — any decode failure is a client error
        logger.warning("[profile] avatar decode failed: %s", err)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось прочитать изображение"
        )

    # Center-crop to a square, then resize to 200x200.
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    image = image.crop((left, top, left + side, top + side)).resize(
        (AVATAR_SIZE, AVATAR_SIZE), Image.LANCZOS
    )

    avatars_dir = os.path.join(settings.uploads_dir, "avatars")
    os.makedirs(avatars_dir, exist_ok=True)
    filename = f"{current_user.id}.jpg"
    image.save(os.path.join(avatars_dir, filename), format="JPEG", quality=85)

    avatar_url = f"/uploads/avatars/{filename}"
    current_user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(current_user)
    logger.debug("[profile] avatar saved user=%s -> %s", current_user.id, avatar_url)

    return AvatarResponse(avatar_url=avatar_url)
