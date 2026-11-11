"""
Sample data for LOCAL development only.

Loads two things into the database named in bisleri-backend/.env:

  1. REFERENCE data  - gate pass departments (20), gate pass locations (28) and
                       cancel reasons (6). Real master values, needed by every
                       install. Idempotent (ON CONFLICT DO NOTHING).
  2. SAMPLE data     - fictional demo users, warehouses, vendors / customers /
                       items / assets, gate entries, raw-material entries and
                       gate passes in every status, so each screen has
                       something to show. Every sample row is fictional and
                       easy to spot: usernames start with "demo_", codes start
                       with "DEMO"/"DV"/"DC"/"DI"/"DFA".

Run (from the bisleri-backend folder):

    python scripts/seed_sample_data.py                  # reference data only
    python scripts/seed_sample_data.py --sample-data    # + demo data
    python scripts/seed_sample_data.py --sample-data --reset   # wipe demo rows, reload

Safety:
  * Refuses to run unless DB_HOST is localhost / 127.0.0.1 / ::1.
  * Refuses to add sample data if the database already holds users that are
    not "demo_*" (i.e. it looks like a real database) unless you pass
    --allow-existing-users.
  * --reset only deletes rows this script created.

All demo accounts use the password printed at the end (Sample@123).
"""
import argparse
import json
import os
import sys
from datetime import date, datetime, time, timedelta, timezone

import psycopg2
from psycopg2.extras import execute_values

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

IST = timezone(timedelta(hours=5, minutes=30))
SAMPLE_PASSWORD = "Sample@123"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}

# --------------------------------------------------------------------------
# REFERENCE DATA (real master values)
# --------------------------------------------------------------------------
DEPARTMENTS = [
    "Accounts", "Admin", "Chairman Office", "CSR", "Customer Care", "HR", "IT",
    "Legal", "Maintenance", "Management", "Marketing", "Procurement",
    "Production", "Project Development", "Public Relation", "Quality", "Sales",
    "Shipping", "Store", "Technical",
]
GATE_PASS_LOCATIONS = [
    ("AP", "ANDHRA PRADESH"), ("ASM", "ASSAM"), ("CGH", "CHHATTISGARH"),
    ("DEL", "DELHI"), ("GOA", "GOA"), ("GUJ", "GUJARAT"), ("GUW", "GUWAHATI"),
    ("GWP", "GUWAHATI"), ("HO", "HEAD OFFICE"), ("HP", "HIMACHAL PRADESH"),
    ("HRN", "HARYANA"), ("HYD", "TELANGANA"), ("JAI", "JAIPUR"),
    ("KAM", "Kamshet"), ("KAR", "KARNATAKA"), ("KEL", "KERALA"),
    ("LDH", "LUDHIANA"), ("MP", "MADHYA PRADESH"), ("MUM", "MUMBAI"),
    ("NAG", "NAGPUR"), ("NB", "WEST BENGAL"), ("OD", "ODISHA"),
    ("PB", "CHANDIGARH"), ("PRJ", "PRAYAGRAJ"), ("RDP", "RUDRAPUR"),
    ("ROM", "REST OF MAHARASHTRA"), ("SBD", "SAHIBABAD"), ("TN", "TAMILNADU"),
]
CANCEL_REASONS = [
    "Created by mistake / duplicate entry",
    "Wrong party selected",
    "Incorrect item or quantity details",
    "Vehicle or party did not arrive",
    "Movement no longer required",
    "Other (see remarks)",
]


def seed_reference_data(cur):
    execute_values(
        cur,
        "INSERT INTO gate_pass_departments (department_name, sort_order) VALUES %s "
        "ON CONFLICT (department_name) DO NOTHING",
        [(n, i + 1) for i, n in enumerate(DEPARTMENTS)],
    )
    execute_values(
        cur,
        "INSERT INTO gate_pass_locations (location_code, location_name) VALUES %s "
        "ON CONFLICT (location_code) DO NOTHING",
        GATE_PASS_LOCATIONS,
    )
    execute_values(
        cur,
        "INSERT INTO gate_pass_cancel_reasons (reason_text, is_active, sort_order) VALUES %s "
        "ON CONFLICT (reason_text) DO NOTHING",
        [(t, True, i + 1) for i, t in enumerate(CANCEL_REASONS)],
    )


