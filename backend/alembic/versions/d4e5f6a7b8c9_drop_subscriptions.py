"""drop subscriptions table and subscription_plan enum

Подписка/премиум удалены из продукта (ограничение ИИ переехало на Redis-лимит
30 req/min в routes/chat.py). Дропаем таблицу ``subscriptions`` и Postgres ENUM
``subscription_plan``. Данные users не затрагиваются.

Revision ID: d4e5f6a7b8c9
Revises: 496382003f27
Create Date: 2026-06-20
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "496382003f27"
branch_labels = None
depends_on = None

_subscription_plan = sa.Enum("free", "premium", name="subscription_plan")


def upgrade() -> None:
    # Drop the table first (it depends on the enum type via the `plan` column),
    # then drop the enum type itself — dropping the table alone leaves the type.
    op.drop_table("subscriptions")
    _subscription_plan.drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    # Recreate the enum type, then the table (with the ai_requests_used column
    # that migration 3b1f7c2a9d04 had added). create_type=False — the type is
    # created explicitly just above.
    _subscription_plan.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "plan",
            sa.Enum("free", "premium", name="subscription_plan", create_type=False),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ai_requests_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
