# app/fabric_sync/connections.py
#
# SOURCE = Microsoft Fabric Lakehouse SQL analytics endpoint — read-only
# pull, authenticated as the app's own Azure AD App Registration (service
# principal). Token-based auth via azure-identity, NOT the ODBC driver's
# built-in "Authentication=ActiveDirectoryServicePrincipal" mode — this is
# Microsoft's documented pattern for pyodbc + AAD (SQL_COPT_SS_ACCESS_TOKEN),
# and works identically against Fabric's SQL endpoint as it does Azure SQL.
#
# TARGET_DB = this app's own primary database (same as app.database's
# engine) — the only DB this job ever writes to. Same TARGET_DB shape as
# app.ecosystem_sync.connections, duplicated here to keep the two sync
# jobs independent (they pull from entirely unrelated sources).
import struct

import psycopg2
import pyodbc
from azure.identity import ClientSecretCredential

from app.config import settings

TARGET_DB = {
    "host": settings.DB_HOST,
    "port": settings.DB_PORT,
    "database": settings.DB_NAME,
    "user": settings.DB_USER,
    "password": settings.DB_PASSWORD,
}

# Fabric SQL endpoints (like Azure SQL) require a token scoped to
# database.windows.net — there is no separate Fabric-specific SQL scope.
_SQL_TOKEN_SCOPE = "https://database.windows.net/.default"
# pyodbc's documented connection attribute id for passing a raw AAD access
# token in place of a username/password.
_SQL_COPT_SS_ACCESS_TOKEN = 1256


def _get_fabric_access_token_struct() -> bytes:
    credential = ClientSecretCredential(
        tenant_id=settings.FABRIC_TENANT_ID,
        client_id=settings.FABRIC_CLIENT_ID,
        client_secret=settings.FABRIC_CLIENT_SECRET,
    )
    token = credential.get_token(_SQL_TOKEN_SCOPE).token
    token_bytes = token.encode("utf-16-le")
    return struct.pack(f"<I{len(token_bytes)}s", len(token_bytes), token_bytes)


def _connect(server: str, database: str):
    conn_str = (
        "Driver={ODBC Driver 18 for SQL Server};"
        f"Server={server},1433;"
        f"Database={database};"
        "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
    )
    token_struct = _get_fabric_access_token_struct()
    return pyodbc.connect(conn_str, attrs_before={_SQL_COPT_SS_ACCESS_TOKEN: token_struct})


def get_fabric_connection():
    """Open a read-only connection to the Customer lakehouse's SQL
    analytics endpoint. Raises if FABRIC_* settings are unset — callers
    should not silently no-op on a misconfigured environment."""
    if not all([settings.FABRIC_SQL_SERVER, settings.FABRIC_DATABASE,
                settings.FABRIC_CLIENT_ID, settings.FABRIC_TENANT_ID,
                settings.FABRIC_CLIENT_SECRET]):
        raise RuntimeError(
            "Fabric sync is not configured — set FABRIC_SQL_SERVER, "
            "FABRIC_DATABASE, FABRIC_CLIENT_ID, FABRIC_TENANT_ID and "
            "FABRIC_CLIENT_SECRET in .env"
        )
    return _connect(settings.FABRIC_SQL_SERVER, settings.FABRIC_DATABASE)


def get_fabric_erp_connection():
    """Open a read-only connection to the ERP lakehouse's SQL analytics
    endpoint (vendtable/dirpartytable/logisticspostaladdress/assettable) —
    same App Registration/service principal as the Customer lakehouse, just
    a different server + database. Raises if FABRIC_ERP_* settings are unset."""
    if not all([settings.FABRIC_ERP_SQL_SERVER, settings.FABRIC_ERP_DATABASE,
                settings.FABRIC_CLIENT_ID, settings.FABRIC_TENANT_ID,
                settings.FABRIC_CLIENT_SECRET]):
        raise RuntimeError(
            "Fabric ERP sync is not configured — set FABRIC_ERP_SQL_SERVER, "
            "FABRIC_ERP_DATABASE, FABRIC_CLIENT_ID, FABRIC_TENANT_ID and "
            "FABRIC_CLIENT_SECRET in .env"
        )
    return _connect(settings.FABRIC_ERP_SQL_SERVER, settings.FABRIC_ERP_DATABASE)


def get_target_connection():
    return psycopg2.connect(**TARGET_DB)
