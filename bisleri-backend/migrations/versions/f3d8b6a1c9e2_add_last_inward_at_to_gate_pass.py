"""add last_inward_at to gate_pass_headers

Revision ID: f3d8b6a1c9e2
Revises: a1c9e7f2b3d4
Create Date: 2026-08-29 00:00:01.000000

Background
----------
completed_at only gets set once a Returnable pass is FULLY received back,
so a partially-received pass had no recorded date for "when did some of
this last come back". last_inward_at is stamped on every /inward call
(partial or full) so the guard/admin worklists can show an actual Inward
Date rather than blank until full closure.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f3d8b6a1c9e2'
down_revision: Union[str, None] = 'a1c9e7f2b3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE gate_pass_headers "
        "ADD COLUMN IF NOT EXISTS last_inward_at TIMESTAMPTZ"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE gate_pass_headers DROP COLUMN IF EXISTS last_inward_at")
