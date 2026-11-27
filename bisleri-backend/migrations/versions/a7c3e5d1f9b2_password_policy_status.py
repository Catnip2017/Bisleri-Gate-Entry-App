"""Password policy status on users_master

Revision ID: a7c3e5d1f9b2
Revises: b9e4d2a7c1f5
Create Date: 2026-11-27 10:00:00.000000

Chain (27 Nov 2026): ed3dc61a3e0f -> b9e4d2a7c1f5 (security) -> a7c3e5d1f9b2
(this) -> c4e8a1f7d2b9 (inventory).

  users_master.password_policy_ok   NULL = not checked yet (user has not logged
                                    in since), TRUE = meets the rule,
                                    FALSE = needs update. Set at every login.
  users_master.password_changed_at  when the user last set a password through
                                    the app's "Set a new password" page.

Additive only; downgrade() drops the two columns.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a7c3e5d1f9b2'
down_revision: Union[str, None] = 'b9e4d2a7c1f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users_master', sa.Column('password_policy_ok', sa.Boolean(), nullable=True))
    op.add_column('users_master', sa.Column('password_changed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # IF EXISTS: safe even if this revision was skipped on a database that
    # still had the 26 Nov inventory revision applied (see c4e8a1f7d2b9).
    op.execute("ALTER TABLE users_master DROP COLUMN IF EXISTS password_changed_at")
    op.execute("ALTER TABLE users_master DROP COLUMN IF EXISTS password_policy_ok")
