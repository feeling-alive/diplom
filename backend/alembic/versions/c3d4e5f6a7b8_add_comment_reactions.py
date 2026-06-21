"""add comment_reactions table (per-user comment like/dislike)

Revision ID: c3d4e5f6a7b8
Revises: d4e5f6a7b8c9
Create Date: 2026-06-21 12:30:00.000000

Replaces the free-running ``comments.likes`` integer counter with per-user,
toggleable reactions (bug #9). The legacy ``likes`` column is kept for backward
compatibility but is no longer the source of truth.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'comment_reactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('comment_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('comments.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('reaction_type', sa.String(16), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('user_id', 'comment_id', name='uq_comment_reaction'),
    )
    op.create_index('ix_comment_reactions_user_id', 'comment_reactions', ['user_id'])
    op.create_index('ix_comment_reactions_comment_id', 'comment_reactions', ['comment_id'])


def downgrade() -> None:
    op.drop_index('ix_comment_reactions_comment_id', table_name='comment_reactions')
    op.drop_index('ix_comment_reactions_user_id', table_name='comment_reactions')
    op.drop_table('comment_reactions')
