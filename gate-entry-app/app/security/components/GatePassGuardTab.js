// app/security/components/GatePassGuardTab.js - Security guard's gate pass
// worklist, styled to match the approved wireframe (blue Dispatch, teal
// Inward, gray Print Pass). The guard NEVER sees or edits the pass form —
// this is a list-only view with exactly two actions: Dispatch (confirm popup
// + security remarks) and Inward (line-level partial receipt + remarks).
// The Cancelled sub-view shows ONLY passes that were released and then
// cancelled before dispatch — "where did that pass on my list go?"
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { gatePassAPI, handleAPIError } from '../../../services/api';
import { showSuccess, showError, showValidationError, confirmAction } from '../../../utils/customModal';
import DataTable from '../../../components/ui/DataTable';
import printGatePass from '../../../utils/printGatePass';
import styles, { gp } from '../../gate-pass/styles/gatePassStyles';

const VIEWS = [
  { key: 'dispatch', label: 'Pending Dispatch' },
  { key: 'inward', label: 'Pending Inward' },
  { key: 'cancelled', label: 'Cancelled' },
];

const GatePassGuardTab = ({ hasGpdRole = true }) => {
  const [view, setView] = useState('dispatch');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dueItems, setDueItems] = useState([]);
  const [noGpLocation, setNoGpLocation] = useState(false);

  // Location filter (shared-gate guards can hold multiple GP locations).
  // Defaults to All — at a gate serving two warehouses the pass in the
  // driver's hand can be from either location, so nothing is hidden by
  // default. Single-location guards see one fixed chip. Filtering is
  // client-side; the server already returns the union of assigned locations.
  const [myLocations, setMyLocations] = useState([]);
  const [selectedLocs, setSelectedLocs] = useState([]);   // [] = All locations
  const [locMenuOpen, setLocMenuOpen] = useState(false);

  // Dispatch modal (confirm + security remarks)
  const [dispatchTarget, setDispatchTarget] = useState(null);
  const [dispatchRemarks, setDispatchRemarks] = useState('');
  const [dispatching, setDispatching] = useState(false);

  // Inward modal (line-level partial receipt + security remarks)
  const [inwardTarget, setInwardTarget] = useState(null);   // full pass detail
  const [receiptQtys, setReceiptQtys] = useState({});       // line_id -> qty string
  const [inwardRemarks, setInwardRemarks] = useState('');
  const [receiving, setReceiving] = useState(false);

  const load = useCallback(async () => {
    if (!hasGpdRole || noGpLocation) return;
    setLoading(true);
    try {
      const data = await gatePassAPI.getGuardPending(view);
      setItems(data.items || []);
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.detail || '';
      if (detail === 'NO_GP_LOCATION') {
        setNoGpLocation(true);
        setItems([]);
      } else {
        showError(handleAPIError(error));
      }
    } finally {
      setLoading(false);
    }
  }, [view, noGpLocation, hasGpdRole]);

  const loadDue = useCallback(async () => {
    if (!hasGpdRole || noGpLocation) return;
    try {
      const data = await gatePassAPI.getDueNotifications();
      setDueItems(data.items || []);
    } catch (error) {
      setDueItems([]);
    }
  }, [noGpLocation, hasGpdRole]);

  useEffect(() => {
    load();
    loadDue();
  }, [load, loadDue]);

  // Assigned locations (once) — powers the filter chips.
  useEffect(() => {
    if (!hasGpdRole) return;
    gatePassAPI.getMyLocations()
      .then((d) => setMyLocations(d.locations || []))
      .catch(() => setMyLocations([]));
  }, []);

  const visibleItems =
    selectedLocs.length === 0
      ? items
      : items.filter((i) => selectedLocs.includes(i.location_code));

  const toggleLoc = (code) =>
    setSelectedLocs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);

  const locSummary =
    selectedLocs.length === 0 ? 'All locations' : selectedLocs.join(', ');

  // ── Dispatch flow ─────────────────────────────────────────────────────────
  const openDispatch = (pass) => {
    setDispatchRemarks('');
    setDispatchTarget(pass);
  };

  const submitDispatch = () => {
    // Confirmation popup before dispatch (agreed UX safeguard): material
    // physically leaves the premises — irreversible from the guard's side.
    confirmAction({
      title: `Dispatch ${dispatchTarget.gate_pass_no}?`,
      message:
        'Confirm the physical items match the pass. Dispatch cannot be undone. ' +
        'If something does not match, do NOT dispatch — the department must cancel and recreate the pass.',
      confirmText: 'Dispatch',
      cancelText: 'Go back',
      onConfirm: async () => {
        setDispatching(true);
        try {
          await gatePassAPI.dispatchPass(dispatchTarget.id, dispatchRemarks.trim() || null);
          setDispatchTarget(null);
          showSuccess('Dispatched', 'Movement recorded.');
          load();
        } catch (error) {
          showError(handleAPIError(error));
        } finally {
          setDispatching(false);
        }
      },
    });
  };

  // ── Inward flow (partial returns supported) ───────────────────────────────
  const openInward = async (pass) => {
    try {
      const detail = await gatePassAPI.getPass(pass.id);
      const initialQtys = {};
      detail.lines.forEach((l) => {
        const outstanding = l.quantity - l.received_qty;
        if (outstanding > 0) initialQtys[l.id] = String(outstanding); // default: all back
      });
      setReceiptQtys(initialQtys);
      setInwardRemarks('');
      setInwardTarget(detail);
    } catch (error) {
      showError(handleAPIError(error));
    }
  };

  const submitInward = async () => {
    const receipts = [];
    for (const line of inwardTarget.lines) {
      const outstanding = line.quantity - line.received_qty;
      if (outstanding <= 0) continue;
      const raw = (receiptQtys[line.id] || '').trim();
      if (raw === '' || raw === '0') continue;   // nothing received on this line today
      const qty = parseInt(raw, 10);
      if (Number.isNaN(qty) || qty < 0) {
        showValidationError(`Line ${line.line_no}: enter a valid quantity`);
        return;
      }
      if (qty > outstanding) {
        showValidationError(`Line ${line.line_no}: only ${outstanding} outstanding, cannot receive ${qty}`);
        return;
      }
      receipts.push({ line_id: line.id, received_qty: qty });
    }
    if (receipts.length === 0) {
      showValidationError('Enter a received quantity on at least one line');
      return;
    }
    setReceiving(true);
    try {
      const result = await gatePassAPI.inwardPass(inwardTarget.id, receipts, inwardRemarks.trim() || null);
      setInwardTarget(null);
      const msg =
        result.status === 'Inward Received'
          ? 'All items are back — pass closed.'
          : `Partial receipt recorded — ${result.outstanding_quantity} item(s) still out. The pass stays open until everything returns.`;
      showSuccess('Inward recorded', msg);
      load();
      loadDue();
    } catch (error) {
      showError(handleAPIError(error));
    } finally {
      setReceiving(false);
    }
  };

  // ── Table ─────────────────────────────────────────────────────────────────
  const columns = [
    { key: 'gate_pass_no', title: 'Pass No.', flex: 1.3, priority: 1 },
    { key: 'pass_type', title: 'Type', flex: 0.5, priority: 1 },
    { key: 'party_name', title: 'Party', flex: 1.6, priority: 1 },
    { key: 'department', title: 'Dept', flex: 0.8, priority: 1 },
    {
      key: 'action',
      title: view === 'dispatch' ? 'Dispatch' : view === 'inward' ? 'Inward' : 'Reason',
      flex: 1.4,
      priority: 1,
      render: (item) => {
        if (view === 'dispatch') {
          return (
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.smallDispatchBtn} onPress={() => openDispatch(item)}>
                <Text style={styles.smallBtnText}>Dispatch</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallPrintBtn} onPress={() => printGatePass(item.id)}>
                <Text style={styles.smallBtnText}>Print</Text>
              </TouchableOpacity>
            </View>
          );
        }
        if (view === 'inward') {
          return (
            <View style={{ gap: 2 }}>
              <TouchableOpacity style={styles.smallInwardBtn} onPress={() => openInward(item)}>
                <Text style={styles.smallBtnText}>Inward</Text>
              </TouchableOpacity>
              {item.is_overdue && (
                <Text style={{ color: gp.cancel, fontSize: 11, fontWeight: 'bold' }}>Overdue</Text>
              )}
            </View>
          );
        }
        return <Text style={{ fontSize: 12, color: gp.textMuted }}>{item.cancel_reason_text || '—'}</Text>;
      },
    },
    { key: 'vehicle_no', title: 'Vehicle', priority: 2 },
    { key: 'mode_of_transport', title: 'Transport', priority: 2 },
    { key: 'document_date', title: 'Doc Date', priority: 2 },
    { key: 'expected_inward_date', title: 'Return By', priority: 2 },
    {
      key: 'total_quantity',
      title: 'Qty (out / back)',
      priority: 2,
      render: (item) => `${item.total_quantity} out / ${item.total_quantity - item.outstanding_quantity} back`,
    },
    { key: 'created_by', title: 'Created By', priority: 2 },
    { key: 'location_code', title: 'Location', priority: 2 },
  ];

  // Show-and-explain (decided 14 Jul 2026): every guard sees this tab;
  // without the Gate Pass Dispatcher role it explains exactly what to ask
  // for — a different message (and fix) than the no-location card below.
  if (!hasGpdRole) {
    return (
      <View style={styles.guardBlockedContainer}>
        <View style={styles.guardBlockedCard}>
          <Text style={styles.guardBlockedIcon}>🔒</Text>
          <Text style={styles.guardBlockedTitle}>Gate Pass Dispatcher Role Required</Text>
          <Text style={styles.guardBlockedBody}>
            Gate pass processing (dispatch and inward) requires the Gate Pass
            Dispatcher role, which your account does not have.
          </Text>
          <Text style={styles.guardBlockedHint}>
            Ask your IT Admin to assign the Gate Pass Dispatcher role in Assign Access.
          </Text>
        </View>
      </View>
    );
  }

  if (noGpLocation) {
    return (
      <View style={styles.guardBlockedContainer}>
        <View style={styles.guardBlockedCard}>
          <Text style={styles.guardBlockedIcon}>🚫</Text>
          <Text style={styles.guardBlockedTitle}>No Gate Location Assigned</Text>
          <Text style={styles.guardBlockedBody}>
            Your profile does not have a gate pass location assigned.
            You cannot process gate passes until an IT Admin assigns your location.
          </Text>
          <Text style={styles.guardBlockedHint}>Contact IT Admin to resolve this.</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      {/* Due-return alert */}
      {dueItems.length > 0 && (
        <View style={styles.dueBanner}>
          <Text style={styles.dueBannerTitle}>
            {dueItems.length} item group(s) due back and not yet received
          </Text>
          {dueItems.slice(0, 3).map((d) => (
            <Text key={d.gate_pass_no} style={styles.dueBannerText}>
              {d.gate_pass_no} — {d.party_name} — {d.outstanding_quantity} item(s),{' '}
              {d.days_overdue === 0 ? 'due today' : `${d.days_overdue} day(s) overdue`}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.layoutRow}>
        {/* ── Left menu panel (same as GatePassDashboard) ── */}
        <View style={styles.menuPanel}>
          <Text style={styles.menuTitle}>Gate Pass Menu</Text>
          {VIEWS.map((v) => (
            <TouchableOpacity
              key={v.key}
              style={styles.menuItem}
              onPress={() => setView(v.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: view === v.key }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={view === v.key ? styles.menuItemActiveText : styles.menuItemText}>
                  {v.label}
                </Text>
                {v.key === 'inward' && dueItems.length > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{dueItems.length}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.menuItem, { marginTop: 8, borderTopWidth: 1, borderTopColor: '#D6DEE6' }]}
            onPress={() => { load(); loadDue(); }}
            accessibilityRole="button"
          >
            <Text style={styles.menuItemText}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* ── Content pane ── */}
        <View style={styles.contentPane}>
          <View style={styles.formCard}>
            {/* Location filter — dropdown checkbox list (scales to many
                locations). Empty selection = All. Single location renders a
                fixed label (no choice to make). */}
            {myLocations.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, zIndex: 50 }}>
                <Text style={{ fontSize: 12, color: gp.textMuted }}>Location:</Text>
                {myLocations.length > 1 ? (
                  <View style={{ minWidth: 220, maxWidth: 340 }}>
                    <TouchableOpacity
                      onPress={() => setLocMenuOpen((o) => !o)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: locMenuOpen }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        borderWidth: 1, borderColor: '#C8D4DE', borderRadius: 8,
                        paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A2E22' }} numberOfLines={1}>
                        {locSummary}
                      </Text>
                      <Text style={{ fontSize: 10, color: gp.textMuted, marginLeft: 8 }}>
                        {locMenuOpen ? '▲' : '▼'}
                      </Text>
                    </TouchableOpacity>
                    {locMenuOpen && (
                      <View style={{
                        position: 'absolute', top: 38, left: 0, right: 0,
                        backgroundColor: '#fff', borderWidth: 1, borderColor: '#C8D4DE',
                        borderRadius: 8, elevation: 6, zIndex: 100,
                        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
                        shadowOffset: { width: 0, height: 3 },
                      }}>
                        <TouchableOpacity
                          onPress={() => setSelectedLocs([])}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}
                        >
                          <Text style={{ fontSize: 15, width: 24 }}>{selectedLocs.length === 0 ? '☑' : '☐'}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A2E22' }}>All locations</Text>
                        </TouchableOpacity>
                        <View style={{ height: 1, backgroundColor: '#E5EDE8' }} />
                        {myLocations.map((l) => {
                          const on = selectedLocs.includes(l.location_code);
                          return (
                            <TouchableOpacity
                              key={l.location_code}
                              onPress={() => toggleLoc(l.location_code)}
                              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}
                            >
                              <Text style={{ fontSize: 15, width: 24 }}>{on ? '☑' : '☐'}</Text>
                              <Text style={{ fontSize: 13, color: '#1A2E22' }}>{l.location_code}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{
                    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
                    borderWidth: 1, borderColor: '#D6DEE6', backgroundColor: '#F2F5F8',
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>
                      {myLocations[0].location_code}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={gp.accent} />
              </View>
            ) : (
              <DataTable
                columns={columns}
                data={visibleItems}
                keyExtractor={(item) => String(item.id)}
                emptyText={
                  selectedLocs.length > 0 && items.length > 0
                    ? `No passes at ${selectedLocs.join(', ')} — set the filter to All locations to see the rest`
                    : view === 'dispatch'
                      ? 'No passes waiting for dispatch'
                      : view === 'inward'
                        ? 'No returnable passes waiting for inward'
                        : 'No cancelled passes (only passes cancelled after release appear here)'
                }
              />
            )}
          </View>
        </View>
      </View>

      {/* ── Dispatch modal: security remarks + confirm ── */}
      <Modal
        visible={!!dispatchTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDispatchTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Dispatch {dispatchTarget?.gate_pass_no}</Text>
            <Text style={styles.modalSubtitle}>
              {dispatchTarget?.party_name} · {dispatchTarget?.department} ·{' '}
              {dispatchTarget?.total_quantity} item(s)
              {dispatchTarget?.vehicle_no ? ` · ${dispatchTarget.vehicle_no}` : ''}
            </Text>
            <Text style={styles.fieldLabel}>Security remarks (optional)</Text>
            <TextInput
              style={[styles.input, styles.remarksInput]}
              value={dispatchRemarks}
              onChangeText={setDispatchRemarks}
              placeholder="e.g. verified against printed pass, seal intact"
              placeholderTextColor={gp.textMuted}
              multiline
            />
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.wfButton, styles.btnDispatch]}
                onPress={submitDispatch}
                disabled={dispatching}
              >
                {dispatching ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.wfButtonText}>Dispatch</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wfButton, styles.btnPrint]}
                onPress={() => printGatePass(dispatchTarget.id)}
              >
                <Text style={styles.wfButtonText}>Print Pass</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wfButton, styles.btnSecondary]}
                onPress={() => setDispatchTarget(null)}
              >
                <Text style={styles.wfButtonText}>Go back</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Inward modal: per-line received qty (partial supported) ── */}
      <Modal
        visible={!!inwardTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setInwardTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Inward {inwardTarget?.gate_pass_no}</Text>
            <Text style={styles.modalSubtitle}>
              Enter how many of each item came back. Partial receipts are fine — the pass stays open
              until every item returns.
            </Text>
            {inwardTarget?.lines
              ?.filter((l) => l.quantity - l.received_qty > 0)
              .map((l) => (
                <View key={l.id} style={styles.receiptLineRow}>
                  <Text style={styles.receiptLineText} numberOfLines={2}>
                    {l.line_no}. {l.description}
                    {l.serial_no ? ` (SN ${l.serial_no})` : ''}
                  </Text>
                  <Text style={styles.receiptOutstanding}>
                    {l.quantity - l.received_qty} outstanding
                  </Text>
                  <TextInput
                    style={styles.receiptQtyInput}
                    value={receiptQtys[l.id] ?? ''}
                    onChangeText={(v) =>
                      setReceiptQtys((prev) => ({ ...prev, [l.id]: v.replace(/[^0-9]/g, '') }))
                    }
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={gp.textMuted}
                  />
                </View>
              ))}
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Security remarks (optional)</Text>
            <TextInput
              style={[styles.input, styles.remarksInput]}
              value={inwardRemarks}
              onChangeText={setInwardRemarks}
              placeholder="e.g. 3 of 5 received, packaging damaged"
              placeholderTextColor={gp.textMuted}
              multiline
            />
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.wfButton, styles.btnInward]}
                onPress={submitInward}
                disabled={receiving}
              >
                {receiving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.wfButtonText}>Inward</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wfButton, styles.btnSecondary]}
                onPress={() => setInwardTarget(null)}
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

export default GatePassGuardTab;
