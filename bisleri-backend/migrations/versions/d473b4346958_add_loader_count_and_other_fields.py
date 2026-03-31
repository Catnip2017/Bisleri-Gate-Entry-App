"""add loader_count and other fields

Revision ID: d473b4346958
Revises: 359063c9d0ab
Create Date: 2026-03-25 20:20:12.562616

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd473b4346958'
down_revision: Union[str, None] = '359063c9d0ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('insights_data', sa.Column('loader_count', sa.Integer(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column('insights_data', 'loader_count')
    # ### end Alembic commands ###
