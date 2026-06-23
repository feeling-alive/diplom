"""add enrich_attempts to news_articles

Revision ID: e5f6a7b8c9d0
Revises: c3d4e5f6a7b8
Create Date: 2026-06-23 19:10:00.000000

Tracks AI-enrichment attempts so transient provider failures retry on later
passes (instead of being flagged ``ai_processed`` on the first failure) while a
permanently-failing article is eventually given up on after a cap (bug: news
articles never re-translated / stuck untranslated).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'news_articles',
        sa.Column('enrich_attempts', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('news_articles', 'enrich_attempts')
