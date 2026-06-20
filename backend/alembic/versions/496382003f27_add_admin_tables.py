"""add_admin_tables

Revision ID: 496382003f27
Revises: b2c3d4e5f6a7
Create Date: 2026-06-12 01:49:41.905391

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '496382003f27'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add api_keys and admin_logs tables for admin panel.

    Note: notifications, comments.parent_id already exist (created via
    Base.metadata.create_all before migrations were fully applied).
    """
    op.create_table(
        'api_keys',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('service', sa.String(length=64), nullable=False),
        sa.Column('encrypted_value', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_api_keys_service'), 'api_keys', ['service'], unique=True)
    op.create_table(
        'admin_logs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('admin_id', sa.Uuid(), nullable=True),
        sa.Column('admin_username', sa.String(length=64), nullable=False),
        sa.Column('action', sa.String(length=128), nullable=False),
        sa.Column('target_type', sa.String(length=64), nullable=False),
        sa.Column('target_id', sa.String(length=255), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_admin_logs_admin_id'), 'admin_logs', ['admin_id'], unique=False)
    op.create_index(op.f('ix_admin_logs_created_at'), 'admin_logs', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema: drop admin_logs and api_keys tables."""
    op.drop_index(op.f('ix_admin_logs_created_at'), table_name='admin_logs')
    op.drop_index(op.f('ix_admin_logs_admin_id'), table_name='admin_logs')
    op.drop_table('admin_logs')
    op.drop_index(op.f('ix_api_keys_service'), table_name='api_keys')
    op.drop_table('api_keys')
