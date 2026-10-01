# app/reports/gate_pass_excel.py — builds the downloadable .xlsx for the
# Gate Pass "Reports" tab (added 1 Oct 2026, revised 1 Oct 2026).
#
# Design notes (locked in across the Oct 2026 design review):
#  - Creator workbook: 2 sheets — Summary, Register. Register is merged with
#    Line Items (one row per line item; pass-level fields repeat per line,
#    alternating row bands per pass for visual grouping). Merged cells were
#    considered and rejected: Excel Tables and AutoFilter both break on
#    merged cells, and "pre-built filters, no manual setup" was an explicit
#    requirement.
#  - Dispatcher workbook: 2 sheets — Summary (overall totals + Department
#    Summary table stacked on the same sheet), Detail (merged with Line
#    Items, same one-row-per-line-item approach as Register).
#  - Every Register/Detail/Department-Summary range is a real openpyxl
#    Table (filter dropdowns + banding built in, nothing for the user to
#    set up).
#  - All values are static (no formulas) — this is a point-in-time export
#    of already-aggregated data from the DB; the aggregation happened in
#    Python (gate_pass_reports.py), not in Excel.
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

FONT_NAME = "Arial"
HEADER_FILL = PatternFill("solid", fgColor="1F4E78")
HEADER_FONT = Font(name=FONT_NAME, size=10, bold=True, color="FFFFFF")
TITLE_FONT = Font(name=FONT_NAME, size=14, bold=True, color="1F4E78")
SUBTITLE_FONT = Font(name=FONT_NAME, size=10, italic=True, color="595959")
NOTE_FONT = Font(name=FONT_NAME, size=9, italic=True, color="7F7F7F")
BODY_FONT = Font(name=FONT_NAME, size=10)
THIN = Side(style="thin", color="D9D9D9")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
BAND_A = PatternFill("solid", fgColor="FFFFFF")
BAND_B = PatternFill("solid", fgColor="EDF2F7")

TABLE_STYLE = TableStyleInfo(
    name="TableStyleMedium2", showFirstColumn=False, showLastColumn=False,
    showRowStripes=False, showColumnStripes=False,   # we hand-band by pass instead
)


def _title_block(ws, span, title, subtitle, filters_line=None):
    ws.merge_cells(f"A1:{span}1")
    ws["A1"] = title
    ws["A1"].font = TITLE_FONT
    ws.merge_cells(f"A2:{span}2")
    ws["A2"] = subtitle
    ws["A2"].font = SUBTITLE_FONT
    next_row = 3
    if filters_line:
        ws.merge_cells(f"A3:{span}3")
        ws["A3"] = filters_line
        ws["A3"].font = NOTE_FONT
        next_row = 4
    return next_row


