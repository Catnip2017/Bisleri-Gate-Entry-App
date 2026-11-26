"""Blinkit Inventory Portal tables

Revision ID: c4e8a1f7d2b9
Revises: ed3dc61a3e0f
Create Date: 2026-11-26 00:00:00.000000

Five new tables for the Blinkit Inventory Portal (see app/models/inventory.py).
Purely additive — no existing table is touched.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c4e8a1f7d2b9'
down_revision: Union[str, None] = 'ed3dc61a3e0f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
        sa.Column('customer_code', sa.String(50), nullable=False),
        sa.Column('warehouse_code', sa.String(50), sa.ForeignKey('location_master.warehouse_code'), nullable=False),
        sa.Column('sku_code', sa.String(255), nullable=False),
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
    op.create_index('ix_inventory_entries_cust_date', 'inventory_entries', ['customer_code', 'inv_date'])
    op.create_table(
        'inventory_user_warehouses',
        sa.Column('username', sa.String(50), sa.ForeignKey('users_master.username', ondelete='CASCADE'), primary_key=True),
        sa.Column('warehouse_code', sa.String(50), sa.ForeignKey('location_master.warehouse_code'), primary_key=True),
    )
    op.create_table(
        'inventory_operator_viewers',
        sa.Column('operator_username', sa.String(50), sa.ForeignKey('users_master.username', ondelete='CASCADE'), primary_key=True),
        sa.Column('viewer_username', sa.String(50), sa.ForeignKey('users_master.username', ondelete='CASCADE'), primary_key=True),
    )
    op.create_table(
        'inventory_viewer_customer',
        sa.Column('username', sa.String(50), sa.ForeignKey('users_master.username', ondelete='CASCADE'), primary_key=True),
        sa.Column('customer_code', sa.String(50), nullable=False),
    )
    op.create_index('ix_inventory_viewer_customer_customer_code', 'inventory_viewer_customer', ['customer_code'])


def downgrade() -> None:
    op.drop_table('inventory_viewer_customer')
    op.drop_table('inventory_operator_viewers')
    op.drop_table('inventory_user_warehouses')
    op.drop_index('ix_inventory_entries_cust_date', table_name='inventory_entries')
    op.drop_index('ix_inventory_entries_date_wh', table_name='inventory_entries')
    op.drop_index('ix_inventory_entries_batch_id', table_name='inventory_entries')
    op.drop_table('inventory_entries')
    op.drop_table('inventory_batches')
