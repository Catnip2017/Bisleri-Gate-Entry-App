"""split parties into vendors/customers, redefine item/asset masters

Revision ID: cd0dc3b67696
Revises: 7b84e57cc45b
Create Date: 2026-08-18 00:00:00.000000

Gate Pass restructure:
 - gate_pass_parties dropped; replaced by gate_pass_vendors and
   gate_pass_customers (same shape, Fabric-fed, mutually exclusive on the
   create form). gate_pass_headers gets a new party_type column recording
   which master the party_code/party_name came from.
 - gate_pass_items (previously the Fabric-fed Fixed Asset master) is
   renamed to gate_pass_assets with asset_code/asset_name columns.
 - gate_pass_items is redefined as the user-populated "Item" master:
   server-generated item_id PK, unique item_name, no fa_class_code.
 - gate_pass_lines gets item_code split into asset_code (Fixed Asset
   lines) and item_id (Item lines) since the two masters now have
   different key types.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd0dc3b67696'
down_revision: Union[str, None] = '7b84e57cc45b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Vendors / Customers (replace gate_pass_parties) ──────────────────
    op.create_table(
        'gate_pass_vendors',
        sa.Column('vendor_code', sa.String(length=50), nullable=False),
        sa.Column('vendor_name', sa.String(length=255), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('post_code', sa.String(length=20), nullable=True),
        sa.Column('phone_no', sa.String(length=20), nullable=True),
        sa.Column('contact', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('vendor_code'),
    )
    op.create_table(
        'gate_pass_customers',
        sa.Column('customer_code', sa.String(length=50), nullable=False),
        sa.Column('customer_name', sa.String(length=255), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('post_code', sa.String(length=20), nullable=True),
        sa.Column('phone_no', sa.String(length=20), nullable=True),
        sa.Column('contact', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('customer_code'),
    )
    op.drop_table('gate_pass_parties')

    # ── Assets (Fabric-fed Fixed Asset master, renamed from gate_pass_items) ─
    op.create_table(
        'gate_pass_assets',
        sa.Column('asset_code', sa.String(length=50), nullable=False),
        sa.Column('asset_name', sa.String(length=255), nullable=False),
        sa.Column('fa_class_code', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('asset_code'),
    )
    op.execute(
        "INSERT INTO gate_pass_assets (asset_code, asset_name, fa_class_code, is_active) "
        "SELECT item_code, item_name, fa_class_code, is_active FROM gate_pass_items"
    )

    # ── gate_pass_lines: item_code -> asset_code + item_id ────────────────
    op.alter_column('gate_pass_lines', 'item_code', new_column_name='asset_code')
    op.add_column('gate_pass_lines', sa.Column('item_id', sa.Integer(), nullable=True))

    # ── gate_pass_items redefined: user-populated Item master ─────────────
    op.drop_table('gate_pass_items')
    op.create_table(
        'gate_pass_items',
        sa.Column('item_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('item_name', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('item_id'),
        sa.UniqueConstraint('item_name'),
    )

    # ── gate_pass_headers: party_type ──────────────────────────────────────
    op.add_column('gate_pass_headers', sa.Column('party_type', sa.String(length=10), nullable=True))
    op.execute("UPDATE gate_pass_headers SET party_type = 'Vendor' WHERE party_type IS NULL")
    op.alter_column('gate_pass_headers', 'party_type', nullable=False)


def downgrade() -> None:
    op.drop_column('gate_pass_headers', 'party_type')

    op.drop_table('gate_pass_items')
    op.create_table(
        'gate_pass_items',
        sa.Column('item_code', sa.String(length=50), nullable=False),
        sa.Column('item_name', sa.String(length=255), nullable=False),
        sa.Column('fa_class_code', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('item_code'),
    )
    op.execute(
        "INSERT INTO gate_pass_items (item_code, item_name, fa_class_code, is_active) "
        "SELECT asset_code, asset_name, fa_class_code, is_active FROM gate_pass_assets"
    )

    op.drop_column('gate_pass_lines', 'item_id')
    op.alter_column('gate_pass_lines', 'asset_code', new_column_name='item_code')

    op.drop_table('gate_pass_assets')

    op.create_table(
        'gate_pass_parties',
        sa.Column('party_code', sa.String(length=50), nullable=False),
        sa.Column('party_name', sa.String(length=255), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('post_code', sa.String(length=20), nullable=True),
        sa.Column('phone_no', sa.String(length=20), nullable=True),
        sa.Column('contact', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('party_code'),
    )
    op.drop_table('gate_pass_customers')
    op.drop_table('gate_pass_vendors')
