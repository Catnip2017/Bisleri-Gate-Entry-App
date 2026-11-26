# app/models/security.py - Audit trail, Security Settings and dormant-account
# alerts (26 Nov 2026, migration b9e4d2a7c1f5).
#
#   audit_log          add-only: one row per access change / failed login /
#                      settings change. Never updated or deleted by the app.
#                      target_user has NO foreign key on purpose, so history
#                      survives when a user is deleted.
#   security_settings  key/value settings shown on the Security Settings page
#   security_alerts    dormant-account alerts raised by the nightly job.
#                      The job NEVER disables an account — IT Admin decides.
from sqlalchemy import Column, BigInteger, Integer, String, Text, DateTime, JSON, Index
from sqlalchemy.sql import func
from app.database import Base

_BigId = BigInteger().with_variant(Integer, "sqlite")


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_log_target_created", "target_user", "created_at"),
        Index("ix_audit_log_created", "created_at"),
        Index("ix_audit_log_action", "action"),
    )

    id = Column(_BigId, primary_key=True, autoincrement=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    actor = Column(String(50), nullable=True)          # who did it (NULL = system / anonymous)
    action = Column(String(50), nullable=False)        # e.g. user_created, role_changed, login_failed
    target_user = Column(String(50), nullable=True)    # whose account it is about
    details = Column(JSON, nullable=True)              # {"before": {...}, "after": {...}, ...}
    reason = Column(String(500), nullable=True)        # optional note typed by the IT Admin
    ip = Column(String(64), nullable=True)


class SecuritySetting(Base):
    __tablename__ = "security_settings"

    key = Column(String(50), primary_key=True)
    value = Column(Text, nullable=True)
    updated_by = Column(String(50), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())


class SecurityAlert(Base):
    __tablename__ = "security_alerts"
    __table_args__ = (
        Index("ix_security_alerts_status", "status"),
        Index("ix_security_alerts_user_kind", "username", "kind"),
    )

    id = Column(_BigId, primary_key=True, autoincrement=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    username = Column(String(50), nullable=False)
    kind = Column(String(30), nullable=False)          # inactive_warning | inactive | never_used
    days = Column(Integer, nullable=True)              # days inactive / since created
    message = Column(String(500), nullable=True)
    status = Column(String(15), nullable=False, default="open", server_default="open")  # open | dismissed | resolved
    handled_by = Column(String(50), nullable=True)
    handled_at = Column(DateTime(timezone=True), nullable=True)
    emailed_at = Column(DateTime(timezone=True), nullable=True)