# --------------------------------------------------------------------------
# SAMPLE DATA (fictional)
# --------------------------------------------------------------------------
WAREHOUSES = [
    # code, name, site_code, warehouse_id, gate pass location
    ("MUM-NAND", "Demo Warehouse Mumbai", "MUM", "WH-MUM-01", "MUM"),
    ("DEL-DLHI", "Demo Warehouse Delhi", "DEL", "WH-DEL-01", "DEL"),
    ("HYD-PASH", "Demo Warehouse Hyderabad", "HYD", "WH-HYD-01", "HYD"),
]

# username, first, last, role string, warehouse, dept, [(loc, is_default)], active
DEMO_USERS = [
    ("demo_itadmin", "Demo", "Admin", "IT Admin, Gate Pass Creator", None, "IT",
     [("HO", True), ("MUM", False)], True),
    ("demo_creator", "Demo", "Creator", "Gate Pass Creator", None, "Store",
     [("MUM", True), ("DEL", False)], True),
    ("demo_guard_mum", "Demo", "Guard Mumbai", "Security Guard", "MUM-NAND", None, [], True),
    ("demo_dispatcher", "Demo", "Dispatcher Mumbai", "Security Guard, Gate Pass Dispatcher",
     "MUM-NAND", None, [("MUM", True)], True),
    ("demo_guard_del", "Demo", "Guard Delhi", "Security Guard, Gate Pass Dispatcher",
     "DEL-DLHI", None, [("DEL", True)], True),
    ("demo_inactive", "Demo", "Deactivated", "Security Guard", "MUM-NAND", None, [], False),
]

VENDORS = [
    ("DV0001", "Demo Packaging Industries", "Mumbai", "400001", "9000000001", "Demo Contact 1"),
    ("DV0002", "Demo Machine Tools Pvt Ltd", "Pune", "411001", "9000000002", "Demo Contact 2"),
    ("DV0003", "Demo Electricals", "Thane", "400601", "9000000003", "Demo Contact 3"),
    ("DV0004", "Demo Calibration Services", "Delhi", "110001", "9000000004", "Demo Contact 4"),
    ("DV0005", "Demo Logistics Partner", "Hyderabad", "500001", "9000000005", "Demo Contact 5"),
]
CUSTOMERS = [
    ("DC0001", "Demo Distributor Mumbai", "Mumbai", "400002", "9100000001", "Demo Buyer 1"),
    ("DC0002", "Demo Distributor Delhi", "Delhi", "110002", "9100000002", "Demo Buyer 2"),
    ("DC0003", "Demo Retail Chain", "Pune", "411002", "9100000003", "Demo Buyer 3"),
    ("DC0004", "Demo Canteen Services", "Hyderabad", "500002", "9100000004", "Demo Buyer 4"),
]
ITEMS = [  # code (None = manual), name, source
    ("DI0001", "Demo PET Preform 20L", "FABRIC"),
    ("DI0002", "Demo Cap Closure", "FABRIC"),
    ("DI0003", "Demo Shrink Film Roll", "FABRIC"),
    ("DI0004", "Demo Spare Bearing", "FABRIC"),
    (None, "Demo Sample Carton", "MANUAL"),
    (None, "Demo Test Jar", "MANUAL"),
]
ASSETS = [
    ("DFA-0001", "Demo Laptop", "COMP"),
    ("DFA-0002", "Demo Hand Pallet Truck", "PLANT"),
    ("DFA-0003", "Demo Pressure Gauge", "INSTR"),
    ("DFA-0004", "Demo Water Dispenser", "FURN"),
    ("DFA-0005", "Demo Label Printer", "COMP"),
]


def fy_label(on):
    start = on.year if on.month >= 4 else on.year - 1
    return f"{start}-{str(start + 1)[-2:]}"


def _hash(password):
    from passlib.context import CryptContext  # same scheme the app uses
    return CryptContext(schemes=["bcrypt"], deprecated="auto").hash(password)


def _gate_entry_no(wh_code, idx):
    return f"{wh_code}{date.today().year}99{idx:04d}"


