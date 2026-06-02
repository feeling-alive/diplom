"""Subscription routes (prefix ``/subscription``).

A demo billing surface: read the current plan + feature matrix, activate a
30-day "premium" trial for free, and cancel back to free for testing. Feature
flags and the daily AI-request limit are derived from the plan tier — they are
not stored per-row.

All endpoints require authentication via :func:`get_current_user`.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Subscription, SubscriptionPlan, User

logger = logging.getLogger("backend.routes.subscription")

router = APIRouter(prefix="/subscription", tags=["subscription"])

AI_LIMIT_FREE = 5
AI_LIMIT_PREMIUM = 9999
PREMIUM_DAYS = 30


# --- Schemas ----------------------------------------------------------------

class SubscriptionFeatures(BaseModel):
    ai_requests_per_day: int
    ai_requests_used_today: int
    advanced_charts: bool
    export_data: bool
    priority_updates: bool


class SubscriptionStatus(BaseModel):
    plan: str
    expires_at: str | None
    features: SubscriptionFeatures


# --- Helpers ----------------------------------------------------------------

def _build_status(subscription: Subscription) -> SubscriptionStatus:
    """Derive the public status + feature matrix from a subscription row."""
    is_premium = subscription.plan == SubscriptionPlan.premium
    return SubscriptionStatus(
        plan=subscription.plan.value,
        expires_at=subscription.expires_at.isoformat() if subscription.expires_at else None,
        features=SubscriptionFeatures(
            ai_requests_per_day=AI_LIMIT_PREMIUM if is_premium else AI_LIMIT_FREE,
            # No daily reset in the demo — expose the running counter as "today".
            ai_requests_used_today=subscription.ai_requests_used,
            advanced_charts=is_premium,
            export_data=is_premium,
            priority_updates=is_premium,
        ),
    )


async def _get_or_create_subscription(db: AsyncSession, user: User) -> Subscription:
    """Return the user's subscription, lazily creating a free one if missing."""
    subscription = (
        await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    ).scalar_one_or_none()
    if subscription is None:
        logger.info("[subscription] creating missing free subscription for user=%s", user.id)
        subscription = Subscription(user_id=user.id, plan=SubscriptionPlan.free)
        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)
    return subscription


# --- Routes -----------------------------------------------------------------

@router.get("/status", response_model=SubscriptionStatus)
async def get_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionStatus:
    """Return the current plan and its derived feature matrix."""
    subscription = await _get_or_create_subscription(db, current_user)
    logger.debug("[subscription] status user=%s plan=%s", current_user.id, subscription.plan.value)
    return _build_status(subscription)


@router.post("/upgrade", response_model=SubscriptionStatus)
async def upgrade(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionStatus:
    """Activate a 30-day demo premium plan. 400 if already premium."""
    subscription = await _get_or_create_subscription(db, current_user)
    if subscription.plan == SubscriptionPlan.premium:
        logger.warning("[subscription] upgrade rejected — already premium user=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Подписка уже активна"
        )

    subscription.plan = SubscriptionPlan.premium
    subscription.expires_at = datetime.now(timezone.utc) + timedelta(days=PREMIUM_DAYS)
    await db.commit()
    await db.refresh(subscription)
    logger.info("[subscription] upgraded user=%s expires=%s", current_user.id, subscription.expires_at)
    return _build_status(subscription)


@router.post("/cancel", response_model=SubscriptionStatus)
async def cancel(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionStatus:
    """Reset the plan to free (demo/testing helper)."""
    subscription = await _get_or_create_subscription(db, current_user)
    subscription.plan = SubscriptionPlan.free
    subscription.expires_at = None
    await db.commit()
    await db.refresh(subscription)
    logger.info("[subscription] cancelled -> free user=%s", current_user.id)
    return _build_status(subscription)
