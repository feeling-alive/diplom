"""SQLAlchemy 2.0 ORM models for FinTrack (Блок A).

Six domain tables: User, Subscription, DashboardConfig, ChatSession, Comment,
Favorite. All models use the typed ``Mapped`` / ``mapped_column`` style and a
shared ``Base`` from :mod:`app.database`. UUID primary keys default to
``uuid4``; enums are given explicit ``name=`` so Alembic emits stable PostgreSQL
ENUM types. Timestamps are timezone-aware and default to ``now()`` server-side.
"""

from __future__ import annotations

import enum
import logging
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

logger = logging.getLogger("backend.models")

# JSONB on PostgreSQL (indexable, binary), plain JSON elsewhere (e.g. the
# sqlite used by smoke tests). Keeps the models portable while staying optimal
# on the production database.
JSONType = JSON().with_variant(JSONB, "postgresql")


class UserRole(str, enum.Enum):
    """Authorization role for a user."""

    user = "user"
    admin = "admin"


class SubscriptionPlan(str, enum.Enum):
    """Billing plan tier."""

    free = "free"
    premium = "premium"


class User(Base):
    """Application user. ``password_hash`` is nullable for Google-only accounts."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.user, nullable=False
    )
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships (1:1 where unique FK, 1:N otherwise). cascade keeps child
    # rows consistent when a user is deleted.
    subscription: Mapped["Subscription | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    dashboard_config: Mapped["DashboardConfig | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    favorites: Mapped[list["Favorite"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Subscription(Base):
    """A user's plan. One row per user (unique FK enforces 1:1)."""

    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    plan: Mapped[SubscriptionPlan] = mapped_column(
        Enum(SubscriptionPlan, name="subscription_plan"),
        default=SubscriptionPlan.free,
        nullable=False,
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Demo AI-request counter. The per-plan limit and feature flags are derived in
    # the route layer (free=5, premium=unlimited), not stored here. No daily reset
    # in the demo — the value is exposed as "used today".
    ai_requests_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="subscription")


class DashboardConfig(Base):
    """Persisted dashboard layout (widget grid) for a user. One row per user."""

    __tablename__ = "dashboard_configs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    layout: Mapped[dict | list | None] = mapped_column(JSONType, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="dashboard_config")


class ChatSession(Base):
    """An AI chat session, optionally scoped to an asset ``symbol``.

    ``messages`` stores the conversation as a JSON array of ``{role, content}``.
    """

    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str | None] = mapped_column(String(32), nullable=True)
    messages: Mapped[list | None] = mapped_column(JSONType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="chat_sessions")


class Comment(Base):
    """A user comment on a news article, keyed by ``article_url``."""

    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    article_url: Mapped[str] = mapped_column(String(2048), index=True, nullable=False)
    text: Mapped[str] = mapped_column(String(1000), nullable=False)
    likes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="comments")


class Favorite(Base):
    """A user's favorited asset symbol. Unique per (user, symbol)."""

    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "symbol", name="uq_favorite_user_symbol"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="favorites")


logger.debug("[models] registered %d tables: %s", len(Base.metadata.tables), list(Base.metadata.tables))
