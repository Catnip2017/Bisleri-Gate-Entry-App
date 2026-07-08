// app/gate-pass/GatePassList.js - Initiator's pass list with status lifecycle.
// Actions per status (NO EDIT anywhere, by design):
//   Open      -> Release (confirm popup) | Cancel (mandatory reason)
//   Released  -> Cancel (until the guard dispatches)
//   Dispatched / Partially Received / Inward Received / Cancelled / Closed -> view only
// Cancelled passes are ALWAYS visible to their department — permanent record.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { gatePassAPI, handleAPIError } from '../../services/api';
import { showSuccess, showError, showValidationError, confirmAction } from '../../utils/customModal';
import AppButton from '../../components/ui/AppButton';
import DataTable from '../../components/ui/DataTable';
import { colors } from '../../utils/theme';
import styles from './styles/gatePassStyles';

const STATUS_FILTERS = [
  { key: null, label: 'All' },
  { key: 'Open', label: 'Open' },
  { key: 'Released', label: 'Pending Release' },
  { key: 'Dispatched', label: 'Dispatched' },
  { key: 'Partially Received', label: 'Partial' },
  { key: 'Inward Received', label: 'Inward Received' },
  { key: 'Cancelled', label: 'Cancelled' },
];

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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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

const GatePassList = ({ refreshKey, onChanged }) => {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);

  // Cancel modal state (reason is MANDATORY — picked from the master list)
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReasons, setCancelReasons] = useState([]);
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters = { limit: 100 };
      if (statusFilter) filters.status = statusFilter;
      if (overdueOnly) filters.overdue_only = true;
      if (searchText.trim()) filters.q = searchText.trim();
      const data = await gatePassAPI.listPasses(filters);
      setItems(data.items || []);
      setTotalCount(data.total_count || 0);
    } catch (error) {
      showError(handleAPIError(error));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, overdueOnly, searchText]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const notifyChanged = () => {
    load();
    if (onChanged) onChanged();
  };

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
      onConfirm: () => {
        // Reuse the cancel modal UI pattern with a free-text mandatory reason
        setForceCloseTarget(pass);
      },
    });
  };
  const [forceCloseTarget, setForceCloseTarget] = useState(null);
  const [closeReason, setCloseReason] = useState('');
  const [closing, setClosing] = useState(false);

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
      flex: 1.8,
      priority: 1,
      render: (item) => (
        <View style={styles.rowActions}>
          {item.status === 'Open' && (
            <>
              <TouchableOpacity style={styles.smallPrimaryBtn} onPress={() => handleRelease(item)}>
                <Text style={styles.smallBtnText}>Release</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallDangerBtn} onPress={() => openCancelModal(item)}>
                <Text style={styles.smallBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
          {item.status === 'Released' && (
            <TouchableOpacity style={styles.smallDangerBtn} onPress={() => openCancelModal(item)}>
              <Text style={styles.smallBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
          {(item.status === 'Dispatched' || item.status === 'Partially Received') &&
            item.pass_type === 'R' && (
              <TouchableOpacity style={styles.smallSecondaryBtn} onPress={() => handleForceClose(item)}>
                <Text style={styles.smallBtnText}>Close w/o return</Text>
              </TouchableOpacity>
            )}
        </View>
      ),
    },
    { key: 'department', title: 'Department', priority: 2 },
    { key: 'location_code', title: 'Location', priority: 2 },
    { key: 'document_date', title: 'Doc Date', priority: 2 },
    { key: 'vehicle_no', title: 'Vehicle', priority: 2 },
    { key: 'expected_inward_date', title: 'Return By', priority: 2 },
    {
      key: 'total_quantity',
      title: 'Qty (out / back)',
      priority: 2,
      render: (item) =>
        `${item.total_quantity} out / ${item.total_quantity - item.outstanding_quantity} back`,
    },
    { key: 'created_by', title: 'Created By', priority: 2 },
    { key: 'cancel_reason_text', title: 'Cancel Reason', priority: 2 },
  ];

  return (
    <View>
      {/* Filters */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {STATUS_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.label}
                style={statusFilter === f.key && !overdueOnly ? styles.chipActive : styles.chip}
                onPress={() => {
                  setStatusFilter(f.key);
                  setOverdueOnly(false);
                }}
              >
                <Text style={statusFilter === f.key && !overdueOnly ? styles.chipActiveText : styles.chipText}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={overdueOnly ? styles.chipActive : styles.chip}
              onPress={() => {
                setOverdueOnly(!overdueOnly);
                setStatusFilter(null);
              }}
            >
              <Text style={overdueOnly ? styles.chipActiveText : styles.chipText}>Overdue Returns</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search pass no., party or vehicle"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={load}
        />
        <AppButton title="Search" icon="search" variant="secondary" onPress={load} />
      </View>

      <Text style={styles.countText}>
        {totalCount} pass{totalCount === 1 ? '' : 'es'}
      </Text>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
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
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.actionRow}>
              <AppButton
                title="Cancel pass"
                variant="danger"
                onPress={submitCancel}
                loading={cancelling}
                disabled={!selectedReasonId}
              />
              <AppButton title="Go back" variant="secondary" onPress={() => setCancelTarget(null)} />
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
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.actionRow}>
              <AppButton
                title="Close without return"
                variant="danger"
                onPress={submitForceClose}
                loading={closing}
              />
              <AppButton title="Go back" variant="secondary" onPress={() => setForceCloseTarget(null)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default GatePassList;
