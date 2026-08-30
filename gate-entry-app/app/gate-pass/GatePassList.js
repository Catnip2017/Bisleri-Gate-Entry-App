// app/gate-pass/GatePassList.js - Pass list, driven by the wireframe menu
// (fixedStatus prop) or free filtering in "View All Passes" (showFilters).
// Actions per status (NO EDIT anywhere, by design):
//   Open      -> Release (confirm popup) | Cancel (mandatory reason)
//   Released  -> Print | Cancel (until the guard dispatches)
//   Dispatched / Partially Received -> Print | Close w/o return (admin)
//   Inward Received / Cancelled / Closed -> Print / view only
// Cancelled passes are ALWAYS visible to their department — permanent record.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { gatePassAPI, handleAPIError } from '../../services/api';
import { showSuccess, showError, showValidationError, confirmAction } from '../../utils/customModal';
import DataTable from '../../components/ui/DataTable';
import DateField from '../../components/ui/DateField';
import MultiSelectDropdown from '../../components/ui/MultiSelectDropdown';
import printGatePass from '../../utils/printGatePass';
import styles, { gp } from './styles/gatePassStyles';

const STATUS_STYLES = {
  Open: { bg: '#F1EFE8', fg: '#444441' },
  Released: { bg: '#E6F1FB', fg: '#0C447C' },
  Dispatched: { bg: '#FAEEDA', fg: '#633806' },
  'Partially Received': { bg: '#FAEEDA', fg: '#854F0B' },
  'Inward Received': { bg: '#EAF3DE', fg: '#27500A' },
  Cancelled: { bg: '#FCEBEB', fg: '#791F1F' },
  'Closed Without Return': { bg: '#F1EFE8', fg: '#5F5E5A' },
};

const StatusBadge = ({ status, overdue }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Open;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
        <Text style={[styles.statusBadgeText, { color: s.fg }]}>{status}</Text>
      </View>
      {overdue && (
        <View style={[styles.statusBadge, { backgroundColor: '#FCEBEB' }]}>
          <Text style={[styles.statusBadgeText, { color: '#791F1F' }]}>Overdue</Text>
        </View>
      )}
    </View>
  );
};

const PRINTABLE = ['Released', 'Dispatched', 'Partially Received', 'Inward Received', 'Closed Without Return'];

const STATUS_OPTIONS = [
  'Open', 'Released', 'Dispatched', 'Partially Received',
  'Inward Received', 'Cancelled', 'Closed Without Return',
];
const PASS_TYPE_OPTIONS = [
  { value: 'R', label: 'Returnable' },
  { value: 'NR', label: 'Non-Returnable' },
];