def _demo_gate_entries():
    """Deterministic list of demo gate entries (so --reset can find them)."""
    today = date.today()
    d = lambda n: today - timedelta(days=n)
    # (idx, wh, days_ago, vehicle, doc_type, sub_type, doc_no, qty, in_time, out_time,
    #  driver, km_in, km_out, loaders, interlayer)
    rows = [
        (1, "MUM-NAND", 6, "MH04AB1234", "Delivery Challan", "", "DEMO-DC-0001", 480, "08:10", "10:05", "Demo Driver A", "52110", "52168", "Demo Loader 1, Demo Loader 2", 12),
        (2, "MUM-NAND", 5, "MH43CD5678", "Invoice", "", "DEMO-INV-0001", 960, "09:20", "11:40", "Demo Driver B", "88001", "88043", "Demo Loader 1", 0),
        (3, "MUM-NAND", 4, "MH12JK7890", "Transfer Order", "STO", "DEMO-TO-0001", 1200, "07:45", "10:30", "Demo Driver C", "40320", "40411", "Demo Loader 2, Demo Loader 3", 20),
        (4, "MUM-NAND", 3, "MH04AB1234", "Delivery Challan", "", "DEMO-DC-0002", 520, "13:05", "15:00", "Demo Driver A", "52230", "52301", "Demo Loader 1, Demo Loader 2", 8),
        (5, "MUM-NAND", 2, "MH43CD5678", "Invoice", "", "DEMO-INV-0002", 720, "10:15", "12:20", "Demo Driver B", "88120", "88160", "Demo Loader 3", 0),
        (6, "MUM-NAND", 1, "MH12JK7890", "Delivery Challan", "", "DEMO-DC-0003", 600, "08:30", "10:45", "Demo Driver C", "40500", "40566", "Demo Loader 1, Demo Loader 3", 10),
        (7, "MUM-NAND", 0, "MH04AB1234", "Delivery Challan", "", "DEMO-DC-0004", 540, "08:55", None, None, None, None, None, 0),   # inside the gate right now
        (8, "DEL-DLHI", 3, "DL01EF9012", "Invoice", "", "DEMO-INV-0003", 840, "09:00", "11:10", "Demo Driver D", "70010", "70055", "Demo Loader 4", 0),
        (9, "DEL-DLHI", 1, "DL8CAB2211", "Transfer Order", "RGP", "DEMO-TO-0002", 300, "14:20", "16:05", "Demo Driver E", "15200", "15240", "Demo Loader 4, Demo Loader 5", 5),
        (10, "DEL-DLHI", 0, "DL01EF9012", "Delivery Challan", "", "DEMO-DC-0005", 660, "09:40", None, None, None, None, None, 0),  # inside right now
    ]
    out = []
    for r in rows:
        out.append(dict(
            idx=r[0], wh=r[1], day=d(r[2]), vehicle=r[3], doc_type=r[4], sub=r[5],
            doc_no=r[6], qty=r[7], t_in=r[8], t_out=r[9], driver=r[10], km_in=r[11],
            km_out=r[12], loaders=r[13], interlayer=r[14],
            gate_entry_no=_gate_entry_no(r[1], r[0]),
        ))
    return out


def _t(hhmm):
    h, m = hhmm.split(":")
    return time(int(h), int(m))


def remove_sample_data(cur):
    """Delete only the rows this script creates."""
    entries = _demo_gate_entries()
    nos = [e["gate_entry_no"] for e in entries]
    cur.execute("DELETE FROM insights_data WHERE gate_entry_no = ANY(%s)", (nos,))
    cur.execute("DELETE FROM raw_materials_data WHERE security_username LIKE 'demo\\_%'")
    cur.execute("DELETE FROM document_data WHERE document_no LIKE 'DEMO-%'")
    cur.execute("DELETE FROM gate_pass_headers WHERE created_by LIKE 'demo\\_%'")   # lines/events cascade
    cur.execute("DELETE FROM gate_pass_sequences WHERE location_code IN ('HO','MUM','DEL') AND fy_label = %s",
                (fy_label(date.today()),))
    cur.execute("DELETE FROM user_gate_pass_locations WHERE username LIKE 'demo\\_%'")
    cur.execute("DELETE FROM users_master WHERE username LIKE 'demo\\_%'")
    cur.execute("DELETE FROM gate_pass_vendors WHERE vendor_code LIKE 'DV%'")
    cur.execute("DELETE FROM gate_pass_customers WHERE customer_code LIKE 'DC%'")
    cur.execute("DELETE FROM gate_pass_assets WHERE asset_code LIKE 'DFA-%'")
    cur.execute("DELETE FROM gate_pass_items WHERE item_name LIKE 'Demo %'")
    cur.execute("DELETE FROM location_master WHERE warehouse_id LIKE 'WH-%-01'")


