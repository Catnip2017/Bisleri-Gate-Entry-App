"""
One-off AD/LDAPS connectivity test — NOT part of the app's login flow.

What it does:
  1. Connects to the AD server over LDAPS (port 636) using AD_* values from .env
  2. Binds as the service account (proves the credentials + network path work)
  3. Reads RootDSE to auto-discover the Base DN (defaultNamingContext)
  4. Prints the TLS certificate the server presented (so we can confirm it's the
     right one with the client and decide how to trust it)
  5. Searches for a few sample users and prints mail vs. userPrincipalName side
     by side, so we can confirm whether they always match

Run:
    python scripts/test_ad_connection.py
    python scripts/test_ad_connection.py --sample-user heet.dinkar

Nothing here is written back to the app or the database. Safe to run repeatedly.
"""

import argparse
import os
import ssl
import sys

from dotenv import load_dotenv
from ldap3 import ALL, SIMPLE, SUBTREE, Connection, Server, Tls

load_dotenv()

AD_SERVER = os.getenv("AD_SERVER")
AD_PORT = int(os.getenv("AD_PORT", "636"))
AD_USE_SSL = os.getenv("AD_USE_SSL", "true").lower() == "true"
AD_BIND_USER = os.getenv("AD_BIND_USER")
AD_BIND_PASSWORD = os.getenv("AD_BIND_PASSWORD")


def require_env():
    missing = [
        name
        for name, val in [
            ("AD_SERVER", AD_SERVER),
            ("AD_BIND_USER", AD_BIND_USER),
            ("AD_BIND_PASSWORD", AD_BIND_PASSWORD),
        ]
        if not val
    ]
    if missing:
        print(f"Missing required .env values: {', '.join(missing)}")
        sys.exit(1)


def print_server_certificate():
    print("\n--- TLS certificate presented by the server ---")
    try:
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".pem", delete=False) as f:
            f.write(ssl.get_server_certificate((AD_SERVER, AD_PORT)).encode())
            path = f.name
        cert = ssl._ssl._test_decode_cert(path)  # noqa: SLF001
        print(f"  Subject : {cert.get('subject')}")
        print(f"  Issuer  : {cert.get('issuer')}")
        print(f"  Valid   : {cert.get('notBefore')} -> {cert.get('notAfter')}")
        self_signed = cert.get("subject") == cert.get("issuer")
        print(f"  Self-signed: {self_signed}")
        if self_signed:
            print("  -> This looks self-signed or from an internal CA.")
            print("     We'll need the client to confirm this is expected, and")
            print("     either trust this exact cert or get the internal CA cert.")
    except Exception as e:
        print(f"  Could not retrieve/parse certificate: {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--sample-user",
        action="append",
        default=[],
        help="sAMAccountName (logon name) to look up, e.g. heet.dinkar. Can be passed multiple times.",
    )
    args = parser.parse_args()

    require_env()
    print_server_certificate()

    tls = Tls(validate=ssl.CERT_NONE)  # CERT_NONE for this diagnostic run only — see note below
    server = Server(AD_SERVER, port=AD_PORT, use_ssl=AD_USE_SSL, get_info=ALL, tls=tls)

    print(f"\n--- Binding as service account: {AD_BIND_USER} ---")
    conn = Connection(
        server,
        user=AD_BIND_USER,
        password=AD_BIND_PASSWORD,
        authentication=SIMPLE,
        auto_bind=False,
    )
    if not conn.bind():
        print(f"BIND FAILED: {conn.result}")
        sys.exit(1)
    print("Bind succeeded.")

    base_dn = server.info.other.get("defaultNamingContext", [None])[0]
    print(f"\n--- Auto-discovered Base DN ---\n  {base_dn}")

    if args.sample_user:
        print("\n--- Sample user lookup (mail vs userPrincipalName) ---")
        for logon_name in args.sample_user:
            search_filter = f"(sAMAccountName={logon_name})"
            conn.search(
                search_base=base_dn,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=["mail", "userPrincipalName", "sAMAccountName", "userAccountControl"],
            )
            if not conn.entries:
                print(f"  {logon_name}: NOT FOUND")
                continue
            entry = conn.entries[0]
            mail = str(entry.mail) if "mail" in entry else "(none)"
            upn = str(entry.userPrincipalName) if "userPrincipalName" in entry else "(none)"
            match = "MATCH" if mail.lower() == upn.lower() else "MISMATCH"
            print(f"  {logon_name}: mail={mail}  upn={upn}  [{match}]")

    conn.unbind()
    print("\nDone.")


if __name__ == "__main__":
    main()
