"""add interlayer_sheet_count field

Revision ID: f1a2b3c4d5e6
Revises: d473b4346958
Create Date: 2026-07-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'd473b4346958'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'insights_data',
        sa.Column('interlayer_sheet_count', sa.Integer(), nullable=False, server_default='0')
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column('insights_data', 'interlayer_sheet_count')
    # ### end Alembic commands ###
