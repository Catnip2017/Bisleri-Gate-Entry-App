"""add fy_label to gate_pass_sequences (FY-scoped numbering)

Revision ID: 25f510e280a8
Revises: f3d8b6a1c9e2
Create Date: 2026-09-23 00:00:00.000000

Background
----------
Gate pass numbers now carry the financial year in them, e.g.
R-MUM-2026-27-001 / NR-MUM-2026-27-001, and the running 001 sequence must
reset to 1 at the start of every new FY (1 Apr) per (location, pass type).
fy_label becomes part of the sequence row's key so a new FY simply gets a
fresh counter row - no extra reset logic needed. Existing rows are
backfilled with an empty fy_label; they are pre-migration dev data and are
being cleared separately, so no historical fy_label backfill is attempted.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '25f510e280a8'
down_revision: Union[str, None] = 'f3d8b6a1c9e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE gate_pass_sequences "
        "ADD COLUMN IF NOT EXISTS fy_label VARCHAR(10) NOT NULL DEFAULT ''"
    )
    op.execute(
        "ALTER TABLE gate_pass_sequences "
        "DROP CONSTRAINT IF EXISTS uq_gate_pass_seq_loc_type"
    )
    op.execute(
        "ALTER TABLE gate_pass_sequences "
        "ADD CONSTRAINT uq_gate_pass_seq_loc_type_fy UNIQUE (location_code, pass_type, fy_label)"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE gate_pass_sequences "
        "DROP CONSTRAINT IF EXISTS uq_gate_pass_seq_loc_type_fy"
    )
    op.execute(
        "ALTER TABLE gate_pass_sequences "
        "ADD CONSTRAINT uq_gate_pass_seq_loc_type UNIQUE (location_code, pass_type)"
    )
    op.execute(
        "ALTER TABLE gate_pass_sequences DROP COLUMN IF EXISTS fy_label"
    )
