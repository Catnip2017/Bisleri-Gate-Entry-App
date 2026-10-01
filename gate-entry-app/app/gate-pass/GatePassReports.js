// app/gate-pass/GatePassReports.js - "Reports" tab in the Gate Pass Menu
// (added 1 Oct 2026; filters + column rework + expandable line items added
// 1 Oct 2026). Role-based, automatic: Gate Pass Creator / IT Admin sees the
// FY Register; Gate Pass Dispatcher / Security Guard sees the FY Item
// Reconciliation. Same table component (DataTable) and the same
// fonts/sizes/colors as every other gate pass tab — no new type scale
// introduced here. The on-screen table always matches what "Download
// Excel" produces, because both the JSON and the .xlsx come from the same
// backend query with the exact same filters applied.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { gatePassAPI, handleAPIError } from '../../services/api';
import { getCurrentUser } from '../../utils/jwtUtils';
import { showError, showAlert } from '../../utils/customModal';
import DataTable from '../../components/ui/DataTable';
import MultiSelectDropdown from '../../components/ui/MultiSelectDropdown';
import DateField from '../../components/ui/DateField';
import styles, { gp } from './styles/gatePassStyles';

const STATUS_OPTIONS = [
  'Open', 'Released', 'Dispatched', 'Partially Received',
  'Inward Received', 'Cancelled', 'Closed Without Return',
];
const PASS_TYPE_OPTIONS = [
  { value: 'R', label: 'Returnable (R)' },
  { value: 'NR', label: 'Non-Returnable (NR)' },
];

const STATUS_COLORS = {
  Open: { bg: '#F1EFE8', fg: '#444441' },
  Released: { bg: '#E6F1FB', fg: '#0C447C' },
  Dispatched: { bg: '#FAEEDA', fg: '#633806' },
  'Partially Received': { bg: '#FAEEDA', fg: '#854F0B' },
  'Inward Received': { bg: '#EAF3DE', fg: '#27500A' },
  Cancelled: { bg: '#FCEBEB', fg: '#791F1F' },
  'Closed Without Return': { bg: '#F1EFE8', fg: '#5F5E5A' },
};

const RECON_COLORS = {
  'Fully Returned': { bg: '#EAF3DE', fg: '#27500A' },
  'Partially Returned': { bg: '#FAEEDA', fg: '#854F0B' },
  Pending: { bg: '#FCEBEB', fg: '#791F1F' },
  'Not Applicable': { bg: '#F1EFE8', fg: '#5F5E5A' },
};

