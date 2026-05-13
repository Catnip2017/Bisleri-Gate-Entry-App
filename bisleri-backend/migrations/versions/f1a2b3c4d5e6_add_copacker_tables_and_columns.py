"""add copacker tables and columns

Revision ID: f1a2b3c4d5e6
Revises: d473b4346958
Create Date: 2026-05-13 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'd473b4346958'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Add copacker_location to users_master ────────────────────────────
    op.add_column(
        'users_master',
        sa.Column('copacker_location', sa.String(255), nullable=True)
    )

    # ── 2. copacker_locations ───────────────────────────────────────────────
    op.create_table(
        'copacker_locations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('location_name', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('location_name', name='uq_copacker_location_name'),
    )

    # ── 3. copacker_assets ──────────────────────────────────────────────────
    op.create_table(
        'copacker_assets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=False),
        sa.Column('line_no', sa.Integer(), nullable=False),
        sa.Column('asset_model_id', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['location_id'], ['copacker_locations.id'], name='fk_copacker_asset_location'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('location_id', 'line_no', name='uq_copacker_asset_location_line'),
    )

    # ── 4. copacker_entries ─────────────────────────────────────────────────
    op.create_table(
        'copacker_entries',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('copacker_location', sa.String(255), nullable=False),
        sa.Column('line_no', sa.Integer(), nullable=False),
        sa.Column('asset_model_id', sa.String(255), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('entry_time', sa.Time(), nullable=False),
        sa.Column('image_path', sa.Text(), nullable=True),
        sa.Column('sku_name', sa.String(255), nullable=True),
        sa.Column('sku_itemid', sa.String(255), nullable=True),
        sa.Column('username', sa.String(255), nullable=False),
        sa.Column('extracted_quantity', sa.Integer(), nullable=True),
        sa.Column('extracted_quantity_raw', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── 5. copacker_quantity_edit_log ───────────────────────────────────────
    op.create_table(
        'copacker_quantity_edit_log',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('entry_id', sa.Integer(), nullable=False),
        sa.Column('original_value', sa.Integer(), nullable=True),
        sa.Column('edited_value', sa.Integer(), nullable=False),
        sa.Column('edited_by', sa.String(255), nullable=False),
        sa.Column('edited_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('auto_remarks', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['entry_id'], ['copacker_entries.id'], name='fk_edit_log_entry'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('copacker_quantity_edit_log')
    op.drop_table('copacker_entries')
    op.drop_table('copacker_assets')
    op.drop_table('copacker_locations')
    op.drop_column('users_master', 'copacker_location')
