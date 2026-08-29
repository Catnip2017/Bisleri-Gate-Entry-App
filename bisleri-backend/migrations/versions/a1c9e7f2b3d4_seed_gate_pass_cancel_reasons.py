"""seed gate_pass_cancel_reasons master list

Revision ID: a1c9e7f2b3d4
Revises: b7c1d2e3f4a5
Create Date: 2026-08-29 00:00:00.000000

Background
----------
GatePassCancelReason's docstring says values are "seeded via migration", but
no migration ever actually did it - the table exists (created manually,
per 9018c99555d7's "baseline after manual changes") but has always been
empty. The Cancel Pass modal fetches this list and requires a reason to be
picked before the (mandatory) Cancel Pass button enables, so with zero rows
the button is permanently disabled and cancellation is effectively broken.

CREATE TABLE IF NOT EXISTS + INSERT ... ON CONFLICT DO NOTHING so this is
safe to run whether or not the table already exists and whether or not it's
already been seeded by hand somewhere.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1c9e7f2b3d4'
down_revision: Union[str, None] = 'b7c1d2e3f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REASONS = [
    (1, "Created by mistake / duplicate entry"),
    (2, "Wrong party selected"),
    (3, "Incorrect item or quantity details"),
    (4, "Vehicle or party did not arrive"),
    (5, "Movement no longer required"),
    (6, "Other (see remarks)"),
]


def upgrade() -> None:
    op.execute(
        "CREATE TABLE IF NOT EXISTS gate_pass_cancel_reasons ("
        "id SERIAL PRIMARY KEY, "
        "reason_text VARCHAR(255) NOT NULL UNIQUE, "
        "is_active BOOLEAN NOT NULL DEFAULT TRUE, "
        "sort_order INTEGER NOT NULL DEFAULT 0"
        ")"
    )
    for sort_order, reason_text in REASONS:
        op.execute(
            "INSERT INTO gate_pass_cancel_reasons (reason_text, is_active, sort_order) "
            f"VALUES ({reason_text!r}, TRUE, {sort_order}) "
            "ON CONFLICT (reason_text) DO NOTHING"
        )


def downgrade() -> None:
    op.execute(
        "DELETE FROM gate_pass_cancel_reasons WHERE reason_text IN ("
        + ", ".join(repr(r[1]) for r in REASONS)
        + ")"
    )
