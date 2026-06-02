"""add ai_requests_used to subscriptions

Revision ID: 3b1f7c2a9d04
Revises: 22708b5bcbc0
Create Date: 2026-06-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3b1f7c2a9d04'
down_revision: Union[str, Sequence[str], None] = '22708b5bcbc0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add the demo AI-request counter to subscriptions."""
    # server_default='0' backfills existing rows; the ORM keeps a Python-side
    # default too, so new inserts work whether or not they go through Alembic.
    op.add_column(
        'subscriptions',
        sa.Column('ai_requests_used', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('subscriptions', 'ai_requests_used')