const GatePassList = ({ refreshKey, onChanged, fixedStatus = null, showFilters = true }) => {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilters, setStatusFilters] = useState([]);
  const [passTypeFilters, setPassTypeFilters] = useState([]);
  const [dateFrom, setDateFrom] = useState(null);   // Date | null
  const [dateTo, setDateTo] = useState(null);        // Date | null
  const [loading, setLoading] = useState(false);
  const [noGpLocation, setNoGpLocation] = useState(false);

  // Cancel modal state (reason is MANDATORY — picked from the master list)
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReasons, setCancelReasons] = useState([]);
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Force close modal (admin write-off, mandatory reason)
  const [forceCloseTarget, setForceCloseTarget] = useState(null);
  const [closeReason, setCloseReason] = useState('');
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNoGpLocation(false);
    try {
      const filters = { limit: 100 };
      if (fixedStatus) filters.status = fixedStatus;
      if (!fixedStatus && statusFilters.length > 0) filters.statuses = statusFilters.join(',');
      if (passTypeFilters.length > 0) filters.pass_types = passTypeFilters.join(',');
      if (dateFrom) filters.from_date = toISODate(dateFrom);
      if (dateTo) filters.to_date = toISODate(dateTo);
      if (overdueOnly) filters.overdue_only = true;
      if (searchText.trim()) filters.q = searchText.trim();
      const data = await gatePassAPI.listPasses(filters);
      setItems(data.items || []);
      setTotalCount(data.total_count || 0);
    } catch (error) {
      const msg = error?.response?.data?.detail || error?.detail || '';
      if (msg === 'NO_GP_LOCATION') {
        setNoGpLocation(true);
        setItems([]);
        setTotalCount(0);
      } else {
        showError(handleAPIError(error));
      }
    } finally {
      setLoading(false);
    }
  }, [fixedStatus, overdueOnly, searchText, statusFilters, passTypeFilters, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const notifyChanged = () => {
    load();
    if (onChanged) onChanged();
  };

  const toISODate = (date) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const toggleStatusFilter = (s) =>
    setStatusFilters((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const togglePassTypeFilter = (t) =>
    setPassTypeFilters((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const clearFilters = () => {
    setStatusFilters([]);
    setPassTypeFilters([]);
    setDateFrom(null);
    setDateTo(null);
    setOverdueOnly(false);
  };
  const filtersActive =
    statusFilters.length > 0 || passTypeFilters.length > 0 || !!dateFrom || !!dateTo || overdueOnly;

  // ── Release (confirmation popup — agreed UX safeguard) ────────────────────
  const handleRelease = (pass) => {
    confirmAction({
      title: 'Release gate pass?',
      message:
        `${pass.gate_pass_no} will appear on the security guard's dispatch list. ` +
        'After release it cannot be modified — only cancelled. Continue?',
      confirmText: 'Release',
      cancelText: 'Go back',
      onConfirm: async () => {
        try {
          await gatePassAPI.releasePass(pass.id);
          showSuccess('Released', `${pass.gate_pass_no} is now with security for dispatch.`);
          notifyChanged();
        } catch (error) {
          showError(handleAPIError(error));
        }
      },
    });
  };

  // ── Cancel (mandatory reason from master) ─────────────────────────────────
  const openCancelModal = async (pass) => {
    try {
      if (cancelReasons.length === 0) {
        const reasons = await gatePassAPI.getCancelReasons();
        setCancelReasons(reasons);
      }
      setSelectedReasonId(null);
      setCancelRemarks('');
      setCancelTarget(pass);
    } catch (error) {
      showError(handleAPIError(error));
    }
  };

  const submitCancel = async () => {
    if (!selectedReasonId) {
      showValidationError('Select a cancellation reason to continue');
      return;
    }
    setCancelling(true);
    try {
      await gatePassAPI.cancelPass(cancelTarget.id, selectedReasonId, cancelRemarks.trim() || null);
      setCancelTarget(null);
      showSuccess(
        'Pass cancelled',
        `${cancelTarget.gate_pass_no} is cancelled. The number stays on record — create a new pass if the movement is still needed.`
      );
      notifyChanged();
    } catch (error) {
      showError(handleAPIError(error));
    } finally {
      setCancelling(false);
    }
  };

  // ── Force close (admin escape hatch, warning popup with outstanding qty) ──
  const handleForceClose = (pass) => {
    confirmAction({
      title: 'Close without return?',
      message:
        `${pass.gate_pass_no} still has ${pass.outstanding_quantity} item(s) not returned. ` +
        'Closing writes them off permanently — this cannot be undone. ' +
        'You will be asked for a reason.',
      confirmText: 'Continue',
      cancelText: 'Go back',
      destructive: true,
      onConfirm: () => setForceCloseTarget(pass),
    });
  };

  const submitForceClose = async () => {
    if (closeReason.trim().length < 5) {
      showValidationError('A close reason is required (minimum 5 characters)');
      return;
    }
    setClosing(true);
    try {
      await gatePassAPI.forceClosePass(forceCloseTarget.id, closeReason.trim());
      setForceCloseTarget(null);
      setCloseReason('');
      showSuccess('Closed without return', 'Outstanding items were recorded as never returned.');
      notifyChanged();
    } catch (error) {
      showError(handleAPIError(error));
    } finally {
      setClosing(false);
    }
  };

  const columns = [
    { key: 'gate_pass_no', title: 'Pass No.', flex: 1.3, priority: 1 },
    { key: 'pass_type', title: 'Type', flex: 0.5, priority: 1 },
    {
      key: 'status',
      title: 'Status',
      flex: 1.4,
      priority: 1,
      render: (item) => <StatusBadge status={item.status} overdue={item.is_overdue} />,
    },
    { key: 'party_name', title: 'Party', flex: 1.6, priority: 1 },
    {
      key: 'actions',
      title: 'Actions',
      flex: 1.9,
      priority: 1,
      render: (item) => (
        <View style={styles.rowActions}>
          {item.status === 'Open' && (
            <>
              <TouchableOpacity style={styles.smallPrimaryBtn} onPress={() => handleRelease(item)}>
                <Text style={styles.smallBtnText}>Release</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallDangerBtn} onPress={() => openCancelModal(item)}>
                <Text style={styles.smallBtnText}>Cancel Pass</Text>
              </TouchableOpacity>
            </>
          )}
          {item.status === 'Released' && (
            <TouchableOpacity style={styles.smallDangerBtn} onPress={() => openCancelModal(item)}>
              <Text style={styles.smallBtnText}>Cancel Pass</Text>
            </TouchableOpacity>
          )}
          {(item.status === 'Dispatched' || item.status === 'Partially Received') &&
            item.pass_type === 'R' && (
              <TouchableOpacity style={styles.smallSecondaryBtn} onPress={() => handleForceClose(item)}>
                <Text style={styles.smallBtnText}>Close w/o return</Text>
              </TouchableOpacity>
            )}
          {PRINTABLE.includes(item.status) && (
            <TouchableOpacity style={styles.smallPrintBtn} onPress={() => printGatePass(item.id)}>
              <Text style={styles.smallPrintBtnText}>Print</Text>
            </TouchableOpacity>
          )}
        </View>
      ),
    },
    // Movement timeline, always visible - replaces the old expandable
    // detail panel (Department/Location/Doc Date/Vehicle/Return By/Qty/
    // Created By/Cancel Reason) which was hidden behind a chevron and
    // rarely opened. These three dates are the ones people actually track
    // a pass by.
    {
      key: 'dispatched_at',
      title: 'Dispatched Date',
      flex: 1.1,
      priority: 1,
      render: (item) => (item.dispatched_at ? new Date(item.dispatched_at).toLocaleDateString() : '—'),
    },
    { key: 'expected_inward_date', title: 'Expected Inward Date', flex: 1.1, priority: 1 },
    {
      key: 'last_inward_at',
      title: 'Inward Date',
      flex: 1.1,
      priority: 1,
      render: (item) => (item.last_inward_at ? new Date(item.last_inward_at).toLocaleDateString() : '—'),
    },
    // Detail dropdown — restored, minus 'Return By' (now the Expected Inward
    // Date column above) since showing it twice was redundant.
    { key: 'department', title: 'Department', priority: 2 },
    { key: 'location_code', title: 'Location', priority: 2 },
    { key: 'document_date', title: 'Doc Date', priority: 2 },
    { key: 'vehicle_no', title: 'Vehicle', priority: 2 },
    {
      key: 'total_quantity',
      title: 'Qty (out / back)',
      priority: 2,
      render: (item) => `${item.total_quantity} out / ${item.total_quantity - item.outstanding_quantity} back`,
    },
    { key: 'created_by', title: 'Created By', priority: 2 },
    { key: 'cancel_reason_text', title: 'Cancel Reason', priority: 2 },
  ];

  return (
    <View>
      {/* NO_GP_LOCATION banner — guard profile has no gate location assigned */}
      {noGpLocation && (
        <View style={styles.noLocBanner}>
          <Text style={styles.noLocBannerText}>
            ⚠ No gate pass location is assigned to your profile. Contact IT Admin to assign a location before you can process passes.
          </Text>
        </View>
      )}

      {/* Filters — only in "View All Passes" (menu drives status otherwise) */}
      {showFilters && (
        <View style={[styles.filterRow, { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, zIndex: 50 }]}>
          <MultiSelectDropdown
            label="Status"
            options={STATUS_OPTIONS}
            selected={statusFilters}
            onChange={setStatusFilters}
            allLabel="All statuses"
            minWidth={170}
          />
          <MultiSelectDropdown
            label="Pass Type"
            options={PASS_TYPE_OPTIONS}
            selected={passTypeFilters}
            onChange={setPassTypeFilters}
            allLabel="All pass types"
            minWidth={160}
          />
          <View style={{ minWidth: 150 }}>
            <DateField label="From date" value={dateFrom} onChange={setDateFrom} placeholder="Any date" />
          </View>
          <View style={{ minWidth: 150 }}>
            <DateField label="To date" value={dateTo} onChange={setDateTo} placeholder="Any date" />
          </View>
          <TouchableOpacity
            style={[overdueOnly ? styles.chipActive : styles.chip, { marginBottom: 2 }]}
            onPress={() => setOverdueOnly(!overdueOnly)}
          >
            <Text style={overdueOnly ? styles.chipActiveText : styles.chipText}>Overdue Returns</Text>
          </TouchableOpacity>
          {filtersActive && (
            <TouchableOpacity style={[styles.wfButton, styles.btnSecondary, { marginBottom: 0 }]} onPress={clearFilters}>
              <Text style={styles.wfButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search pass no., party or vehicle"
          placeholderTextColor={gp.textMuted}
          onSubmitEditing={load}
        />
        <TouchableOpacity style={[styles.wfButton, styles.btnDispatch]} onPress={load}>
          <Text style={styles.wfButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.countText}>
        {fixedStatus ? `${fixedStatus}: ` : ''}
        {totalCount} pass{totalCount === 1 ? '' : 'es'}
      </Text>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={gp.accent} />
        </View>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          keyExtractor={(item) => String(item.id)}
          emptyText="No gate passes found"
        />
      )}

      {/* ── Cancel modal: reason is mandatory, picked before cancel is allowed ── */}
      <Modal visible={!!cancelTarget} transparent animationType="fade" onRequestClose={() => setCancelTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel {cancelTarget?.gate_pass_no}</Text>
            <Text style={styles.modalSubtitle}>
              Select a reason — cancellation is permanent and the pass number stays on record.
            </Text>
            {cancelReasons.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.radioRow}
                onPress={() => setSelectedReasonId(r.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedReasonId === r.id }}
              >
                <View style={selectedReasonId === r.id ? styles.radioOuterActive : styles.radioOuter}>
                  {selectedReasonId === r.id && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.radioLabel}>{r.reason_text}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={[styles.input, styles.remarksInput]}
              value={cancelRemarks}
              onChangeText={setCancelRemarks}
              placeholder="Remarks (optional)"
              placeholderTextColor={gp.textMuted}
              multiline
            />
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.wfButton, styles.btnCancel, !selectedReasonId && { opacity: 0.5 }]}
                onPress={submitCancel}
                disabled={cancelling || !selectedReasonId}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.wfButtonText}>Cancel Pass</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wfButton, styles.btnSecondary]}
                onPress={() => setCancelTarget(null)}
              >
                <Text style={styles.wfButtonText}>Go back</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Force close modal: mandatory free-text reason ── */}
      <Modal
        visible={!!forceCloseTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setForceCloseTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Close {forceCloseTarget?.gate_pass_no} without return</Text>
            <Text style={styles.modalSubtitle}>
              {forceCloseTarget?.outstanding_quantity} item(s) will be recorded as never returned. Reason is
              mandatory and goes to the audit log.
            </Text>
            <TextInput
              style={[styles.input, styles.remarksInput]}
              value={closeReason}
              onChangeText={setCloseReason}
              placeholder="Why are these items being written off?"
              placeholderTextColor={gp.textMuted}
              multiline
            />
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.wfButton, styles.btnCancel]}
                onPress={submitForceClose}
                disabled={closing}
              >
                {closing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.wfButtonText}>Close without return</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wfButton, styles.btnSecondary]}
                onPress={() => setForceCloseTarget(null)}
              >
                <Text style={styles.wfButtonText}>Go back</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default GatePassList;