def seed_sample_data(cur, host, allow_existing_users=False, reset=False):
    if host not in LOCAL_HOSTS:
        raise SystemExit(f"Refusing to load sample data: DB_HOST is '{host}', not a local database.")

    cur.execute("SELECT count(*) FROM users_master WHERE username NOT LIKE 'demo\\_%'")
    real_users = cur.fetchone()[0]
    if real_users and not allow_existing_users:
        raise SystemExit(
            f"Refusing to load sample data: this database already has {real_users} non-demo user(s) "
            "and looks like a real database. Re-run with --allow-existing-users if you are sure."
        )

    if reset:
        remove_sample_data(cur)
    else:
        cur.execute("SELECT 1 FROM users_master WHERE username = 'demo_itadmin'")
        if cur.fetchone():
            print("Sample data is already loaded (use --reset to wipe and reload it).")
            return False

    today = date.today()
    now = datetime.now(IST)

    # ---- warehouses (location_master) + map gate pass locations to them ----
    execute_values(
        cur,
        "INSERT INTO location_master (warehouse_code, warehouse_name, site_code, warehouse_id) VALUES %s "
        "ON CONFLICT (warehouse_code) DO NOTHING",
        [(c, n, s, i) for c, n, s, i, _ in WAREHOUSES],
    )
    for code, _n, _s, _i, gp_loc in WAREHOUSES:
        cur.execute(
            "UPDATE gate_pass_locations SET warehouse_code = %s "
            "WHERE location_code = %s AND warehouse_code IS NULL", (code, gp_loc))

    # ---- users -------------------------------------------------------------
    pw = _hash(SAMPLE_PASSWORD)
    wh = {c: (n, s) for c, n, s, _i, _g in WAREHOUSES}
    for i, (uname, first, last, role, whc, dept, locs, active) in enumerate(DEMO_USERS):
        whn, site = wh.get(whc, (None, None))
        default_loc = next((l for l, is_def in locs if is_def), None)
        last_login = (now - timedelta(hours=i + 1)).replace(tzinfo=None) if active else None
        cur.execute(
            "INSERT INTO users_master (username, first_name, last_name, role, warehouse_code, "
            "warehouse_name, site_code, password, email, phone_number, last_login, department, "
            "gate_pass_location, is_active) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT (username) DO NOTHING",
            (uname, first, last, role, whc, whn, site, pw, f"{uname}@example.com",
             f"90000000{i:02d}", last_login, dept, default_loc, active))
        for loc, is_def in locs:
            cur.execute(
                "INSERT INTO user_gate_pass_locations (username, location_code, is_default) "
                "VALUES (%s,%s,%s) ON CONFLICT (username, location_code) DO NOTHING",
                (uname, loc, is_def))

    # ---- masters -----------------------------------------------------------
    execute_values(cur, "INSERT INTO gate_pass_vendors (vendor_code, vendor_name, city, post_code, "
                        "phone_no, contact, is_active) VALUES %s ON CONFLICT (vendor_code) DO NOTHING",
                   [v + (True,) for v in VENDORS])
    execute_values(cur, "INSERT INTO gate_pass_customers (customer_code, customer_name, city, post_code, "
                        "phone_no, contact, is_active) VALUES %s ON CONFLICT (customer_code) DO NOTHING",
                   [c + (True,) for c in CUSTOMERS])
    execute_values(cur, "INSERT INTO gate_pass_assets (asset_code, asset_name, fa_class_code, is_active) "
                        "VALUES %s ON CONFLICT (asset_code) DO NOTHING",
                   [a + (True,) for a in ASSETS])
    for code, name, source in ITEMS:
        cur.execute("SELECT 1 FROM gate_pass_items WHERE item_name = %s", (name,))
        if not cur.fetchone():
            cur.execute("INSERT INTO gate_pass_items (item_code, item_name, source, is_active) "
                        "VALUES (%s,%s,%s,true)", (code, name, source))
    cur.execute("SELECT item_name, item_id FROM gate_pass_items WHERE item_name LIKE 'Demo %'")
    item_ids = dict(cur.fetchall())

    # ---- gate entries (insights_data) + documents (document_data) ---------
    guards = {"MUM-NAND": ("demo_guard_mum", "Demo Guard Mumbai"),
              "DEL-DLHI": ("demo_guard_del", "Demo Guard Delhi")}
    for e in _demo_gate_entries():
        gu, gname = guards[e["wh"]]
        whn, site = wh[e["wh"]]
        base = dict(gate_entry_no=e["gate_entry_no"], document_type=e["doc_type"],
                    sub_document_type=e["sub"], document_no=e["doc_no"], vehicle_no=e["vehicle"],
                    warehouse_name=whn, date=datetime.combine(e["day"], time.min),
                    warehouse_code=e["wh"], site_code=site, security_name=gname,
                    security_username=gu, document_date=datetime.combine(e["day"], time.min))
        legs = [("Gate-In", e["t_in"], e["km_in"])]
        if e["t_out"]:
            legs.append(("Gate-Out", e["t_out"], e["km_out"]))
        for movement, hhmm, km in legs:
            cur.execute(
                "INSERT INTO insights_data (gate_entry_no, document_type, sub_document_type, document_no, "
                "vehicle_no, warehouse_name, date, time, movement_type, remarks, warehouse_code, site_code, "
                "security_name, security_username, document_date, driver_name, km_reading, loader_count, "
                "loader_names, interlayer_sheet_count, edit_count) "
                "VALUES (%(gate_entry_no)s,%(document_type)s,%(sub_document_type)s,%(document_no)s,%(vehicle_no)s,"
                "%(warehouse_name)s,%(date)s,%(time)s,%(movement_type)s,%(remarks)s,%(warehouse_code)s,%(site_code)s,"
                "%(security_name)s,%(security_username)s,%(document_date)s,%(driver_name)s,%(km_reading)s,"
                "%(loader_count)s,%(loader_names)s,%(interlayer)s,0)",
                dict(base, time=_t(hhmm), movement_type=movement,
                     remarks=f"Demo {movement.lower()} for {e['doc_no']}",
                     driver_name=e["driver"], km_reading=km,
                     loader_count=(len(e["loaders"].split(",")) if e["loaders"] else None),
                     loader_names=e["loaders"], interlayer=e["interlayer"] or 0))
        cur.execute(
            "INSERT INTO document_data (document_no, site, document_type, document_date, transporter_name, "
            "vehicle_no, warehouse_code, warehouse_name, customer_code, customer_name, total_quantity, "
            "gate_entry_no, sub_document_type) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT (document_no) DO NOTHING",
            (e["doc_no"], site, e["doc_type"], datetime.combine(e["day"], time.min), "Demo Transport Co",
             e["vehicle"], e["wh"], whn, "DC0001", "Demo Distributor Mumbai", str(e["qty"]),
             e["gate_entry_no"], e["sub"]))

    # documents waiting at the gate (no gate entry yet) - for the guard to pick up today
    pending = [
        ("DEMO-DC-0101", "Delivery Challan", "MUM-NAND", "MH04XY1001", 500),
        ("DEMO-INV-0101", "Invoice", "MUM-NAND", "MH04XY1002", 880),
        ("DEMO-TO-0101", "Transfer Order", "MUM-NAND", "MH04XY1003", 1100),
        ("DEMO-DC-0102", "Delivery Challan", "DEL-DLHI", "DL01XY2001", 640),
        ("DEMO-INV-0102", "Invoice", "DEL-DLHI", "DL01XY2002", 920),
    ]
    for doc_no, dtype, whc, veh, qty in pending:
        whn, site = wh[whc]
        cur.execute(
            "INSERT INTO document_data (document_no, site, document_type, document_date, transporter_name, "
            "vehicle_no, warehouse_code, warehouse_name, customer_code, customer_name, total_quantity) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (document_no) DO NOTHING",
            (doc_no, site, dtype, datetime.combine(today, time.min), "Demo Transport Co", veh, whc, whn,
             "DC0002", "Demo Distributor Delhi", str(qty)))

    # ---- raw materials -----------------------------------------------------
    rm = [
        ("Gate-In", "MH04RM1111", "DEMO-RM-0001", "Demo Packaging Industries", "PET Preform", "50000 NOS", 4, "09:05"),
        ("Gate-In", "MH43RM2222", "DEMO-RM-0002", "Demo Electricals", "Cable Drum", "12 NOS", 3, "11:30"),
        ("Gate-Out", "MH04RM1111", "DEMO-RM-0001", "Demo Packaging Industries", "Empty Pallets", "40 NOS", 4, "12:15"),
        ("Gate-In", "MH12RM3333", "DEMO-RM-0003", "Demo Machine Tools Pvt Ltd", "Spare Parts", "6 BOX", 2, "10:00"),
    ]
    for i, (gtype, veh, doc, party, mat, qty, days, hhmm) in enumerate(rm, start=1):
        cur.execute(
            "INSERT INTO raw_materials_data (gate_entry_no, gate_type, vehicle_no, document_no, name_of_party, "
            "description_of_material, quantity, date_time, security_name, security_username, warehouse_code, "
            "site_code, edit_count) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0)",
            (f"MUM-NAND{today.year}98{i:04d}", gtype, veh, doc, party, mat, qty,
             datetime.combine(today - timedelta(days=days), _t(hhmm)), "Demo Guard Mumbai",
             "demo_guard_mum", "MUM-NAND", "MUM"))

    # ---- gate passes -------------------------------------------------------
    cur.execute("SELECT id, location_code, warehouse_code FROM gate_pass_locations "
                "WHERE location_code IN ('HO','MUM','DEL')")
    loc_wh = {code: wcode for _id, code, wcode in cur.fetchall()}
    cur.execute("SELECT id FROM gate_pass_cancel_reasons WHERE reason_text = %s", (CANCEL_REASONS[3],))
    cancel_reason_id = cur.fetchone()[0]
    fy = fy_label(today)

    def stamp(days_ago, hhmm="10:00"):
        return datetime.combine(today - timedelta(days=days_ago), _t(hhmm), tzinfo=IST)

    # status, type, loc, party(type,code,name), dept, transport, vehicle, created_by, days_ago,
    # expected (days from today, R only), lines [(kind, ref, desc, uom, qty, received, chargeable, amount)], flow
    passes = [
        dict(type="R", loc="MUM", status="Open", party=("Vendor", "DV0004", "Demo Calibration Services"),
             dept="Quality", mode="Vehicle", veh="MH04GP0001", by="demo_creator", ago=0, exp=7,
             lines=[("Fixed Asset", "DFA-0003", "Demo Pressure Gauge - calibration", "NOS", 2, 0, "Non-chargeable", None)],
             flow=["CREATE"]),
        dict(type="R", loc="MUM", status="Released", party=("Vendor", "DV0002", "Demo Machine Tools Pvt Ltd"),
             dept="Maintenance", mode="Vehicle", veh="MH04GP0002", by="demo_creator", ago=1, exp=10,
             lines=[("Item", "Demo Spare Bearing", "Demo Spare Bearing - repair", "NOS", 4, 0, "Non-chargeable", None)],
             flow=["CREATE", "RELEASE"]),
        dict(type="R", loc="MUM", status="Dispatched", party=("Vendor", "DV0003", "Demo Electricals"),
             dept="IT", mode="Hand Delivery", veh=None, by="demo_itadmin", ago=4, exp=5,
             lines=[("Fixed Asset", "DFA-0001", "Demo Laptop - repair", "NOS", 1, 0, "Non-chargeable", None)],
             flow=["CREATE", "RELEASE", "DISPATCH"]),
        dict(type="R", loc="MUM", status="Dispatched", party=("Vendor", "DV0002", "Demo Machine Tools Pvt Ltd"),
             dept="Production", mode="Vehicle", veh="MH04GP0003", by="demo_creator", ago=12, exp=-3,   # OVERDUE
             lines=[("Fixed Asset", "DFA-0002", "Demo Hand Pallet Truck - service", "NOS", 3, 0, "Non-chargeable", None)],
             flow=["CREATE", "RELEASE", "DISPATCH"]),
        dict(type="R", loc="MUM", status="Partially Received", party=("Vendor", "DV0001", "Demo Packaging Industries"),
             dept="Store", mode="Vehicle", veh="MH04GP0004", by="demo_creator", ago=9, exp=2,
             lines=[("Item", "Demo Cap Closure", "Demo Cap Closure - rework", "NOS", 10, 4, "Non-chargeable", None),
                    ("Item", "Demo Shrink Film Roll", "Demo Shrink Film Roll - rework", "ROLL", 5, 5, "Non-chargeable", None)],
             flow=["CREATE", "RELEASE", "DISPATCH", "INWARD"]),
        dict(type="R", loc="MUM", status="Inward Received", party=("Customer", "DC0001", "Demo Distributor Mumbai"),
             dept="Sales", mode="Vehicle", veh="MH04GP0005", by="demo_creator", ago=15, exp=-8,
             lines=[("Item", "Demo Sample Carton", "Demo Sample Carton - display", "NOS", 6, 6, "Non-chargeable", None)],
             flow=["CREATE", "RELEASE", "DISPATCH", "INWARD"]),
        dict(type="NR", loc="MUM", status="Dispatched", party=("Customer", "DC0003", "Demo Retail Chain"),
             dept="Marketing", mode="Vehicle", veh="MH04GP0006", by="demo_creator", ago=3, exp=None,
             lines=[("Item", "Demo Test Jar", "Demo Test Jar - free samples", "BOX", 20, 0, "Chargeable", 1500)],
             flow=["CREATE", "RELEASE", "DISPATCH"]),
        dict(type="R", loc="MUM", status="Cancelled", party=("Vendor", "DV0005", "Demo Logistics Partner"),
             dept="Shipping", mode="Vehicle", veh="MH04GP0007", by="demo_creator", ago=6, exp=4,
             lines=[("Fixed Asset", "DFA-0004", "Demo Water Dispenser - move", "NOS", 1, 0, "Non-chargeable", None)],
             flow=["CREATE", "CANCEL"]),
        dict(type="NR", loc="DEL", status="Released", party=("Customer", "DC0002", "Demo Distributor Delhi"),
             dept="Sales", mode="Vehicle", veh="DL01GP0001", by="demo_creator", ago=0, exp=None,
             lines=[("Item", "Demo Sample Carton", "Demo Sample Carton - delivery", "NOS", 12, 0, "Chargeable", 900)],
             flow=["CREATE", "RELEASE"]),
        dict(type="R", loc="HO", status="Open", party=("Vendor", "DV0003", "Demo Electricals"),
             dept="IT", mode="Hand Delivery", veh=None, by="demo_itadmin", ago=0, exp=5,
             lines=[("Fixed Asset", "DFA-0005", "Demo Label Printer - repair", "NOS", 1, 0, "Non-chargeable", None)],
             flow=["CREATE"]),
    ]
    counters = {}
    guard_for = {"MUM": "demo_dispatcher", "DEL": "demo_guard_del", "HO": "demo_dispatcher"}
    for p in passes:
        key = (p["loc"], p["type"])
        counters[key] = counters.get(key, 0) + 1
        gp_no = f"{p['type']}-{p['loc']}-{fy}-{counters[key]:06d}"
        created = stamp(p["ago"], "10:00")
        pty, pcode, pname = p["party"]
        expected = (today + timedelta(days=p["exp"])) if p["exp"] is not None else None
        cur.execute(
            "INSERT INTO gate_pass_headers (gate_pass_no, pass_type, status, location_code, warehouse_code, "
            "document_date, document_time, party_type, party_code, party_name, department, mode_of_transport, "
            "vehicle_no, sender_name, approver_name, expected_inward_date, remarks, created_by, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (gp_no, p["type"], p["status"], p["loc"], loc_wh.get(p["loc"]), created.date(),
             created.strftime("%H:%M:%S"), pty, pcode, pname, p["dept"], p["mode"], p["veh"],
             "Demo Sender", "Demo Approver", expected, "Demo gate pass (sample data)", p["by"], created))
        gp_id = cur.fetchone()[0]

        line_ids = []
        for n, (kind, ref, desc, uom, qty, recv, charge, amount) in enumerate(p["lines"], start=1):
            asset = ref if kind == "Fixed Asset" else None
            item = item_ids.get(ref) if kind == "Item" else None
            cur.execute(
                "INSERT INTO gate_pass_lines (gate_pass_id, line_no, item_type, asset_code, item_id, description, "
                "uom, quantity, amount, chargeable, received_qty) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                "RETURNING id", (gp_id, n, kind, asset, item, desc, uom, qty, amount, charge, recv))
            line_ids.append((n, desc, qty, recv))

        dispatcher = guard_for.get(p["loc"], "demo_dispatcher")
        step = 0
        upd = {}
        for ev in p["flow"]:
            step += 1
            at = created + timedelta(hours=step)
            by, remarks, details = p["by"], None, None
            if ev == "RELEASE":
                upd.update(released_by=p["by"], released_at=at)
            elif ev == "DISPATCH":
                by, remarks = dispatcher, "Demo dispatch at gate"
                upd.update(dispatched_by=dispatcher, dispatched_at=at, dispatch_remarks=remarks)
            elif ev == "INWARD":
                by, remarks = dispatcher, "Demo inward receipt"
                receipts = [{"line_no": n, "description": d, "received_qty": r, "total_received": r, "of_quantity": q}
                            for n, d, q, r in line_ids if r]
                details = {"receipts": receipts}
                upd.update(last_inward_at=at)
                if p["status"] == "Inward Received":
                    upd.update(completed_at=at)
            elif ev == "CANCEL":
                remarks = "Demo cancellation"
                upd.update(cancelled_by=p["by"], cancelled_at=at, cancel_reason_id=cancel_reason_id,
                           cancel_remarks=remarks)
            cur.execute(
                "INSERT INTO gate_pass_events (gate_pass_id, event_type, event_by, event_at, remarks, details_json) "
                "VALUES (%s,%s,%s,%s,%s,%s)",
                (gp_id, ev, by, at, remarks, json.dumps(details) if details else None))
        if upd:
            sets = ", ".join(f"{k} = %s" for k in upd)
            cur.execute(f"UPDATE gate_pass_headers SET {sets} WHERE id = %s", (*upd.values(), gp_id))

    for (loc, ptype), last in counters.items():
        cur.execute(
            "INSERT INTO gate_pass_sequences (location_code, pass_type, fy_label, last_number) VALUES (%s,%s,%s,%s) "
            "ON CONFLICT (location_code, pass_type, fy_label) DO UPDATE SET last_number = GREATEST("
            "gate_pass_sequences.last_number, EXCLUDED.last_number)", (loc, ptype, fy, last))
    return True


def print_logins():
    print()
    print("Sample logins  (password for all: %s)" % SAMPLE_PASSWORD)
    print("  %-17s %-38s %s" % ("username", "role", "use it to"))
    rows = [
        ("demo_itadmin", "IT Admin + Gate Pass Creator", "manage users, create passes (HO/MUM)"),
        ("demo_creator", "Gate Pass Creator", "create passes (MUM/DEL)"),
        ("demo_guard_mum", "Security Guard (Mumbai)", "gate entries at MUM-NAND"),
        ("demo_dispatcher", "Security Guard + Dispatcher (MUM)", "dispatch / receive passes"),
        ("demo_guard_del", "Security Guard + Dispatcher (DEL)", "gate entries + passes at DEL"),
        ("demo_inactive", "Security Guard (deactivated)", "test Reactivate / Delete user"),
    ]
    for u, r, w in rows:
        print("  %-17s %-38s %s" % (u, r, w))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sample-data", action="store_true", help="also load the fictional demo data")
    ap.add_argument("--reset", action="store_true", help="delete the demo rows first, then reload them")
    ap.add_argument("--allow-existing-users", action="store_true",
                    help="load demo data even though non-demo users already exist")
    args = ap.parse_args()

    from app.config import settings
    if (args.sample_data or args.reset) and settings.DB_HOST not in LOCAL_HOSTS:
        raise SystemExit(f"Refusing to load sample data: DB_HOST is '{settings.DB_HOST}', not a local database.")
    conn = psycopg2.connect(host=settings.DB_HOST, port=settings.DB_PORT, user=settings.DB_USER,
                            password=settings.DB_PASSWORD, dbname=settings.DB_NAME)
    try:
        with conn, conn.cursor() as cur:
            seed_reference_data(cur)
            print("Reference data ready (departments, gate pass locations, cancel reasons).")
            if args.sample_data or args.reset:
                if seed_sample_data(cur, settings.DB_HOST, args.allow_existing_users, args.reset):
                    print("Sample data loaded.")
                    print_logins()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
