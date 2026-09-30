"""add item_code + source to gate_pass_items (Fabric-fed Item master)

Revision ID: ed3dc61a3e0f
Revises: 25f510e280a8
Create Date: 2026-09-29 00:00:00.000000

Background
----------
gate_pass_items was purely user-populated (type a description, get-or-create
by name). It now also pulls from Fabric's Inventtable (itemid -> item_code,
namealias -> item_name), the same pattern gate_pass_assets already uses.

item_code is added nullable — Fabric-fed rows get one, rows added by hand
via the lookup pop-up's "+ Add new item" stay NULL, by design (confirmed
with the client: manual items are never assigned a code). Postgres allows
any number of NULLs alongside a UNIQUE constraint, so this is safe.

source distinguishes the two: every row that existed before this migration
was, by definition, typed in by hand under the old free-text flow, so they
are all backfilled to 'MANUAL'. New rows set it explicitly (the sync job
writes 'FABRIC', the manual-create endpoint writes 'MANUAL') — the column
default is just a safety net, not something either code path relies on.

item_name's old UNIQUE constraint is dropped: two different Fabric items
could plausibly share a description, and only the manual-create endpoint
needs a dedupe-by-name check now (done in Python, not a DB constraint).
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ed3dc61a3e0f'
down_revision: Union[str, None] = '25f510e280a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE gate_pass_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(50)"
    )
    op.execute(
        "ALTER TABLE gate_pass_items ADD COLUMN IF NOT EXISTS source VARCHAR(10) "
        "NOT NULL DEFAULT 'FABRIC'"
    )
    # Backfill: every existing row predates this feature, so it was typed by hand.
    op.execute("UPDATE gate_pass_items SET source = 'MANUAL'")
    op.execute(
        "ALTER TABLE gate_pass_items DROP CONSTRAINT IF EXISTS gate_pass_items_item_name_key"
    )
    op.execute(
        "ALTER TABLE gate_pass_items ADD CONSTRAINT uq_gate_pass_items_item_code UNIQUE (item_code)"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE gate_pass_items DROP CONSTRAINT IF EXISTS uq_gate_pass_items_item_code"
    )
    op.execute(
        "ALTER TABLE gate_pass_items ADD CONSTRAINT gate_pass_items_item_name_key UNIQUE (item_name)"
    )
    op.execute("ALTER TABLE gate_pass_items DROP COLUMN IF EXISTS source")
    op.execute("ALTER TABLE gate_pass_items DROP COLUMN IF EXISTS item_code")