def _write_banded_table(ws, headers, rows, start_row, col_widths, table_name,
                         date_cols=(), currency_cols=()):
    """Writes a header row + data rows (one dict per row), shading each
    pass's line-item rows as a band (alternating white / light blue-gray
    based on row['is_first_line']), and registers a real Table object so
    every column has a working filter dropdown out of the box. Returns the
    last data row number."""
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(row=start_row, column=c, value=h)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[start_row].height = 30

    r = start_row + 1
    band_toggle = False
    for row_dict, col_keys in rows:
        if row_dict.get("is_first_line", True):
            band_toggle = not band_toggle
        band_fill = BAND_B if band_toggle else BAND_A
        for c, key in enumerate(col_keys, start=1):
            val = row_dict.get(key)
            cell = ws.cell(row=r, column=c, value=val)
            cell.font = BODY_FONT
            cell.border = BORDER
            cell.fill = band_fill
            if c in date_cols and val is not None:
                cell.number_format = "dd-mmm-yyyy"
            if c in currency_cols:
                cell.number_format = "#,##0.00;(#,##0.00);-"
        r += 1
    last_row = max(r - 1, start_row + 1)
    if r - 1 < start_row + 1:
        for c in range(1, len(headers) + 1):
            ws.cell(row=start_row + 1, column=c)
        last_row = start_row + 1

    for i, w in enumerate(col_widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(row=start_row + 1, column=1).coordinate

    last_col = get_column_letter(len(headers))
    tbl = Table(displayName=table_name, ref=f"A{start_row}:{last_col}{last_row}")
    tbl.tableStyleInfo = TABLE_STYLE
    ws.add_table(tbl)
    return last_row


def _summary_rows(ws, pairs, start_row):
    r = start_row
    for label, value, is_currency in pairs:
        if label == "":
            r += 1
            continue
        lc = ws.cell(row=r, column=1, value=label)
        lc.font = BODY_FONT
        vc = ws.cell(row=r, column=2, value=value)
        vc.font = Font(name=FONT_NAME, size=10, bold=True)
        vc.alignment = Alignment(horizontal="center")
        if is_currency:
            vc.number_format = "₹#,##0;(₹#,##0);-"
        r += 1
    ws.column_dimensions["A"].width = 56
    ws.column_dimensions["B"].width = 16
    return r


def _dash_if_none(v):
    return v if v is not None else "-"


# ── Creator / IT Admin — FY Register ─────────────────────────────────────
CREATOR_HEADERS = [
    "Gate Pass No.", "Pass Type", "Status", "Location", "Vendor/Customer",
    "Created By", "Gate Pass Created Date", "Dispatched Date", "Expected Return Date",
    "Actual Return Date", "Days Outstanding", "Line No.", "Item Type",
    "Asset No. / Item Code", "Description", "Serial No.", "UOM", "Qty", "Amount",
    "Chargeable?", "Cancelled By / Reason", "Remarks",
]
CREATOR_KEYS = [
    "gate_pass_no", "pass_type", "status", "location_code", "party_name",
    "created_by", "gate_pass_created_date", "dispatched_at", "expected_return_date",
    "actual_return_date", "_days_outstanding_display", "line_no", "item_type",
    "item_code", "description", "serial_no", "uom", "quantity", "line_amount",
    "_chargeable_display", "cancel_info", "remarks",
]
CREATOR_COL_WIDTHS = [18, 9, 16, 9, 22, 15, 15, 13, 14, 13, 12, 7, 11, 19, 28, 11, 7, 6, 10, 10, 26, 28]


def build_creator_workbook(fy_label: str, department: str | None, summary: dict,
                            flat_rows: list, generated_note: str, filters_desc: str) -> io.BytesIO:
    wb = Workbook()

    sm = wb.active
    sm.title = "Summary"
    dept_label = department or "All Departments"
    next_row = _title_block(
        sm, "B", f"Gate Pass Creator / IT Admin — FY {fy_label} Summary",
        f"Department: {dept_label}   |   {generated_note}",
    )
    sc = summary["status_counts"]
    pairs = [
        ("Total Gate Passes Raised", summary["total_passes"], False),
        ("Returnable (R) Passes", summary["returnable_count"], False),
        ("Non-Returnable (NR) Passes", summary["non_returnable_count"], False),
        ("", "", False),
        ("Status — Open", sc.get("Open", 0), False),
        ("Status — Released", sc.get("Released", 0), False),
        ("Status — Dispatched", sc.get("Dispatched", 0), False),
        ("Status — Partially Received", sc.get("Partially Received", 0), False),
        ("Status — Inward Received", sc.get("Inward Received", 0), False),
        ("Status — Cancelled", sc.get("Cancelled", 0), False),
        ("Status — Closed Without Return", sc.get("Closed Without Return", 0), False),
        ("", "", False),
        ("R Passes Pending Return (dispatched, not yet received)", summary["pending_return_count"], False),
        ("...of which Overdue (past Expected Return Date)", summary["overdue_count"], False),
        ("Total Amount — Chargeable lines (₹)", summary["total_chargeable_amount"], True),
    ]
    _summary_rows(sm, pairs, next_row)

    reg = wb.create_sheet("Register")
    hdr_next = _title_block(
        reg, "V", f"Gate Pass Creator / IT Admin — FY {fy_label} Register",
        f"Department: {dept_label}   |   {generated_note}", filters_desc,
    )
    reg.merge_cells(f"A{hdr_next}:V{hdr_next}")
    reg.cell(row=hdr_next, column=1,
             value=("One row per line item — a pass with 3 items shows 3 rows, with pass-level "
                    "columns repeated so every column stays filterable. Shaded bands group each "
                    "pass's rows visually.")).font = NOTE_FONT
    table_start = hdr_next + 1

    prepared = []
    for r in flat_rows:
        rr = dict(r)
        rr["_days_outstanding_display"] = _dash_if_none(r.get("days_outstanding"))
        rr["_chargeable_display"] = "Yes" if r.get("line_chargeable") else "No"
        prepared.append((rr, CREATOR_KEYS))

    last_row = _write_banded_table(
        reg, CREATOR_HEADERS, prepared, table_start, CREATOR_COL_WIDTHS, "CreatorRegister",
        date_cols=(7, 8, 9, 10), currency_cols=(19,),
    )

    note_row = last_row + 2
    reg.cell(row=note_row, column=1,
             value=("Note: Expected/Actual Return Date are blank for Non-Returnable (NR) passes. "
                    "Days Outstanding is blank ('-') once a pass is received, cancelled, or not yet "
                    "dispatched.")).font = NOTE_FONT
    reg.merge_cells(f"A{note_row}:V{note_row}")

    wb.active = 0
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


# ── Dispatcher / Security Guard — FY Item Reconciliation ─────────────────
DISPATCHER_HEADERS = [
    "Department", "Gate Pass Type", "Gate Pass No.", "Status", "Vendor/Customer",
    "Dispatch Date", "Expected Return Date", "Actual Return Date", "Days Outstanding",
    "Item Code / Asset No.", "Description of Goods", "Qty Sent", "Unit",
    "Qty Returned", "Reconciliation Status", "Remarks",
]
DISPATCHER_KEYS = [
    "department", "pass_type", "gate_pass_no", "status", "party_name",
    "dispatch_date", "expected_return_date", "actual_return_date", "_days_outstanding_display",
    "item_code", "description", "qty_sent", "unit", "qty_returned",
    "reconciliation_status", "remarks",
]
DISPATCHER_COL_WIDTHS = [13, 13, 19, 17, 24, 13, 15, 14, 13, 19, 30, 9, 7, 11, 20, 32]

DEPT_SUMMARY_HEADERS = [
    "Department", "Total Lines Sent", "Total Qty Sent", "Lines Fully Returned",
    "Lines Partially Returned", "Lines Pending", "NR Lines (outbound only)",
    "Oldest Pending (days)", "Overdue Lines (R, pending, past due date)",
]
DEPT_SUMMARY_COL_WIDTHS = [14, 14, 13, 16, 18, 12, 18, 16, 24]


def build_dispatcher_workbook(fy_label: str, summary: dict, flat_rows: list,
                               dept_summary: list, generated_note: str, filters_desc: str) -> io.BytesIO:
    wb = Workbook()

    sm = wb.active
    sm.title = "Summary"
    next_row = _title_block(
        sm, "I", f"Gate Pass Dispatcher / Security — FY {fy_label} Item Reconciliation Summary",
        generated_note, filters_desc,
    )
    pairs = [
        ("Total Gate Passes Dispatched", summary.get("total_passes", summary.get("total_lines", 0)), False),
        ("Total Qty Sent (all passes)", summary["total_qty_sent"], False),
        ("Departments Covered", summary["departments"], False),
        ("", "", False),
        ("Lines Pending Return", summary["pending_lines"], False),
        ("...of which Overdue (past Expected Return Date)", summary["overdue_lines"], False),
    ]
    next_row = _summary_rows(sm, pairs, next_row)

    dept_title_row = next_row + 1
    sm.merge_cells(f"A{dept_title_row}:I{dept_title_row}")
    sm.cell(row=dept_title_row, column=1,
            value="Department-wise Item Reconciliation Summary").font = Font(
        name=FONT_NAME, size=12, bold=True, color="1F4E78")

    dp_header_row = dept_title_row + 1
    for c, h in enumerate(DEPT_SUMMARY_HEADERS, start=1):
        cell = sm.cell(row=dp_header_row, column=c, value=h)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
    sm.row_dimensions[dp_header_row].height = 30

    dr = dp_header_row + 1
    for d in dept_summary:
        values = [
            d["department"], d["total_lines"], d["total_qty_sent"], d["lines_fully_returned"],
            d["lines_partially_returned"], d["lines_pending"], d["nr_lines"],
            _dash_if_none(d["oldest_pending_days"]), d["overdue_lines"],
        ]
        for c, v in enumerate(values, start=1):
            cell = sm.cell(row=dr, column=c, value=v)
            cell.font = BODY_FONT
            cell.border = BORDER
        dr += 1
    dp_last = max(dr - 1, dp_header_row + 1)
    if dr - 1 < dp_header_row + 1:
        for c in range(1, len(DEPT_SUMMARY_HEADERS) + 1):
            sm.cell(row=dp_header_row + 1, column=c)
        dp_last = dp_header_row + 1

    for i, w in enumerate(DEPT_SUMMARY_COL_WIDTHS, start=1):
        letter = get_column_letter(i)
        current = sm.column_dimensions[letter].width or 0
        sm.column_dimensions[letter].width = max(current, w)

    dp_tbl = Table(displayName="DepartmentSummary", ref=f"A{dp_header_row}:I{dp_last}")
    dp_tbl.tableStyleInfo = TABLE_STYLE
    sm.add_table(dp_tbl)

    det = wb.create_sheet("Detail")
    hdr_next = _title_block(
        det, "P", f"Gate Pass Dispatcher / Security — FY {fy_label} Item Reconciliation — Detail",
        generated_note, filters_desc,
    )
    det.merge_cells(f"A{hdr_next}:P{hdr_next}")
    det.cell(row=hdr_next, column=1,
             value=("One row per line item — pass-level columns (Department, Status, dates, etc.) "
                    "repeat on every line of that pass so every column stays filterable. Status is "
                    "the pass's own workflow status, not a re-derived value. Shaded bands group each "
                    "pass's rows visually.")).font = NOTE_FONT
    table_start = hdr_next + 1

    prepared = []
    for r in flat_rows:
        rr = dict(r)
        rr["_days_outstanding_display"] = _dash_if_none(r.get("days_outstanding"))
        prepared.append((rr, DISPATCHER_KEYS))

    last_row = _write_banded_table(
        det, DISPATCHER_HEADERS, prepared, table_start, DISPATCHER_COL_WIDTHS, "DispatcherDetail",
        date_cols=(6, 7, 8),
    )

    note_row = last_row + 2
    det.cell(row=note_row, column=1,
             value=("Note: Reconciliation Status is per line item. Days Outstanding is blank ('-') "
                    "once the whole pass is fully received, or for Non-Returnable passes.")).font = NOTE_FONT
    det.merge_cells(f"A{note_row}:P{note_row}")

    wb.active = 0
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
