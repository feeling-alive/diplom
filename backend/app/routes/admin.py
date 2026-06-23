"""Admin panel API routes (prefix ``/admin``).

All endpoints require ``require_admin`` dependency (role=admin, active account).

Sections:
  GET  /admin/stats                  — platform overview counters
  GET  /admin/users                  — paginated user list with filters
  PATCH /admin/users/{id}            — change role / block / subscription
  DELETE /admin/users/{id}           — delete user
  POST /admin/users/create-admin     — register a new admin account
  GET  /admin/comments               — paginated comment list
  DELETE /admin/comments/{id}        — delete comment + its replies
  GET  /admin/api-keys               — list stored API keys (masked)
  POST /admin/api-keys               — upsert API keys (encrypted)
  POST /admin/api-keys/test/{service} — live-test a stored key
  GET  /admin/logs                   — paginated audit log
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin
from app.config import settings
from app.database import get_db
from app.models import (
    AdminLog,
    ApiKey,
    ChatSession,
    Comment,
    CommentReaction,
    NewsArticle,
    NewsReaction,
    User,
    UserRole,
)
from app.services.api_keys import get_api_key, invalidate_cache
from app.utils_crypto import decrypt_value, encrypt_value, mask_value

logger = logging.getLogger("backend.routes.admin")

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _log_action(
    db: AsyncSession,
    admin: User,
    action: str,
    target_type: str,
    target_id: str,
    details: str | None = None,
) -> None:
    """Insert an AdminLog row for an admin action (fire-and-forget, no rollback)."""
    entry = AdminLog(
        admin_id=admin.id,
        admin_username=admin.username,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )
    db.add(entry)
    logger.debug("[admin] logged action=%s target=%s/%s", action, target_type, target_id)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AdminStatsResponse(BaseModel):
    total_users: int
    new_users_7d: int
    total_news: int
    last_news_fetch: str | None
    # Extended metrics (bug #3)
    active_users: int = 0
    blocked_users: int = 0
    total_comments: int = 0
    total_reactions: int = 0  # comment + news reactions combined
    ai_chat_sessions: int = 0  # обращения к ИИ (диалоги)
    last_activity: str | None = None  # most recent comment timestamp


class AdminUserItem(BaseModel):
    id: str
    username: str
    email: str
    role: str
    avatar_url: str | None
    created_at: str
    is_active: bool
    last_login: str | None = None


class AdminUsersResponse(BaseModel):
    items: list[AdminUserItem]
    total: int


class PatchUserBody(BaseModel):
    role: str | None = None
    is_blocked: bool | None = None


class CreateAdminBody(BaseModel):
    email: str = Field(..., max_length=255)
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8)


class AdminCommentItem(BaseModel):
    id: str
    text: str
    author: dict  # {username, avatar_url}
    article_url: str
    # Внутренний UUID статьи (резолвится из article_url) — нужен фронту для
    # deep-link /news/{article_id}#comment-{id}. None, если статья не найдена.
    article_id: str | None = None
    created_at: str


class AdminCommentsResponse(BaseModel):
    items: list[AdminCommentItem]
    total: int


class AdminLogItem(BaseModel):
    id: str
    admin_username: str
    action: str
    target_type: str
    target_id: str
    details: str | None
    created_at: str


class AdminLogsResponse(BaseModel):
    items: list[AdminLogItem]
    total: int


# ---------------------------------------------------------------------------
# GET /admin/stats
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminStatsResponse:
    logger.debug("[admin] get_stats by %s", current_admin.username)

    now = datetime.now(tz=timezone.utc)
    week_ago = now - timedelta(days=7)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()

    new_users_7d = (
        await db.execute(
            select(func.count()).select_from(User).where(User.created_at >= week_ago)
        )
    ).scalar_one()

    total_news = (await db.execute(select(func.count()).select_from(NewsArticle))).scalar_one()

    last_news_dt: datetime | None = (
        await db.execute(select(func.max(NewsArticle.created_at)))
    ).scalar_one()
    last_news_fetch = last_news_dt.isoformat() if last_news_dt else None

    active_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_active.is_(True)))
    ).scalar_one()
    blocked_users = total_users - active_users

    total_comments = (await db.execute(select(func.count()).select_from(Comment))).scalar_one()

    comment_reactions = (
        await db.execute(select(func.count()).select_from(CommentReaction))
    ).scalar_one()
    news_reactions = (
        await db.execute(select(func.count()).select_from(NewsReaction))
    ).scalar_one()
    total_reactions = comment_reactions + news_reactions

    ai_chat_sessions = (
        await db.execute(select(func.count()).select_from(ChatSession))
    ).scalar_one()

    last_comment_dt: datetime | None = (
        await db.execute(select(func.max(Comment.created_at)))
    ).scalar_one()
    last_activity = last_comment_dt.isoformat() if last_comment_dt else None

    logger.debug(
        "[admin] stats: users=%d active=%d blocked=%d new7d=%d news=%d comments=%d reactions=%d ai=%d",
        total_users, active_users, blocked_users, new_users_7d,
        total_news, total_comments, total_reactions, ai_chat_sessions,
    )
    return AdminStatsResponse(
        total_users=total_users,
        new_users_7d=new_users_7d,
        total_news=total_news,
        last_news_fetch=last_news_fetch,
        active_users=active_users,
        blocked_users=blocked_users,
        total_comments=total_comments,
        total_reactions=total_reactions,
        ai_chat_sessions=ai_chat_sessions,
        last_activity=last_activity,
    )


# ---------------------------------------------------------------------------
# GET /admin/users
# ---------------------------------------------------------------------------

@router.get("/users", response_model=AdminUsersResponse)
async def list_users(
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUsersResponse:
    logger.debug(
        "[admin] list_users search=%s role=%s page=%d limit=%d",
        search, role, page, limit,
    )

    base = select(User)

    if search:
        like = f"%{search.lower()}%"
        base = base.where(
            func.lower(User.username).like(like) | func.lower(User.email).like(like)
        )
    if role:
        try:
            base = base.where(User.role == UserRole(role))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Неизвестная роль: {role}")

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()

    offset = (page - 1) * limit
    rows = (
        await db.execute(base.order_by(User.created_at.desc()).offset(offset).limit(limit))
    ).scalars().all()

    items = [
        AdminUserItem(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role.value,
            avatar_url=user.avatar_url,
            created_at=user.created_at.isoformat(),
            is_active=user.is_active,
            last_login=None,
        )
        for user in rows
    ]
    return AdminUsersResponse(items=items, total=total)


# ---------------------------------------------------------------------------
# PATCH /admin/users/{id}
# ---------------------------------------------------------------------------

@router.patch("/users/{user_id}", response_model=AdminUserItem)
async def patch_user(
    user_id: uuid.UUID,
    body: PatchUserBody,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserItem:
    logger.debug("[admin] patch_user id=%s body=%s by %s", user_id, body, current_admin.username)

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    changes: list[str] = []

    if body.role is not None:
        try:
            new_role = UserRole(body.role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Неизвестная роль: {body.role}")
        user.role = new_role
        changes.append(f"role={body.role}")

    if body.is_blocked is not None:
        user.is_active = not body.is_blocked
        changes.append(f"is_blocked={body.is_blocked}")

    await _log_action(
        db, current_admin, "patch_user", "user", str(user_id),
        details="; ".join(changes) or None,
    )
    await db.commit()
    await db.refresh(user)

    return AdminUserItem(
        id=str(user.id),
        username=user.username,
        email=user.email,
        role=user.role.value,
        avatar_url=user.avatar_url,
        created_at=user.created_at.isoformat(),
        is_active=user.is_active,
        last_login=None,
    )


# ---------------------------------------------------------------------------
# DELETE /admin/users/{id}
# ---------------------------------------------------------------------------

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    logger.debug("[admin] delete_user id=%s by %s", user_id, current_admin.username)

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить собственный аккаунт")

    username_snapshot = user.username
    await _log_action(
        db, current_admin, "delete_user", "user", str(user_id),
        details=f"username={username_snapshot}",
    )
    await db.delete(user)
    await db.commit()
    logger.debug("[admin] user %s deleted", user_id)


# ---------------------------------------------------------------------------
# POST /admin/users/create-admin
# ---------------------------------------------------------------------------

@router.post("/users/create-admin", response_model=AdminUserItem, status_code=status.HTTP_201_CREATED)
async def create_admin_user(
    body: CreateAdminBody,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserItem:
    logger.debug("[admin] create_admin email=%s by %s", body.email, current_admin.username)

    existing = (
        await db.execute(
            select(User).where((User.email == body.email) | (User.username == body.username))
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email или username уже занят")

    import bcrypt  # local import to mirror auth router pattern

    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    new_user = User(
        email=body.email,
        username=body.username,
        password_hash=hashed,
        role=UserRole.admin,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()  # get new_user.id before commit

    await _log_action(
        db, current_admin, "create_admin", "user", str(new_user.id),
        details=f"email={body.email} username={body.username}",
    )
    await db.commit()
    await db.refresh(new_user)

    return AdminUserItem(
        id=str(new_user.id),
        username=new_user.username,
        email=new_user.email,
        role=new_user.role.value,
        avatar_url=new_user.avatar_url,
        created_at=new_user.created_at.isoformat(),
        is_active=new_user.is_active,
        last_login=None,
    )


# ---------------------------------------------------------------------------
# GET /admin/comments
# ---------------------------------------------------------------------------

@router.get("/comments", response_model=AdminCommentsResponse)
async def list_comments(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    q: str | None = Query(default=None, max_length=200),
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminCommentsResponse:
    logger.debug("[admin] list_comments page=%d limit=%d q=%r by %s", page, limit, q, current_admin.username)

    base = select(Comment, User).join(User, User.id == Comment.user_id).where(Comment.parent_id == None)  # noqa: E711
    if q:
        base = base.where(Comment.text.ilike(f"%{q}%"))

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()

    offset = (page - 1) * limit
    rows = (
        await db.execute(base.order_by(Comment.created_at.desc()).offset(offset).limit(limit))
    ).all()

    # Резолвим внутренний id статьи по article_url одним запросом (без N+1), чтобы
    # фронт мог построить deep-link /news/{article_id}#comment-{id}.
    urls = {comment.article_url for comment, _ in rows if comment.article_url}
    url_to_id: dict[str, str] = {}
    if urls:
        art_rows = await db.execute(
            select(NewsArticle.id, NewsArticle.url).where(NewsArticle.url.in_(urls))
        )
        url_to_id = {url: str(aid) for aid, url in art_rows.all()}

    items = [
        AdminCommentItem(
            id=str(comment.id),
            text=comment.text,
            author={"username": user.username, "avatar_url": user.avatar_url},
            article_url=comment.article_url,
            article_id=url_to_id.get(comment.article_url),
            created_at=comment.created_at.isoformat(),
        )
        for comment, user in rows
    ]
    return AdminCommentsResponse(items=items, total=total)


# ---------------------------------------------------------------------------
# DELETE /admin/comments/{id}
# ---------------------------------------------------------------------------

@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: uuid.UUID,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    logger.debug("[admin] delete_comment id=%s by %s", comment_id, current_admin.username)

    comment = (
        await db.execute(select(Comment).where(Comment.id == comment_id))
    ).scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Комментарий не найден")

    # parent_id uses ondelete='SET NULL', so manually delete replies first
    await db.execute(delete(Comment).where(Comment.parent_id == comment_id))

    await _log_action(
        db, current_admin, "delete_comment", "comment", str(comment_id),
        details=f"article_url={comment.article_url}",
    )
    await db.delete(comment)
    await db.commit()
    logger.debug("[admin] comment %s and its replies deleted", comment_id)


# ---------------------------------------------------------------------------
# GET /admin/api-keys
# ---------------------------------------------------------------------------

@router.get("/api-keys")
async def get_api_keys(
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Return stored API keys with values masked (all chars except last 4)."""
    logger.debug("[admin] get_api_keys by %s", current_admin.username)

    rows = (await db.execute(select(ApiKey))).scalars().all()
    result: dict[str, str] = {}
    for row in rows:
        try:
            plaintext = decrypt_value(row.encrypted_value)
            result[row.service] = mask_value(plaintext)
        except Exception:  # noqa: BLE001
            result[row.service] = "***"
    logger.debug("[admin] returned %d api-key entries", len(result))
    return result


