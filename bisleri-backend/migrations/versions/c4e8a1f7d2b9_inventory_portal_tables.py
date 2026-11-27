"""Blinkit Inventory Portal tables

Revision ID: c4e8a1f7d2b9
Revises: a7c3e5d1f9b2
Create Date: 2026-11-26 00:00:00.000000

Schema agreed on 26 Nov 2026 (store master version):

  item_master                 + search_name, product_service_type,
                              product_dimension_group, product_lifecycle_state,
                              packing_group, item_group (FG_Item_Master.xlsx).
                              Nothing dropped; item_number stays the key and is
                              the SKU code; product_name is the SKU name.
  blinkit_stores              new: id, store_code (unique), store_name, is_active
  inventory_batches           one row per Submit All / upload
  inventory_entries           stock lines: store_code -> blinkit_stores,
                              warehouse_code -> location_master (+ warehouse_name
                              copied on save), sku_code -> item_master
  inventory_user_warehouses   operator / viewer -> warehouses
  inventory_operator_stores   operator -> Blinkit stores (27 Nov 2026: was operator -> Blinkit users)
  inventory_viewer_store      Blinkit viewer -> ONE store

Load the masters after upgrading:
  python scripts/load_inventory_masters.py --items FG_Item_Master.xlsx --stores Blinkit_Stores.xlsx
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c4e8a1f7d2b9'
down_revision: Union[str, None] = 'a7c3e5d1f9b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ITEM_COLUMNS = [
    ('search_name', sa.String(255)),
    ('product_service_type', sa.String(100)),
    ('product_dimension_group', sa.String(50)),
    ('product_lifecycle_state', sa.String(50)),
    ('packing_group', sa.String(100)),
    ('item_group', sa.String(20)),
]


def upgrade() -> None:
    for name, typ in ITEM_COLUMNS:
        op.add_column('item_master', sa.Column(name, typ, nullable=True))

    op.create_table(
        'blinkit_stores',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('store_code', sa.String(50), nullable=False),
        sa.Column('store_name', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('store_code', name='uq_blinkit_stores_store_code'),
    )
    op.create_table(
        'inventory_batches',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('source', sa.String(10), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('line_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        'inventory_entries',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('batch_id', sa.BigInteger(), sa.ForeignKey('inventory_batches.id'), nullable=False),
        sa.Column('inv_date', sa.Date(), nullable=False),
        sa.Column('store_code', sa.String(50), sa.ForeignKey('blinkit_stores.store_code'), nullable=False),
        sa.Column('warehouse_code', sa.String(50), sa.ForeignKey('location_master.warehouse_code'), nullable=False),
        sa.Column('warehouse_name', sa.String(255), nullable=True),
        sa.Column('sku_code', sa.String(255), sa.ForeignKey('item_master.item_number'), nullable=False),
        sa.Column('sku_name', sa.String(255), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('batch_no', sa.String(100), nullable=True),
        sa.Column('mfg_date', sa.Date(), nullable=True),
        sa.Column('created_by', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('quantity > 0', name='ck_inventory_entries_quantity_positive'),
    )
    op.create_index('ix_inventory_entries_batch_id', 'inventory_entries', ['batch_id'])
    op.create_index('ix_inventory_entries_date_wh', 'inventory_entries', ['inv_date', 'warehouse_code'])
    op.create_index('ix_inventory_entries_store_date', 'inventory_entries', ['store_code', 'inv_date'])
    op.create_table(
        'inventory_user_warehouses',
        sa.Column('username', sa.String(50), sa.ForeignKey('users_master.username', ondelete='CASCADE'), primary_key=True),
        sa.Column('warehouse_code', sa.String(50), sa.ForeignKey('location_master.warehouse_code'), primary_key=True),
    )
    op.create_table(
        'inventory_operator_stores',
        sa.Column('operator_username', sa.String(50), sa.ForeignKey('users_master.username', ondelete='CASCADE'), primary_key=True),
        sa.Column('store_code', sa.String(50), sa.ForeignKey('blinkit_stores.store_code'), primary_key=True),
    )
    op.create_table(
        'inventory_viewer_store',
        sa.Column('username', sa.String(50), sa.ForeignKey('users_master.username', ondelete='CASCADE'), primary_key=True),
        sa.Column('store_code', sa.String(50), sa.ForeignKey('blinkit_stores.store_code'), nullable=False),
    )
    op.create_index('ix_inventory_viewer_store_store_code', 'inventory_viewer_store', ['store_code'])


def downgrade() -> None:
    op.drop_index('ix_inventory_viewer_store_store_code', table_name='inventory_viewer_store')
    op.drop_table('inventory_viewer_store')
    # IF EXISTS on both: a database upgraded with the 26 Nov version of this
    # revision has inventory_operator_viewers instead of _stores.
    op.execute("DROP TABLE IF EXISTS inventory_operator_stores")
    op.execute("DROP TABLE IF EXISTS inventory_operator_viewers")
    op.drop_table('inventory_user_warehouses')
    op.drop_index('ix_inventory_entries_store_date', table_name='inventory_entries')
    op.drop_index('ix_inventory_entries_date_wh', table_name='inventory_entries')
    op.drop_index('ix_inventory_entries_batch_id', table_name='inventory_entries')
    op.drop_table('inventory_entries')
    op.drop_table('inventory_batches')
    op.drop_table('blinkit_stores')
    for name, _ in reversed(ITEM_COLUMNS):
        op.drop_column('item_master', name)
