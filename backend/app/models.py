"""SQLAlchemy 2.0 ORM models for FinTrack (Блок A).

Domain tables: User, DashboardConfig, ChatSession, Comment,
Favorite (+ news/admin/notification tables). All models use the typed
``Mapped`` / ``mapped_column`` style and a
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
    Text,
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
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification",
        foreign_keys="[Notification.user_id]",
        back_populates="user",
        cascade="all, delete-orphan",
    )




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
    """A user comment on a news article, keyed by ``article_url``.

    ``parent_id`` is nullable — top-level comments have ``None``, replies
    point to their parent comment (depth 1 only).
    """

    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    article_url: Mapped[str] = mapped_column(String(2048), index=True, nullable=False)
    text: Mapped[str] = mapped_column(String(1000), nullable=False)
    likes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("comments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="comments")
    replies: Mapped[list["Comment"]] = relationship(
        "Comment",
        foreign_keys="[Comment.parent_id]",
        back_populates="parent",
        lazy="selectin",
    )
    parent: Mapped["Comment | None"] = relationship(
        "Comment",
        foreign_keys="[Comment.parent_id]",
        back_populates="replies",
        remote_side="Comment.id",
    )


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


class NewsArticle(Base):
    """Cached financial news article. Populated by the APScheduler fetcher."""

    __tablename__ = "news_articles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(1024), nullable=False)
    title_ru: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    description: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    description_ru: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    content: Mapped[str | None] = mapped_column(String(8192), nullable=True)
    content_ru: Mapped[str | None] = mapped_column(String(8192), nullable=True)
    url: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False)
    url_to_image: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    source_name: Mapped[str] = mapped_column(String(256), nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="general", index=True)
    symbols: Mapped[list | None] = mapped_column(JSONType, nullable=True)
    keywords: Mapped[list | None] = mapped_column(JSONType, nullable=True)
    market_impact: Mapped[str | None] = mapped_column(String(16), nullable=True)
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="en")
    ai_processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    reactions: Mapped[list["NewsReaction"]] = relationship(
        back_populates="article", cascade="all, delete-orphan"
    )
    news_favorites: Mapped[list["NewsFavorite"]] = relationship(
        back_populates="article", cascade="all, delete-orphan"
    )


class NewsReaction(Base):
    """Like or dislike on a news article. One reaction per (user, article)."""

    __tablename__ = "news_reactions"
    __table_args__ = (UniqueConstraint("user_id", "article_id", name="uq_news_reaction"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("news_articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reaction_type: Mapped[str] = mapped_column(String(16), nullable=False)  # like | dislike
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    article: Mapped["NewsArticle"] = relationship(back_populates="reactions")


class NewsFavorite(Base):
    """User's favorited news article. One row per (user, article)."""

    __tablename__ = "news_favorites"
    __table_args__ = (UniqueConstraint("user_id", "article_id", name="uq_news_favorite"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("news_articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    article: Mapped["NewsArticle"] = relationship(back_populates="news_favorites")


class Notification(Base):
    """In-app notification for a user.

    Created when:
    - Someone replies to the user's comment (type='comment_reply')
    - Someone likes the user's comment (type='reaction')

    ``sender_id`` is nullable so the notification survives sender deletion.
    """

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[str] = mapped_column(String(512), nullable=False)
    link: Mapped[str] = mapped_column(String(2048), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="notifications"
    )
    sender: Mapped["User | None"] = relationship("User", foreign_keys=[sender_id])


class ApiKey(Base):
    """Encrypted API key for an external service, stored per service name."""

    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    service: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AdminLog(Base):
    """Audit log of admin actions.

    ``admin_id`` is SET NULL on user deletion so the log entry survives.
    """

    __tablename__ = "admin_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    admin_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    admin_username: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str] = mapped_column(String(255), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


logger.debug("[models] registered %d tables: %s", len(Base.metadata.tables), list(Base.metadata.tables))
logger.debug("[models] NewsArticle/NewsReaction/NewsFavorite/Notification/ApiKey/AdminLog defined")