const Badge = ({ label, map }) => {
  const c = map[label] || { bg: '#F1EFE8', fg: '#444441' };
  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusBadgeText, { color: c.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
};

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');

const toISODate = (date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Summary tiles — same font sizes as the rest of the module: tile value
// matches menuTitle's weight/size (16, bold), tile label matches countText
// (12, muted).
const Tile = ({ label, value, warn }) => (
  <View style={[tileStyle.tile, warn && tileStyle.tileWarn]}>
    <Text style={[tileStyle.value, warn && tileStyle.valueWarn]}>{value}</Text>
    <Text style={tileStyle.label}>{label}</Text>
  </View>
);

const tileStyle = {
  tile: {
    backgroundColor: gp.sectionBg,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 140,
  },
  tileWarn: { backgroundColor: '#FCEBEB' },
  value: { fontSize: 20, fontWeight: 'bold', color: gp.accentDark },
  valueWarn: { color: gp.cancel },
  label: { fontSize: 12, color: gp.textMuted, marginTop: 2 },
};

// Expandable row content — the line items behind one gate pass. Replaces
// DataTable's auto-generated priority-2 panel entirely (passed as
// `renderExpanded`), since there's nothing to show there: every column in
// both reports is priority 1 now, the pass is fully summarized on the main
// row, and line/item detail belongs one level down instead.
const liStyle = {
  panel: { backgroundColor: '#F7FAF8', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: gp.borderLight || '#E5EDE8' },
  title: { fontSize: 12, fontWeight: 'bold', color: gp.textMuted, marginBottom: 6 },
  headerRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#DCE6DF' },
  headerCell: { fontSize: 11, fontWeight: 'bold', color: gp.textMuted },
  row: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EAF0EC' },
  cell: { fontSize: 12, color: gp.text || '#1A2E22' },
  empty: { fontSize: 12, color: gp.textMuted, fontStyle: 'italic', paddingVertical: 6 },
};

const CreatorLineItems = ({ lines }) => (
  <View style={liStyle.panel}>
    <Text style={liStyle.title}>Line Items ({lines.length})</Text>
    {lines.length === 0 ? (
      <Text style={liStyle.empty}>No line items on this pass.</Text>
    ) : (
      <>
        <View style={liStyle.headerRow}>
          <Text style={[liStyle.headerCell, { flex: 0.5 }]}>#</Text>
          <Text style={[liStyle.headerCell, { flex: 1.2 }]}>Type</Text>
          <Text style={[liStyle.headerCell, { flex: 1.4 }]}>Asset No. / Item Code</Text>
          <Text style={[liStyle.headerCell, { flex: 2 }]}>Description</Text>
          <Text style={[liStyle.headerCell, { flex: 0.8 }]}>Qty</Text>
          <Text style={[liStyle.headerCell, { flex: 1 }]}>Amount</Text>
          <Text style={[liStyle.headerCell, { flex: 0.9 }]}>Chargeable?</Text>
        </View>
        {lines.map((l) => (
          <View key={l.line_no} style={liStyle.row}>
            <Text style={[liStyle.cell, { flex: 0.5 }]}>{l.line_no}</Text>
            <Text style={[liStyle.cell, { flex: 1.2 }]}>{l.item_type}</Text>
            <Text style={[liStyle.cell, { flex: 1.4 }]}>{l.item_code || '—'}</Text>
            <Text style={[liStyle.cell, { flex: 2 }]}>{l.description}</Text>
            <Text style={[liStyle.cell, { flex: 0.8 }]}>{l.quantity}</Text>
            <Text style={[liStyle.cell, { flex: 1 }]}>{l.amount ? `₹${Number(l.amount).toLocaleString('en-IN')}` : '—'}</Text>
            <Text style={[liStyle.cell, { flex: 0.9 }]}>{l.chargeable ? 'Yes' : 'No'}</Text>
          </View>
        ))}
      </>
    )}
  </View>
);

const DispatcherLineItems = ({ lines }) => (
  <View style={liStyle.panel}>
    <Text style={liStyle.title}>Line Items ({lines.length})</Text>
    {lines.length === 0 ? (
      <Text style={liStyle.empty}>No line items on this pass.</Text>
    ) : (
      <>
        <View style={liStyle.headerRow}>
          <Text style={[liStyle.headerCell, { flex: 1.4 }]}>Item Code / Asset No.</Text>
          <Text style={[liStyle.headerCell, { flex: 2 }]}>Description</Text>
          <Text style={[liStyle.headerCell, { flex: 0.8 }]}>Qty Sent</Text>
          <Text style={[liStyle.headerCell, { flex: 0.9 }]}>Qty Returned</Text>
          <Text style={[liStyle.headerCell, { flex: 1.3 }]}>Reconciliation</Text>
        </View>
        {lines.map((l, i) => (
          <View key={`${l.item_code || 'line'}-${i}`} style={liStyle.row}>
            <Text style={[liStyle.cell, { flex: 1.4 }]}>{l.item_code || '—'}</Text>
            <Text style={[liStyle.cell, { flex: 2 }]}>{l.description}</Text>
            <Text style={[liStyle.cell, { flex: 0.8 }]}>{l.qty_sent}</Text>
            <Text style={[liStyle.cell, { flex: 0.9 }]}>{l.qty_returned}</Text>
            <View style={{ flex: 1.3 }}>
              <Badge label={l.reconciliation_status} map={RECON_COLORS} />
            </View>
          </View>
        ))}
      </>
    )}
  </View>
);

const GatePassReports = () => {
  const [role, setRole] = useState(null);        // 'creator' | 'dispatcher' | null
  const [noAccess, setNoAccess] = useState(false);
  const [noGpLocation, setNoGpLocation] = useState(false);
  const [fyOptions, setFyOptions] = useState([]);
  const [selectedFy, setSelectedFy] = useState(null);
  const [fyMenuOpen, setFyMenuOpen] = useState(false);
  const [report, setReport] = useState(null);     // raw API response for the active role
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Filters — Status/Pass Type apply to both reports; Department only to
  // Dispatcher (a Creator's rows are already all one department); the date
  // range is "Gate Pass Created Date" for Creator and "Dispatch Date" for
  // Dispatcher. Leaving From/To empty falls back to the selected FY's
  // bounds on the backend — the FY picker is a convenience that pre-fills
  // this range, not a second independent constraint.
  const [statusFilter, setStatusFilter] = useState([]);
  const [passTypeFilter, setPassTypeFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);

  useEffect(() => {
    getCurrentUser().then((u) => {
      const roles = u?.roles || [];
      if (roles.includes('gatepasscreator')) setRole('creator');
      else if (roles.includes('gatepassdispatcher')) setRole('dispatcher');
      else setNoAccess(true);
    });
  }, []);

  useEffect(() => {
    if (!role) return;
    gatePassAPI.getReportFinancialYears().then((data) => {
      setFyOptions(data.financial_years || [data.current]);
      setSelectedFy(data.current);
    }).catch(() => {
      // Fall back to just letting the report call below surface any error.
    });
  }, [role]);

  useEffect(() => {
    if (role !== 'dispatcher') return;
    gatePassAPI.getDepartments()
      .then((d) => setDepartmentOptions(d.departments || []))
      .catch(() => setDepartmentOptions([]));
  }, [role]);

  const buildParams = useCallback(() => {
    const params = {
      fy: selectedFy,
      status: statusFilter.join(','),
      pass_type: passTypeFilter.join(','),
    };
    if (role === 'creator') {
      params.created_from = dateFrom ? toISODate(dateFrom) : '';
      params.created_to = dateTo ? toISODate(dateTo) : '';
    } else {
      params.department = departmentFilter.join(',');
      params.dispatch_from = dateFrom ? toISODate(dateFrom) : '';
      params.dispatch_to = dateTo ? toISODate(dateTo) : '';
    }
    return params;
  }, [role, selectedFy, statusFilter, passTypeFilter, departmentFilter, dateFrom, dateTo]);

  const loadReport = useCallback(async () => {
    if (!role || !selectedFy) return;
    setLoading(true);
    setNoGpLocation(false);
    try {
      const params = buildParams();
      const data = role === 'creator'
        ? await gatePassAPI.getCreatorReport(params)
        : await gatePassAPI.getDispatcherReport(params);
      setReport(data);
    } catch (error) {
      const msg = error?.response?.data?.detail || error?.detail || '';
      if (msg === 'NO_GP_LOCATION') {
        setNoGpLocation(true);
        setReport(null);
      } else {
        showError(handleAPIError(error));
      }
    } finally {
      setLoading(false);
    }
  }, [role, selectedFy, buildParams]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleDownload = async () => {
    if (Platform.OS !== 'web') {
      showAlert('Download', 'Downloading the Excel report is available from the desktop browser.');
      return;
    }
    setDownloading(true);
    try {
      const params = buildParams();
      const blob = role === 'creator'
        ? await gatePassAPI.downloadCreatorReportExcel(params)
        : await gatePassAPI.downloadDispatcherReportExcel(params);
      const filename = role === 'creator'
        ? `Gate_Pass_Creator_FY_Register_${selectedFy}.xlsx`
        : `Gate_Pass_Dispatcher_FY_Item_Reconciliation_${selectedFy}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showError(handleAPIError(error));
    } finally {
      setDownloading(false);
    }
  };

  if (noAccess) {
    return (
      <View style={styles.loadingBox}>
        <Text style={{ fontSize: 14, color: gp.textMuted }}>
          Your role does not have access to gate pass reports.
        </Text>
      </View>
    );
  }

  if (noGpLocation) {
    return (
      <View style={styles.loadingBox}>
        <Text style={{ fontSize: 14, color: gp.textMuted }}>
          No Gate Pass Location assigned to your profile — reports need a location to scope to.
        </Text>
      </View>
    );
  }

  // Creator: one row per pass. Department column dropped (every row is the
  // caller's own department already — shown once as a subtitle instead).
  const creatorColumns = [
    { key: 'gate_pass_no', title: 'Pass No.', flex: 1.3, priority: 1 },
    { key: 'pass_type', title: 'Type', flex: 0.5, priority: 1 },
    { key: 'status', title: 'Status', flex: 1.3, priority: 1, render: (r) => <Badge label={r.status} map={STATUS_COLORS} /> },
    { key: 'party_name', title: 'Vendor/Customer', flex: 1.5, priority: 1 },
    { key: 'gate_pass_created_date', title: 'Gate Pass Created Date', flex: 1.1, priority: 1, render: (r) => fmtDate(r.gate_pass_created_date) },
    { key: 'dispatched_at', title: 'Dispatched Date', flex: 1.0, priority: 1, render: (r) => fmtDate(r.dispatched_at) },
    { key: 'expected_return_date', title: 'Expected Return Date', flex: 1.1, priority: 1, render: (r) => fmtDate(r.expected_return_date) },
    { key: 'actual_return_date', title: 'Actual Return Date', flex: 1.1, priority: 1, render: (r) => fmtDate(r.actual_return_date) },
    { key: 'days_outstanding', title: 'Days Outstanding', flex: 0.9, priority: 1, render: (r) => (r.days_outstanding ?? '—') },
    { key: 'total_qty', title: 'Total Qty', flex: 0.7, priority: 1 },
    { key: 'total_amount', title: 'Amount', flex: 0.9, priority: 1, render: (r) => (r.total_amount ? `₹${Number(r.total_amount).toLocaleString('en-IN')}` : '—') },
  ];

  // Dispatcher: one row per pass ("clubbed" — no more one row per line).
  // Column order as specified: Department, Gate Pass Type, Gate Pass No.,
  // Status, then the rest. Status here is the pass's own workflow status,
  // not a re-derived reconciliation value (that lives per-line, in the
  // expand panel).
  const dispatcherColumns = [
    { key: 'department', title: 'Department', flex: 1.0, priority: 1 },
    { key: 'pass_type', title: 'Gate Pass Type', flex: 0.8, priority: 1 },
    { key: 'gate_pass_no', title: 'Gate Pass No.', flex: 1.3, priority: 1 },
    { key: 'status', title: 'Status', flex: 1.3, priority: 1, render: (r) => <Badge label={r.status} map={STATUS_COLORS} /> },
    { key: 'party_name', title: 'Vendor/Customer', flex: 1.4, priority: 1 },
    { key: 'dispatch_date', title: 'Dispatch Date', flex: 1.0, priority: 1, render: (r) => fmtDate(r.dispatch_date) },
    { key: 'expected_return_date', title: 'Expected Return Date', flex: 1.1, priority: 1, render: (r) => fmtDate(r.expected_return_date) },
    { key: 'actual_return_date', title: 'Actual Return Date', flex: 1.1, priority: 1, render: (r) => fmtDate(r.actual_return_date) },
    { key: 'total_qty_sent', title: 'Total Qty Sent', flex: 0.8, priority: 1 },
    { key: 'days_outstanding', title: 'Days Outstanding', flex: 0.9, priority: 1, render: (r) => (r.days_outstanding ?? '—') },
    { key: 'remarks', title: 'Remarks', flex: 1.4, priority: 1, render: (r) => r.remarks || '—' },
  ];

  const rows = report?.rows || [];
  const sTitle = role === 'creator' ? 'Gate Pass Creator — FY Register' : 'Gate Pass Dispatcher — FY Item Reconciliation';
  const deptSubtitle = role === 'creator' ? (report?.department || 'All Departments') : null;

  return (
    <ScrollView>
      <View style={styles.sectionBar}>
        <Text style={styles.sectionBarText}>{sTitle}</Text>
      </View>
      {deptSubtitle && (
        <Text style={[styles.countText, { marginTop: 4 }]}>Department: {deptSubtitle}</Text>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Financial year picker — same dropdown pattern as the UOM/Type pickers elsewhere */}
        <View style={{ position: 'relative' }}>
          <Text style={{ fontSize: 12, color: gp.textMuted, marginBottom: 4 }}>Financial Year</Text>
          <TouchableOpacity style={[styles.uomTrigger, { minWidth: 120 }]} onPress={() => setFyMenuOpen((v) => !v)}>
            <Text style={styles.uomTriggerText}>FY {selectedFy || '—'}</Text>
            <Text style={{ fontSize: 9, color: gp.textMuted }}>{fyMenuOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {fyMenuOpen && (
            <View style={[styles.uomMenu, { minWidth: 120 }]}>
              {fyOptions.map((fy) => (
                <TouchableOpacity
                  key={fy}
                  style={[styles.uomItem, fy === selectedFy && styles.uomItemActive]}
                  onPress={() => { setSelectedFy(fy); setFyMenuOpen(false); }}
                >
                  <Text style={[styles.uomItemText, fy === selectedFy && styles.uomItemTextActive]}>FY {fy}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <MultiSelectDropdown
          label="Status"
          options={STATUS_OPTIONS}
          selected={statusFilter}
          onChange={setStatusFilter}
          minWidth={170}
          maxWidth={220}
        />

        <MultiSelectDropdown
          label="Pass Type"
          options={PASS_TYPE_OPTIONS}
          selected={passTypeFilter}
          onChange={setPassTypeFilter}
          minWidth={160}
          maxWidth={200}
        />

        {role === 'dispatcher' && (
          <MultiSelectDropdown
            label="Department"
            options={departmentOptions}
            selected={departmentFilter}
            onChange={setDepartmentFilter}
            minWidth={170}
            maxWidth={220}
          />
        )}

        <DateField
          label={role === 'creator' ? 'Created From' : 'Dispatch From'}
          value={dateFrom}
          onChange={setDateFrom}
          placeholder={`FY ${selectedFy || ''} start`}
        />
        <DateField
          label={role === 'creator' ? 'Created To' : 'Dispatch To'}
          value={dateTo}
          onChange={setDateTo}
          placeholder={`FY ${selectedFy || ''} end`}
        />

        <TouchableOpacity
          style={[styles.wfButton, styles.btnDispatch, downloading && { opacity: 0.6 }]}
          onPress={handleDownload}
          disabled={downloading}
        >
          <Text style={styles.wfButtonText}>{downloading ? 'Preparing…' : '⬇ Download Excel'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={gp.accent} />
        </View>
      ) : (
        <>
          {report?.summary && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {role === 'creator' ? (
                <>
                  <Tile label="Total Gate Passes" value={report.summary.total_passes} />
                  <Tile label="Returnable" value={report.summary.returnable_count} />
                  <Tile label="Non-Returnable" value={report.summary.non_returnable_count} />
                  <Tile label="Pending Return" value={report.summary.pending_return_count} />
                  <Tile label="Overdue" value={report.summary.overdue_count} warn={report.summary.overdue_count > 0} />
                  <Tile
                    label="Chargeable Amount"
                    value={`₹${Number(report.summary.total_chargeable_amount).toLocaleString('en-IN')}`}
                  />
                </>
              ) : (
                <>
                  <Tile label="Total Gate Passes" value={report.summary.total_passes} />
                  <Tile label="Total Qty Sent" value={report.summary.total_qty_sent} />
                  <Tile label="Departments" value={report.summary.departments} />
                  <Tile label="Pending Return" value={report.summary.pending_lines} />
                  <Tile label="Overdue" value={report.summary.overdue_lines} warn={report.summary.overdue_lines > 0} />
                </>
              )}
            </View>
          )}

          <Text style={styles.countText}>
            {rows.length} pass{rows.length === 1 ? '' : 'es'} — FY {selectedFy}
          </Text>

          <DataTable
            columns={role === 'creator' ? creatorColumns : dispatcherColumns}
            data={rows}
            keyExtractor={(item) => item.gate_pass_no}
            emptyText={role === 'creator' ? 'No gate passes match these filters' : 'No dispatched passes match these filters'}
            renderExpanded={(item) => (
              role === 'creator'
                ? <CreatorLineItems lines={item.lines || []} />
                : <DispatcherLineItems lines={item.lines || []} />
            )}
          />
        </>
      )}
    </ScrollView>
  );
};

export default GatePassReports;
