// app/gate-pass/GatePassReports.js - "Reports" tab in the Gate Pass Menu
// (added 1 Oct 2026). Role-based, automatic: Gate Pass Creator / IT Admin
// sees the FY Register; Gate Pass Dispatcher / Security Guard sees the FY
// Item Reconciliation. Same table component (DataTable) and the same
// fonts/sizes/colors as every other gate pass tab — no new type scale
// introduced here. The on-screen table always matches what the "Download
// Excel" button produces, because both come from the same backend query.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { gatePassAPI, handleAPIError } from '../../services/api';
import { getCurrentUser } from '../../utils/jwtUtils';
import { showError, showAlert } from '../../utils/customModal';
import DataTable from '../../components/ui/DataTable';
import styles, { gp } from './styles/gatePassStyles';

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

  const loadReport = useCallback(async () => {
    if (!role || !selectedFy) return;
    setLoading(true);
    setNoGpLocation(false);
    try {
      const data = role === 'creator'
        ? await gatePassAPI.getCreatorReport(selectedFy)
        : await gatePassAPI.getDispatcherReport(selectedFy);
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
  }, [role, selectedFy]);

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
      const blob = role === 'creator'
        ? await gatePassAPI.downloadCreatorReportExcel(selectedFy)
        : await gatePassAPI.downloadDispatcherReportExcel(selectedFy);
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

  const creatorColumns = [
    { key: 'gate_pass_no', title: 'Pass No.', flex: 1.3, priority: 1 },
    { key: 'pass_type', title: 'Type', flex: 0.5, priority: 1 },
    { key: 'status', title: 'Status', flex: 1.3, priority: 1, render: (r) => <Badge label={r.status} map={STATUS_COLORS} /> },
    { key: 'department', title: 'Department', flex: 1.0, priority: 1 },
    { key: 'party_name', title: 'Party', flex: 1.5, priority: 1 },
    { key: 'document_date', title: 'Document Date', flex: 1.0, priority: 1, render: (r) => fmtDate(r.document_date) },
    { key: 'dispatched_at', title: 'Dispatched', flex: 1.0, priority: 2, render: (r) => fmtDate(r.dispatched_at) },
    { key: 'expected_inward_date', title: 'Expected Inward', flex: 1.0, priority: 2, render: (r) => fmtDate(r.expected_inward_date) },
    { key: 'days_outstanding', title: 'Days Outstanding', flex: 0.9, priority: 1, render: (r) => (r.days_outstanding ?? '—') },
    { key: 'total_qty', title: 'Total Qty', flex: 0.7, priority: 2 },
    { key: 'total_amount', title: 'Amount', flex: 0.9, priority: 2, render: (r) => (r.total_amount ? `₹${Number(r.total_amount).toLocaleString('en-IN')}` : '—') },
  ];

  const dispatcherColumns = [
    { key: 'department', title: 'Department', flex: 1.0, priority: 1 },
    { key: 'gate_pass_no', title: 'Pass No.', flex: 1.3, priority: 1 },
    { key: 'line_type', title: 'Line Type', flex: 0.8, priority: 2 },
    { key: 'item_code', title: 'Item/Asset Code', flex: 1.0, priority: 2, render: (r) => r.item_code || '—' },
    { key: 'description', title: 'Description of Goods', flex: 1.8, priority: 1 },
    { key: 'qty_sent', title: 'Qty Sent', flex: 0.6, priority: 1 },
    { key: 'qty_returned', title: 'Qty Returned', flex: 0.7, priority: 1 },
    {
      key: 'reconciliation_status', title: 'Status', flex: 1.2, priority: 1,
      render: (r) => <Badge label={r.reconciliation_status} map={RECON_COLORS} />,
    },
    { key: 'days_outstanding', title: 'Days Outstanding', flex: 0.9, priority: 1, render: (r) => (r.days_outstanding ?? '—') },
    { key: 'dispatch_date', title: 'Dispatch Date', flex: 1.0, priority: 2, render: (r) => fmtDate(r.dispatch_date) },
    { key: 'party_name', title: 'Vendor/Customer', flex: 1.3, priority: 2 },
  ];

  const rows = report?.rows || [];
  const sTitle = role === 'creator' ? 'Gate Pass Creator — FY Register' : 'Gate Pass Dispatcher — FY Item Reconciliation';

  return (
    <ScrollView>
      <View style={styles.sectionBar}>
        <Text style={styles.sectionBarText}>{sTitle}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Financial year picker — same dropdown pattern as the UOM/Type pickers elsewhere */}
        <View style={{ position: 'relative' }}>
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
                  <Tile label="Lines Dispatched" value={report.summary.total_lines} />
                  <Tile label="Total Qty Sent" value={report.summary.total_qty_sent} />
                  <Tile label="Departments" value={report.summary.departments} />
                  <Tile label="Pending Return" value={report.summary.pending_lines} />
                  <Tile label="Overdue" value={report.summary.overdue_lines} warn={report.summary.overdue_lines > 0} />
                </>
              )}
            </View>
          )}

          <Text style={styles.countText}>
            {rows.length} {role === 'creator' ? `pass${rows.length === 1 ? '' : 'es'}` : `line${rows.length === 1 ? '' : 's'}`} — FY {selectedFy}
          </Text>

          <DataTable
            columns={role === 'creator' ? creatorColumns : dispatcherColumns}
            data={rows}
            keyExtractor={(item, index) => (role === 'creator' ? item.gate_pass_no : `${item.gate_pass_no}-${index}`)}
            emptyText={role === 'creator' ? 'No gate passes in this financial year' : 'No dispatched lines in this financial year'}
          />
        </>
      )}
    </ScrollView>
  );
};

export default GatePassReports;
