"""Audit trail, Security Settings, dormant-account alerts

Revision ID: b9e4d2a7c1f5
Revises: ed3dc61a3e0f
Create Date: 2026-11-26 18:00:00.000000

Placed BEFORE the inventory migration (c4e8a1f7d2b9) so it can be applied on
its own while the inventory master data is still awaited:

    alembic upgrade b9e4d2a7c1f5      # this migration only
    alembic upgrade head              # later, also the inventory tables

What it does (additive only — nothing is dropped or rewritten):
  * users_master: + created_at, + last_seen_at. Existing users get
    created_at = the moment this migration runs (the go-live date), so the
    "never used within 30 days" rule starts counting from go-live.
  * audit_log          (add-only history of access changes, failed logins, ...)
  * security_settings  (seeded with the agreed defaults: 90 days inactive,
                        warning from day 75, never-used 30 days, no auto-disable)
  * security_alerts    (alerts raised by the nightly job)

downgrade() removes exactly these objects again.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b9e4d2a7c1f5'
down_revision: Union[str, None] = 'ed3dc61a3e0f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULTS = [
    ("inactive_days", "90"),
    ("warning_days", "75"),
    ("never_used_days", "30"),
    ("alerts_enabled", "true"),
    ("alert_inapp", "true"),
    ("alert_email", "false"),
    ("alert_emails", ""),
    ("exempt_users", ""),
]


def upgrade() -> None:
    op.add_column('users_master', sa.Column('created_at', sa.DateTime(), nullable=True,
                                            server_default=sa.func.now()))
    op.add_column('users_master', sa.Column('last_seen_at', sa.DateTime(), nullable=True))
    # Back-fill: existing accounts count as created on go-live day.
    op.execute("UPDATE users_master SET created_at = now() WHERE created_at IS NULL")

    op.create_table(
        'audit_log',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('actor', sa.String(50), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('target_user', sa.String(50), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('ip', sa.String(64), nullable=True),
    )
    op.create_index('ix_audit_log_target_created', 'audit_log', ['target_user', 'created_at'])
    op.create_index('ix_audit_log_created', 'audit_log', ['created_at'])
    op.create_index('ix_audit_log_action', 'audit_log', ['action'])

    settings = op.create_table(
        'security_settings',
        sa.Column('key', sa.String(50), primary_key=True),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('updated_by', sa.String(50), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
    )
    op.bulk_insert(settings, [{"key": k, "value": v, "updated_by": "migration"} for k, v in DEFAULTS])

    op.create_table(
        'security_alerts',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('kind', sa.String(30), nullable=False),
        sa.Column('days', sa.Integer(), nullable=True),
        sa.Column('message', sa.String(500), nullable=True),
        sa.Column('status', sa.String(15), nullable=False, server_default='open'),
        sa.Column('handled_by', sa.String(50), nullable=True),
        sa.Column('handled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('emailed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_security_alerts_status', 'security_alerts', ['status'])
    op.create_index('ix_security_alerts_user_kind', 'security_alerts', ['username', 'kind'])


def downgrade() -> None:
    op.drop_index('ix_security_alerts_user_kind', table_name='security_alerts')
    op.drop_index('ix_security_alerts_status', table_name='security_alerts')
    op.drop_table('security_alerts')
    op.drop_table('security_settings')
    op.drop_index('ix_audit_log_action', table_name='audit_log')
    op.drop_index('ix_audit_log_created', table_name='audit_log')
    op.drop_index('ix_audit_log_target_created', table_name='audit_log')
    op.drop_table('audit_log')
    op.drop_column('users_master', 'last_seen_at')
    op.drop_column('users_master', 'created_at')