# ---------------------------------------------------------------------------
# POST /admin/api-keys
# ---------------------------------------------------------------------------

@router.post("/api-keys", status_code=status.HTTP_204_NO_CONTENT)
async def save_api_keys(
    body: dict[str, str],
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Upsert API keys. Keys with empty-string values are skipped."""
    logger.debug("[admin] save_api_keys services=%s by %s", list(body.keys()), current_admin.username)

    for service, plaintext in body.items():
        if not plaintext:
            continue
        encrypted = encrypt_value(plaintext)
        stmt = (
            pg_insert(ApiKey)
            .values(
                id=uuid.uuid4(),
                service=service,
                encrypted_value=encrypted,
            )
            .on_conflict_do_update(
                index_elements=["service"],
                set_={"encrypted_value": encrypted, "updated_at": func.now()},
            )
        )
        await db.execute(stmt)
        await _log_action(
            db, current_admin, "save_api_key", "api_key", service,
        )
    await db.commit()
    # Drop the resolver cache so services pick up the new keys without a restart.
    for service in body:
        if body[service]:
            invalidate_cache(service)
    logger.debug("[admin] api-keys upserted (cache invalidated) for: %s", list(body.keys()))


# ---------------------------------------------------------------------------
# POST /admin/api-keys/test/{service}
# ---------------------------------------------------------------------------

_SERVICE_TEST_MAP: dict[str, str] = {
    "finnhub": "https://finnhub.io/api/v1/quote?symbol=AAPL&token={key}",
    "newsapi": "https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey={key}",
    "openrouter": "https://openrouter.ai/api/v1/models",
    "groq": "https://api.groq.com/openai/v1/models",
}

_SERVICE_AUTH_HEADER: dict[str, str] = {
    "openrouter": "Bearer {key}",
    "groq": "Bearer {key}",
}


@router.post("/api-keys/test/{service}")
async def test_api_key(
    service: str,
    body: dict[str, str] = Body(default_factory=dict),
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Test a key for *service*. If the request supplies a non-empty ``key`` it is
    tested directly (the value the admin just typed); otherwise the resolved key
    (DB→.env) is tested. The masked placeholder the panel renders for a saved key
    is treated as "no input" by the frontend, so it sends an empty value here."""
    logger.debug("[admin] test_api_key service=%s by %s", service, current_admin.username)

    if service not in _SERVICE_TEST_MAP:
        raise HTTPException(status_code=400, detail=f"Неизвестный сервис: {service}")

    candidate = (body.get("key") or "").strip()
    if candidate:
        key = candidate
        logger.debug("[admin] test_api_key service=%s using typed key", service)
    else:
        key = await get_api_key(service)
        logger.debug("[admin] test_api_key service=%s using resolved key present=%s", service, bool(key))
    if not key:
        return {"success": False, "message": "Ключ не задан"}

    url_template = _SERVICE_TEST_MAP[service]
    url = url_template.format(key=key)
    headers: dict[str, str] = {}
    if service in _SERVICE_AUTH_HEADER:
        headers["Authorization"] = _SERVICE_AUTH_HEADER[service].format(key=key)

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=headers)
        success = resp.status_code < 400
        message = "Ключ рабочий" if success else f"HTTP {resp.status_code}"
    except Exception as exc:  # noqa: BLE001
        success = False
        message = f"Ошибка соединения: {exc}"

    logger.debug("[admin] test_api_key service=%s success=%s message=%s", service, success, message)
    return {"success": success, "message": message}


# ---------------------------------------------------------------------------
# GET /admin/logs
# ---------------------------------------------------------------------------

@router.get("/logs", response_model=AdminLogsResponse)
async def list_logs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminLogsResponse:
    logger.debug("[admin] list_logs page=%d limit=%d by %s", page, limit, current_admin.username)

    total = (
        await db.execute(select(func.count()).select_from(AdminLog))
    ).scalar_one()

    offset = (page - 1) * limit
    rows = (
        await db.execute(
            select(AdminLog).order_by(AdminLog.created_at.desc()).offset(offset).limit(limit)
        )
    ).scalars().all()

    items = [
        AdminLogItem(
            id=str(row.id),
            admin_username=row.admin_username,
            action=row.action,
            target_type=row.target_type,
            target_id=row.target_id,
            details=row.details,
            created_at=row.created_at.isoformat(),
        )
        for row in rows
    ]
    return AdminLogsResponse(items=items, total=total)
