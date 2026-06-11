"""add parent_id to comments

Revision ID: a1b2c3d4e5f6
Revises: 639880bfd01c
Create Date: 2026-06-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '639880bfd01c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'comments',
        sa.Column(
            'parent_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('comments.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index('ix_comments_parent_id', 'comments', ['parent_id'])


def downgrade() -> None:
    op.drop_index('ix_comments_parent_id', table_name='comments')
    op.drop_column('comments', 'parent_id')
