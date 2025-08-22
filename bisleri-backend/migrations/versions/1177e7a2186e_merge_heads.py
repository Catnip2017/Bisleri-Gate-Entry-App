"""merge_heads

Revision ID: 1177e7a2186e
Revises: 002e85fd17ab, your_revision_id
Create Date: 2025-08-21 18:28:24.913626

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1177e7a2186e'
down_revision: Union[str, None] = ('002e85fd17ab', 'your_revision_id')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
