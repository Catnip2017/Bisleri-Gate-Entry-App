"""baseline after manual changes

Revision ID: 9018c99555d7
Revises: e2b72a7ef674
Create Date: 2025-10-10 11:34:02.239729

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9018c99555d7'
down_revision: Union[str, None] = 'e2b72a7ef674'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
