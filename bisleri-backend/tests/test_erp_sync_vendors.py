# tests/test_erp_sync_vendors.py - the vendor pull skips vendors with no name
# instead of letting one of them reject the whole batch (27 Nov 2026).
import logging

from app.fabric_sync import erp_sync


class _Cur:
    def __init__(self, rows): self.rows = rows
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def execute(self, q): pass
    def fetchall(self): return self.rows


class _Conn:
    def __init__(self, rows): self.rows = rows
    def cursor(self): return _Cur(self.rows)


def test_nameless_vendor_is_skipped_not_fatal(caplog):
    rows = [("V1", "Vendor One", "Mumbai", "400001"),
            ("VWRG000138", None, None, None),          # no party record in the ERP
            ("V3", "   ", None, None),                 # blank name
            (None, "No Code Ltd", None, None),         # no code
            ("V5", "Vendor Five", None, None)]
    with caplog.at_level(logging.WARNING):
        valid, seen = erp_sync._fetch_vendors(_Conn(rows))
    assert [r[0] for r in valid] == ["V1", "V5"]
    assert all(len(r) == 7 and r[-1] is True for r in valid)       # code,name,city,post,contact,phone,active
    assert seen == ["V1", "VWRG000138", "V3", "V5"]                # nameless ones are still 'seen'
    assert "skipped 2 source row(s) with no name (VWRG000138, V3)" in caplog.text
    assert "1 with no code" in caplog.text


def test_all_vendors_fine_logs_nothing(caplog):
    with caplog.at_level(logging.WARNING):
        valid, seen = erp_sync._fetch_vendors(_Conn([("V1", "One", None, None)]))
    assert len(valid) == 1 and seen == ["V1"] and not caplog.records
