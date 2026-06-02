"""Auth routes: register, login, logout, me (+ Google OAuth in this module).

JWT is delivered as an HttpOnly cookie so the browser sends it automatically and
JS cannot read it. The frontend talks to these routes through the Vite proxy, so
from the browser's perspective they are same-origin (no cross-site cookie issues).
"""

from __future__ import annotations

import logging
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import COOKIE_NAME, get_current_user
from app.auth.schemas import LoginRequest, RegisterRequest, UserResponse
from app.auth.utils import create_access_token, hash_password, verify_password
from app.config import settings
from app.database import get_db
from app.models import Subscription, SubscriptionPlan, User

logger = logging.getLogger("backend.auth.router")

# Google OAuth endpoints.
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

router = APIRouter(prefix="/auth", tags=["auth"])

# 7 days in seconds — matches the JWT lifetime default.
COOKIE_MAX_AGE = 60 * 60 * 24 * 7


def _set_auth_cookie(response: Response, user: User) -> None:
    """Issue a JWT for ``user`` and attach it as an HttpOnly cookie."""
    token = create_access_token({"sub": str(user.id)})
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,  # dev over http://localhost; set True behind HTTPS in prod
        path="/",
    )


@router.post("/register", response_model=UserResponse)
async def register(
    payload: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Create a user + free subscription, set the auth cookie, return the user."""
    logger.info("[auth] register email=%s username=%s", payload.email, payload.username)

    existing_email = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalar_one_or_none()
    if existing_email is not None:
        logger.warning("[auth] register rejected — email taken: %s", payload.email)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email уже занят")

    existing_username = (
        await db.execute(select(User).where(User.username == payload.username))
    ).scalar_one_or_none()
    if existing_username is not None:
        logger.warning("[auth] register rejected — username taken: %s", payload.username)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Имя пользователя уже занято"
        )

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()  # assign user.id before creating the subscription
    db.add(Subscription(user_id=user.id, plan=SubscriptionPlan.free))
    await db.commit()
    await db.refresh(user)

    _set_auth_cookie(response, user)
    logger.info("[auth] registered user=%s", user.id)
    return user


@router.post("/login", response_model=UserResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate credentials, set the auth cookie, return the user."""
    user = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash or ""):
        logger.warning("[auth] login failed for email=%s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль"
        )
    if not user.is_active:
        logger.warning("[auth] login blocked — inactive user=%s", user.id)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аккаунт заблокирован")

    _set_auth_cookie(response, user)
    logger.info("[auth] login ok user=%s", user.id)
    return user


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    """Clear the auth cookie."""
    response.delete_cookie(key=COOKIE_NAME, path="/")
    logger.info("[auth] logout")
    return {"message": "Выход выполнен"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> User:
    """Return the currently authenticated user (401 if no/invalid cookie)."""
    return current_user


# --- Google OAuth ----------------------------------------------------------

def _require_google_configured() -> None:
    """Raise 501 when Google OAuth credentials are not configured."""
    if not settings.google_client_id:
        logger.warning("[auth] google endpoint hit but GOOGLE_CLIENT_ID is empty")
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Google OAuth не настроен"
        )


async def _unique_username(db: AsyncSession, base: str) -> str:
    """Return a username derived from ``base`` that is not yet taken."""
    candidate = (base or "user").strip()[:20] or "user"
    suffix = 0
    while True:
        existing = (
            await db.execute(select(User).where(User.username == candidate))
        ).scalar_one_or_none()
        if existing is None:
            return candidate
        suffix += 1
        tail = str(suffix)
        candidate = f"{(base or 'user').strip()[: 20 - len(tail) - 1]}_{tail}"


@router.get("/google")
async def google_login() -> RedirectResponse:
    """Redirect the browser to Google's OAuth consent screen."""
    _require_google_configured()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": f"{settings.backend_url}/auth/google/callback",
        "response_type": "code",
        "scope": "email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    logger.info("[auth] google login redirect")
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle the OAuth callback: exchange code, upsert user, set cookie, redirect."""
    _require_google_configured()

    code = request.query_params.get("code")
    if not code:
        logger.warning("[auth] google callback without code")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Отсутствует code")

    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        try:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": f"{settings.backend_url}/auth/google/callback",
                },
            )
            token_resp.raise_for_status()
            access_token = token_resp.json().get("access_token")
            if not access_token:
                raise ValueError("no access_token in Google response")

            profile_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            profile_resp.raise_for_status()
            profile = profile_resp.json()
        except (httpx.HTTPError, ValueError) as err:
            logger.warning("[auth] google oauth exchange failed: %s", err)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail="Ошибка авторизации Google"
            )

    google_id = str(profile.get("id", ""))
    email = profile.get("email")
    if not google_id or not email:
        logger.warning("[auth] google profile missing id/email")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Профиль Google неполон")

    # 1) Existing google_id -> login. 2) Existing email -> link. 3) New -> create.
    user = (
        await db.execute(select(User).where(User.google_id == google_id))
    ).scalar_one_or_none()
    action = "login"
    if user is None:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is not None:
            user.google_id = google_id
            if not user.avatar_url and profile.get("picture"):
                user.avatar_url = profile.get("picture")
            await db.commit()
            await db.refresh(user)
            action = "linked"
        else:
            base = profile.get("name") or email.split("@", 1)[0]
            user = User(
                email=email,
                username=await _unique_username(db, base),
                password_hash=None,
                google_id=google_id,
                avatar_url=profile.get("picture"),
            )
            db.add(user)
            await db.flush()
            db.add(Subscription(user_id=user.id, plan=SubscriptionPlan.free))
            await db.commit()
            await db.refresh(user)
            action = "created"

    redirect = RedirectResponse(f"{settings.frontend_url}/")
    _set_auth_cookie(redirect, user)
    logger.info("[auth] google callback: %s user=%s", action, user.id)
    return redirect
