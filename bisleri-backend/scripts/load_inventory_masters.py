"""
Load the Blinkit Inventory Portal masters into bisleri_ecosystem (26 Nov 2026).

  --items  FG_Item_Master.xlsx   -> item_master (upsert on item_number)
  --stores Blinkit_Stores.xlsx   -> blinkit_stores (upsert on store_code)

Needs migration c4e8a1f7d2b9 (alembic upgrade head) first. Safe to run again:
existing rows are updated, nothing is deleted. Use --dry-run to only check the
files and print what would happen.

Item Excel columns (first sheet, row 1 = headers, as in FG_Item_Master.xlsx):
  Item number | Product name | Search name | Product type | Product subtype |
  Product service type | Product dimension groups | Product lifecycle state |
  Packing group | Item group
Store Excel columns: Store Code | Store Name   (create a blank one with
  --stores-template Blinkit_Stores.xlsx)

Run from the bisleri-backend folder:
    python scripts/load_inventory_masters.py --items "C:\\path\\FG_Item_Master.xlsx" --dry-run
    python scripts/load_inventory_masters.py --items FG_Item_Master.xlsx --stores Blinkit_Stores.xlsx
"""
import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

# Excel header (normalised) -> item_master column, max length
ITEM_COLUMNS = {
    "itemnumber": ("item_number", 255),
    "productname": ("product_name", 255),
    "searchname": ("search_name", 255),
    "producttype": ("product_type", 255),
    "productsubtype": ("product_subtype", 255),
    "productservicetype": ("product_service_type", 100),
    "productdimensiongroups": ("product_dimension_group", 50),
    "productdimensiongroup": ("product_dimension_group", 50),
    "productlifecyclestate": ("product_lifecycle_state", 50),
    "packinggroup": ("packing_group", 100),
    "itemgroup": ("item_group", 20),
}
STORE_COLUMNS = {
    "storecode": ("store_code", 50),
    "storename": ("store_name", 255),
}


def _norm(h):
    return re.sub(r"[^a-z]", "", str(h or "").lower())


def _cell(v):
    if v is None:
        return None
    s = str(v).strip()          # kept exactly as in the Excel (no space squeezing)
    return s or None


def read_sheet(path, mapping, key):
    from openpyxl import load_workbook
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = next(rows, None) or []
    idx = {}
    for i, h in enumerate(header):
        m = mapping.get(_norm(h))
        if m and m[0] not in idx:
            idx[m[0]] = (i, m[1])
    if key not in idx:
        raise SystemExit(f"{os.path.basename(path)}: no '{key.replace('_', ' ').title()}' column found in row 1.")
    out, problems, seen = [], [], {}
    for rnum, r in enumerate(rows, start=2):
        if not r or all(v is None or str(v).strip() == "" for v in r):
            continue
        rec = {}
        for col, (i, maxlen) in idx.items():
            v = _cell(r[i]) if i < len(r) else None
            if v and len(v) > maxlen:
                problems.append(f"row {rnum}: {col} longer than {maxlen} characters — cut")
                v = v[:maxlen]
            rec[col] = v
        k = rec.get(key)
        if not k:
            problems.append(f"row {rnum}: {key} is empty — skipped")
            continue
        if key == "store_code":
            k = rec[key] = k.upper()
        if k in seen:
            problems.append(f"row {rnum}: {key} '{k}' repeats row {seen[k]} — the later row wins")
            out = [x for x in out if x[key] != k]
        seen[k] = rnum
        out.append(rec)
    return out, problems, sorted(idx)


def upsert(cur, table, key, recs, cols):
    from psycopg2.extras import execute_values
    sets = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != key)
    cur.execute(f"SELECT {key} FROM {table}")
    existing = {r[0] for r in cur.fetchall()}
    execute_values(
        cur,
        f"INSERT INTO {table} ({', '.join(cols)}) VALUES %s ON CONFLICT ({key}) DO UPDATE SET {sets}",
        [tuple(r.get(c) for c in cols) for r in recs],
    )
    new = sum(1 for r in recs if r[key] not in existing)
    return new, len(recs) - new


def stores_template(path):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    wb = Workbook(); ws = wb.active; ws.title = "Blinkit Stores"
    ws.append(["Store Code", "Store Name"])
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="0F6B46")
    ws.column_dimensions["A"].width = 18; ws.column_dimensions["B"].width = 40
    wb.save(path)
    print(f"Blank store template written: {path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--items", help="FG_Item_Master.xlsx")
    ap.add_argument("--stores", help="Blinkit stores Excel (Store Code, Store Name)")
    ap.add_argument("--dry-run", action="store_true", help="check the files only, change nothing")
    ap.add_argument("--stores-template", metavar="FILE", help="write a blank stores Excel and stop")
    args = ap.parse_args()
    if args.stores_template:
        stores_template(args.stores_template)
        return
    if not args.items and not args.stores:
        ap.error("give --items and/or --stores")

    jobs = []
    if args.items:
        recs, probs, cols = read_sheet(args.items, ITEM_COLUMNS, "item_number")
        jobs.append(("item_master", "item_number", recs, probs, cols, args.items))
    if args.stores:
        recs, probs, cols = read_sheet(args.stores, STORE_COLUMNS, "store_code")
        jobs.append(("blinkit_stores", "store_code", recs, probs, cols, args.stores))

    for table, key, recs, probs, cols, path in jobs:
        print(f"{os.path.basename(path)}: {len(recs)} row(s) for {table} (columns: {', '.join(cols)})")
        for p in probs[:50]:
            print(f"  ! {p}")
        if len(probs) > 50:
            print(f"  ... and {len(probs) - 50} more")
    if args.dry_run:
        print("Dry run — nothing written.")
        return

    import psycopg2
    from app.config import settings
    conn = psycopg2.connect(host=settings.DB_HOST, port=settings.DB_PORT, user=settings.DB_USER,
                            password=settings.DB_PASSWORD, dbname=settings.DB_NAME)
    try:
        with conn, conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.blinkit_stores') IS NOT NULL")
            if not cur.fetchone()[0]:
                raise SystemExit("blinkit_stores does not exist — run 'alembic upgrade head' first.")
            for table, key, recs, _, cols, _ in jobs:
                if not recs:
                    continue
                new, upd = upsert(cur, table, key, recs, cols)
                print(f"{table}: {new} added, {upd} updated.")
        print("Done.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
