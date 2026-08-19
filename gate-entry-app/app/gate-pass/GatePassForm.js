// app/gate-pass/GatePassForm.js - Create-once gate pass form (NO EDIT by design).
// Layout follows the approved wireframe: Entry Type pills + NR/R badge,
// "General Details" section bar, field grid (auto-generated pass no, document
// date/time, status, user id, dispatch date/time placeholders), blue items
// table (Description of Goods | Qty | Unit), wireframe action buttons.
// A wrong pass is cancelled and recreated — there is no edit path anywhere.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { gatePassAPI, handleAPIError } from '../../services/api';
import { getCurrentUser } from '../../utils/jwtUtils';
import { showSuccess, showError, showValidationError, confirmAction } from '../../utils/customModal';
import DateField from '../../components/ui/DateField';
import styles, { gp } from './styles/gatePassStyles';

const EMPTY_LINE = () => ({
  asset_code: '',
  item_type: 'Item',   // 'Item' = user-populated master; 'Fixed Asset' = Fabric master
  description: '',
  serial_no: '',
  uom: 'NOS',
  quantity: '',
  amount: '',
  chargeable: null,
});

const UOM_OPTIONS = ['NOS', 'KG', 'LTR', 'BOX', 'SET'];
const CHARGEABLE_OPTIONS = ['Chargeable', 'Non-chargeable'];
const LINE_TYPES = ['Item', 'Fixed Asset'];

// Navision-style lookup window (14 Jul 2026): search box + column table in a
// modal. Used for Party and Fixed Asset selection. Search is server-side so
// 500+ pipeline rows stay fast; after picking, the form shows just the code.
function LookupModal({
  visible, title, columns, fetchRows, keyField, onPick, onClose,
  // Optional: lets the modal double as a "pick existing or create new" picker
  // (used for the user-populated Item master).
  allowCreate = false, onCreate = null,
}) {
  const [query, setQuery] = React.useState('');
  const [rows, setRows] = React.useState([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setQuery('');
    setRows([]);
    let dead = false;
    setBusy(true);
    fetchRows('').then((r) => { if (!dead) setRows(r || []); })
      .catch(() => { if (!dead) setRows([]); })
      .finally(() => { if (!dead) setBusy(false); });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const runSearch = (q) => {
    setQuery(q);
    setBusy(true);
    fetchRows(q).then((r) => setRows(r || [])).catch(() => setRows([])).finally(() => setBusy(false));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { maxWidth: 640, width: '92%' }]}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={runSearch}
            placeholder="Search code or name..."
            placeholderTextColor={gp.textMuted}
            autoFocus
          />
          {/* header row */}
          <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#C8D4DE' }}>
            {columns.map((c) => (
              <Text key={c.key} style={{ flex: c.flex, fontSize: 11, fontWeight: 'bold', color: gp.textMuted }} numberOfLines={1}>
                {c.label}
              </Text>
            ))}
          </View>
          <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {allowCreate && query.trim() ? (
              <TouchableOpacity
                onPress={() => onCreate(query.trim())}
                style={{ flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EEF2F5', backgroundColor: '#F0F8FF' }}
              >
                <Text style={{ fontSize: 12, color: gp.accent, fontWeight: '600' }} numberOfLines={1}>
                  {`+ Use "${query.trim()}" as new item`}
                </Text>
              </TouchableOpacity>
            ) : null}
            {busy ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={gp.accent} />
            ) : rows.length === 0 ? (
              allowCreate && query.trim() ? null : (
                <Text style={{ fontSize: 12, color: gp.textMuted, paddingVertical: 14, textAlign: 'center' }}>
                  No matches — refine your search
                </Text>
              )
            ) : (
              rows.map((r) => (
                <TouchableOpacity
                  key={r[keyField]}
                  onPress={() => onPick(r)}
                  style={{ flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EEF2F5' }}
                >
                  {columns.map((c) => (
                    <Text key={c.key} style={{ flex: c.flex, fontSize: 12, color: '#1A2E22', paddingRight: 6 }} numberOfLines={1}>
                      {r[c.key] || '—'}
                    </Text>
                  ))}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.wfButton, styles.btnSecondary]} onPress={onClose}>
              <Text style={styles.wfButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const GatePassForm = ({ onCreated }) => {
  const [passType, setPassType] = useState('NR');
  const [username, setUsername] = useState('');
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locationCode, setLocationCode] = useState('');
  const [department, setDepartment] = useState('');
  const [deptLocked, setDeptLocked] = useState(false); // GPU: dept comes from profile, read-only
  const [myLocations, setMyLocations] = useState([]);  // user's assigned GP locations (junction)
  // Vendor / Customer are mutually exclusive — picking one clears the other.
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [modeOfTransport, setModeOfTransport] = useState('Hand Delivery');
  const [vehicleNo, setVehicleNo] = useState('');
  const [senderName, setSenderName] = useState('');
  const [approverName, setApproverName] = useState('');
  const [expectedInwardDate, setExpectedInwardDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [assetModalLine, setAssetModalLine] = useState(null);  // line index picking an asset
  const [itemModalLine, setItemModalLine] = useState(null);    // line index picking/creating an item
  const [openTypeLine, setOpenTypeLine] = useState(null);      // line with Type dropdown open
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const [locDropdownOpen, setLocDropdownOpen] = useState(false);
  const [openUomLine, setOpenUomLine] = useState(null);          // index of line with UOM dropdown open
  const [openChargeableLine, setOpenChargeableLine] = useState(null); // index of line with Chargeable dropdown open

  // Mutually exclusive: opening one closes the other
  const handleOpenUom = (index) => {
    setOpenUomLine((prev) => (prev === index ? null : index));
    setOpenChargeableLine(null);
  };
  const handleOpenChargeable = (index) => {
    setOpenChargeableLine((prev) => (prev === index ? null : index));
    setOpenUomLine(null);
  };
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdPassNo, setCreatedPassNo] = useState('');
  const [nowStr] = useState(() => new Date());

  useEffect(() => {
    (async () => {
      try {
        const [locs, depts, user, mine] = await Promise.all([
          gatePassAPI.getLocations(),
          gatePassAPI.getDepartments(),
          getCurrentUser(),
          gatePassAPI.getMyLocations().catch(() => ({ locations: [] })),
        ]);
        setLocations(locs);
        setDepartments(depts.departments || []);
        setUsername(user?.username || '');

        // Location: starred default from the user's own assignments wins;
        // GPUs are restricted to their assigned locations.
        const mineList = mine?.locations || [];
        setMyLocations(mineList);
        const starred = mineList.find((l) => l.is_default) || mineList[0];
        if (starred) {
          setLocationCode(starred.location_code);
        } else if (locs.length > 0) {
          setLocationCode(locs[0].location_code);
        }

        // Department: a Gate Pass User's own department is auto-filled and
        // locked (profile is the source of truth). Others start empty and
        // must actively choose — no more silent first-item default.
        const roles = user?.roles || [];
        // LOCKED 14 Jul 2026: department is fixed for EVERY creator —
        // ITA+GPC included. No bypass anywhere.
        const isCreator = roles.includes('gatepasscreator');
        if (isCreator && user?.department) {
          setDepartment(user.department);
          setDeptLocked(true);
        }
      } catch (error) {
        showError(handleAPIError(error));
      } finally {
        setLoadingMasters(false);
      }
    })();
  }, []);

  // ── Navision-style modal pickers (14 Jul 2026) ────────────────────────────
  // Vendor/Customer and Fixed Asset selection happen in LookupModal windows
  // showing the full pipeline columns; after picking, the form shows just
  // the code. Vendor and Customer are mutually exclusive.
  const pickVendor = (vendor) => {
    setSelectedVendor(vendor);
    setSelectedCustomer(null);
    setVendorModalOpen(false);
  };

  const pickCustomer = (customer) => {
    setSelectedCustomer(customer);
    setSelectedVendor(null);
    setCustomerModalOpen(false);
  };

  const pickAsset = (lineIndex, asset) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i === lineIndex
          ? {
              ...l,
              asset_code: asset.asset_code,
              item_type: 'Fixed Asset',
              // Description pre-fills from the master and stays EDITABLE —
              // server keeps the user's text and snapshots fa_class_code.
              description: asset.asset_name,
            }
          : l
      )
    );
    setAssetModalLine(null);
  };

  // Picking an existing item or typing a new name both just set the line's
  // description — the server matches-or-creates the Item master row by
  // that text on submit (item_id is never chosen client-side).
  const pickItem = (lineIndex, name) => {
    setLines((prev) => prev.map((l, i) => (i === lineIndex ? { ...l, description: name } : l)));
    setItemModalLine(null);
  };

  const setLineType = (index, type) => {
    // Switching type resets the code/description pairing:
    // Item = matched/created by name; Fixed Asset = pick from master.
    setLines((prev) => prev.map((l, i) =>
      i === index ? { ...l, item_type: type, asset_code: '', description: '' } : l));
    setOpenTypeLine(null);
  };

  const updateLine = (index, patch) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, EMPTY_LINE()]);

  const removeLine = (index) => {
    if (lines.length === 1) {
      showValidationError('A gate pass needs at least one item line');
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Validate + create + release ───────────────────────────────────────────
  const validate = () => {
    if (!locationCode) return 'Select a location';
    if (!selectedVendor && !selectedCustomer) return 'Select a vendor or a customer from the lookup';
    if (!department) return 'Select a department';
    if (modeOfTransport === 'Vehicle' && !vehicleNo.trim()) {
      return 'Vehicle number is required when mode of transport is Vehicle';
    }
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      if (l.item_type === 'Fixed Asset' && !l.asset_code)
        return `Line ${i + 1}: select an Asset No. from the lookup`;
      if (!l.description.trim()) return `Line ${i + 1}: description is required`;
      const qty = parseInt(l.quantity, 10);
      if (!qty || qty <= 0) return `Line ${i + 1}: quantity must be a positive number`;
    }
    return null;
  };

  const buildPayload = () => ({
    pass_type: passType,
    location_code: locationCode,
    party_type: selectedVendor ? 'Vendor' : 'Customer',
    party_code: selectedVendor ? selectedVendor.vendor_code : selectedCustomer.customer_code,
    department,
    mode_of_transport: modeOfTransport,
    vehicle_no: vehicleNo.trim() || null,
    sender_name: senderName.trim() || null,
    approver_name: approverName.trim() || null,
    expected_inward_date:
      passType === 'R' ? expectedInwardDate.toISOString().split('T')[0] : null,
    remarks: remarks.trim() || null,
    lines: lines.map((l) => ({
      asset_code: l.item_type === 'Fixed Asset' ? (l.asset_code?.trim() || null) : null,
      item_type: l.item_type || null,
      description: l.description.trim(),
      serial_no: l.serial_no?.trim() || null,
      uom: l.uom || 'NOS',
      quantity: parseInt(l.quantity, 10),
      amount: l.amount ? parseFloat(l.amount) : null,
      chargeable: l.chargeable || null,
    })),
  });

  const resetForm = () => {
    setSelectedVendor(null);
    setSelectedCustomer(null);
    setVehicleNo('');
    setSenderName('');
    setApproverName('');
    setRemarks('');
    setLines([EMPTY_LINE()]);
    setCreatedPassNo('');
  };

  const handleCreateAndRelease = () => {
    const error = validate();
    if (error) {
      showValidationError(error);
      return;
    }
    // Confirmation popup before Release (agreed UX safeguard). This is the
    // last cheap moment to catch a mistake: after release there is NO edit —
    // only cancel and recreate.
    confirmAction({
      title: 'Release gate pass?',
      message:
        'After release this pass cannot be modified — only cancelled. ' +
        'It will appear on the security guard’s dispatch list immediately. Continue?',
      confirmText: 'Release',
      cancelText: 'Go back',
      onConfirm: async () => {
        setSubmitting(true);
        try {
          const created = await gatePassAPI.createPass(buildPayload());
          await gatePassAPI.releasePass(created.id);
          setCreatedPassNo(created.gate_pass_no);
          showSuccess('Gate pass released', `Pass number: ${created.gate_pass_no}`);
          resetForm();
          if (onCreated) onCreated();
        } catch (error) {
          showError(handleAPIError(error));
        } finally {
          setSubmitting(false);
        }
      },
    });
  };


  const handleClear = () => {
    confirmAction({
      title: 'Clear form?',
      message: 'All entered data will be cleared.',
      confirmText: 'Clear',
      cancelText: 'Go back',
      destructive: true,
      onConfirm: resetForm,
    });
  };

  if (loadingMasters) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={gp.accent} />
      </View>
    );
  }

  const isReturnable = passType === 'R';

  return (
    <View style={styles.formCard}>
      {/* ── Entry type (wireframe pills + NR/R badge) ── */}
      <View style={styles.toggleRow}>
        <Text style={styles.fieldLabel}>Entry Type:</Text>
        {[
          { key: 'NR', label: 'Non-Returnable' },
          { key: 'R', label: 'Returnable' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={passType === t.key ? styles.toggleActive : styles.toggleInactive}
            onPress={() => setPassType(t.key)}
            accessibilityRole="button"
          >
            <Text style={passType === t.key ? styles.toggleActiveText : styles.toggleInactiveText}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
        <View
          style={[
            styles.typeBadge,
            { backgroundColor: isReturnable ? gp.badgeRBg : gp.badgeNrBg },
          ]}
        >
          <Text
            style={[
              styles.typeBadgeText,
              { color: isReturnable ? gp.badgeRFg : gp.badgeNrFg },
            ]}
          >
            {passType}
          </Text>
        </View>
      </View>

      <View style={styles.noEditBanner}>
        <Text style={styles.noEditBannerText}>
          No edits after creation — a wrong pass must be cancelled and recreated.
        </Text>
      </View>

      {/* ── General Details (wireframe section bar) ── */}
      <View style={styles.sectionBar}>
        <Text style={styles.sectionBarText}>General Details</Text>
      </View>

      <View style={styles.fieldRow}>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabel}>Gate Pass No.</Text>
          <View style={[styles.input, styles.inputDisabled, { justifyContent: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <Text style={createdPassNo ? [styles.passNoText, { color: gp.accent, fontWeight: '700' }] : styles.passNoText}>
              {createdPassNo || 'Auto-generated on submit'}
            </Text>
            {createdPassNo ? (
              <TouchableOpacity onPress={resetForm} style={{ backgroundColor: gp.accent, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>+ New Pass</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabel}>Document Date</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={nowStr.toLocaleDateString()}
            editable={false}
          />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabel}>Document Time</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={nowStr.toLocaleTimeString()}
            editable={false}
          />
        </View>
      </View>

      <View style={[styles.fieldRow, { zIndex: locDropdownOpen ? 200 : 1 }]}>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabel}>Status</Text>
          <TextInput style={[styles.input, styles.inputDisabled]} value="Open" editable={false} />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabel}>User ID</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={username}
            editable={false}
          />
        </View>
        <View style={[styles.fieldThird, { zIndex: locDropdownOpen ? 200 : 20 }]}>
          <Text style={styles.fieldLabel}>Location *</Text>
          <View style={{ position: 'relative', overflow: 'visible' }}>
            <TouchableOpacity
              style={[styles.input, styles.dropdownTrigger]}
              onPress={() => { setLocDropdownOpen((o) => !o); setDeptDropdownOpen(false); }}
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 14, color: locationCode ? gp.text : gp.textMuted }}>
                {locationCode
                  ? `${locationCode} — ${locations.find(l => l.location_code === locationCode)?.location_name || ''}`
                  : '-- Select location --'}
              </Text>
              <Text style={{ color: gp.textMuted, fontSize: 12 }}>{locDropdownOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {locDropdownOpen && (
              <View style={[styles.uomMenu, { left: 0, right: 0, minWidth: '100%' }]}>
                {(deptLocked && myLocations.length
                  ? locations.filter((l) => myLocations.some((m) => m.location_code === l.location_code))
                  : locations
                ).map((loc) => (
                  <TouchableOpacity
                    key={loc.location_code}
                    style={[styles.uomItem, locationCode === loc.location_code && styles.uomItemActive]}
                    onPress={() => { setLocationCode(loc.location_code); setLocDropdownOpen(false); }}
                  >
                    <Text style={[styles.uomItemText, locationCode === loc.location_code && styles.uomItemTextActive]}>
                      {loc.location_code}{loc.location_name ? ` — ${loc.location_name}` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Row: Vendor Code | Customer Code | Party Name ──
          Mutually exclusive: picking one greys out and clears the other. */}
      <View style={styles.fieldRow}>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabel}>Vendor Code {!selectedCustomer ? '*' : ''}</Text>
          <TouchableOpacity
            style={[
              styles.input,
              { justifyContent: 'center' },
              !!selectedCustomer && { backgroundColor: gp.bgMuted || '#f4f6f8' },
            ]}
            onPress={() => { if (!selectedCustomer) setVendorModalOpen(true); }}
            disabled={!!selectedCustomer}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!selectedCustomer }}
          >
            <Text style={{ fontSize: 14, color: selectedVendor ? gp.text : gp.textMuted }}>
              {selectedVendor ? selectedVendor.vendor_code : '-- Select vendor --'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabel}>Customer Code {!selectedVendor ? '*' : ''}</Text>
          <TouchableOpacity
            style={[
              styles.input,
              { justifyContent: 'center' },
              !!selectedVendor && { backgroundColor: gp.bgMuted || '#f4f6f8' },
            ]}
            onPress={() => { if (!selectedVendor) setCustomerModalOpen(true); }}
            disabled={!!selectedVendor}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!selectedVendor }}
          >
            <Text style={{ fontSize: 14, color: selectedCustomer ? gp.text : gp.textMuted }}>
              {selectedCustomer ? selectedCustomer.customer_code : '-- Select customer --'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabel}>Party Name</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={selectedVendor?.vendor_name || selectedCustomer?.customer_name || ''}
            placeholder="Auto-filled from code"
            placeholderTextColor={gp.textMuted}
            editable={false}
          />
        </View>
      </View>

      {/* ── Row: Dept. Code ── */}
      <View style={[styles.fieldRow, { zIndex: deptDropdownOpen ? 190 : 1 }]}>
        <View style={[styles.fieldThird, { zIndex: deptDropdownOpen ? 190 : 10 }]}>
          <Text style={styles.fieldLabel}>Dept. Code *</Text>
          {deptLocked ? (
            <View style={[styles.input, styles.dropdownTrigger, { backgroundColor: gp.bgMuted || '#f4f6f8' }]}>
              <Text style={{ fontSize: 14, color: gp.text }}>{department}</Text>
              <Text style={{ color: gp.textMuted, fontSize: 11 }}>from profile</Text>
            </View>
          ) : (
          <View style={{ position: 'relative', overflow: 'visible' }}>
            <TouchableOpacity
              style={[styles.input, styles.dropdownTrigger]}
              onPress={() => { setDeptDropdownOpen((o) => !o); setLocDropdownOpen(false); }}
              accessibilityRole="button"
              accessibilityState={{ expanded: deptDropdownOpen }}
            >
              <Text style={{ fontSize: 14, color: department ? gp.text : gp.textMuted }}>
                {department || '-- Select --'}
              </Text>
              <Text style={{ color: gp.textMuted, fontSize: 12 }}>{deptDropdownOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {deptDropdownOpen && (
              <View style={[styles.uomMenu, { left: 0, right: 0, minWidth: '100%' }]}>
                {departments.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.uomItem, department === d && styles.uomItemActive]}
                    onPress={() => { setDepartment(d); setDeptDropdownOpen(false); }}
                  >
                    <Text style={[styles.uomItemText, department === d && styles.uomItemTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          )}
        </View>
        <View style={styles.fieldThird} />
        <View style={styles.fieldThird} />
      </View>

      {/* ── Row: Mode of Transport (1/4) | Vehicle No (1/4) | empty (2/4) ── */}
      <View style={styles.fieldRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Mode of Transport *</Text>
          <View style={styles.chipRow}>
            {['Hand Delivery', 'Vehicle'].map((m) => (
              <TouchableOpacity
                key={m}
                style={modeOfTransport === m ? styles.chipActive : styles.chip}
                onPress={() => setModeOfTransport(m)}
              >
                <Text style={modeOfTransport === m ? styles.chipActiveText : styles.chipText}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {modeOfTransport === 'Vehicle' ? (
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Vehicle No. *</Text>
            <TextInput
              style={styles.input}
              value={vehicleNo}
              onChangeText={(v) => setVehicleNo(v.replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. MH12AB1234"
              placeholderTextColor={gp.textMuted}
              autoCapitalize="characters"
              editable
            />
          </View>
        ) : null}
        <View style={{ flex: modeOfTransport === 'Vehicle' ? 2 : 3 }} />
      </View>

      {/* ── Row: Sender Name | Approver Name | Expected Inward Date (R only) ── */}
      <View style={styles.fieldRow}>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabel}>Sender Name</Text>
          <TextInput
            style={styles.input}
            value={senderName}
            onChangeText={setSenderName}
            placeholder="Enter sender name"
            placeholderTextColor={gp.textMuted}
          />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabel}>Approver Name</Text>
          <TextInput
            style={styles.input}
            value={approverName}
            onChangeText={setApproverName}
            placeholder="Enter approver"
            placeholderTextColor={gp.textMuted}
          />
        </View>
        {/* Always reserve the 3rd column — shows date only when Returnable */}
        <View style={styles.fieldThird}>
          {isReturnable && (
            <DateField
              label="Expected Inward Date *"
              value={expectedInwardDate}
              onChange={setExpectedInwardDate}
            />
          )}
        </View>
      </View>

      {/* ── Items table (wireframe: blue header) ── */}
      <View style={styles.sectionBar}>
        <Text style={styles.sectionBarText}>Items</Text>
      </View>
      <View style={styles.itemsTable}>
        {/* Header */}
        <View style={styles.itemsHeaderRow}>
          <Text style={[styles.itemsHeaderCell, { flex: 0.85 }]}>Type</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 1.0 }]}>Asset No.</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 2.0 }]}>Description of Goods</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 0.9 }]}>Serial No.</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 0.35 }]}>Qty</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 0.65 }]}>Unit</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 0.7 }]}>Amount</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 0.8 }]}>Chargeable</Text>
          <Text style={[styles.itemsHeaderCell, { width: 28 }]} />
        </View>

        {lines.map((line, index) => (
          <View
            key={index}
            style={{
              position: 'relative',
              // Lift the whole row above later rows and the Add Line button
              // while one of its dropdown menus is open — otherwise the menu
              // paints underneath them (RN-web sibling stacking).
              zIndex: (openUomLine === index || openChargeableLine === index || openTypeLine === index) ? 300 : 1,
            }}
          >
            {/* Single-row line item */}
            <View style={[styles.itemsRow, { zIndex: (openUomLine === index || openChargeableLine === index || openTypeLine === index) ? 100 : 1 }]}>

              {/* Type — Item (free text) | Fixed Asset (from master) */}
              <View style={[styles.itemsCell, { flex: 0.85, position: 'relative', overflow: 'visible', zIndex: openTypeLine === index ? 300 : 1 }]}>
                <TouchableOpacity
                  style={styles.uomTrigger}
                  onPress={() => setOpenTypeLine(openTypeLine === index ? null : index)}
                >
                  <Text style={styles.uomTriggerText}>{line.item_type || 'Item'}</Text>
                  <Text style={{ fontSize: 9, color: gp.textMuted }}>{openTypeLine === index ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {openTypeLine === index && (
                  <View style={styles.uomMenu}>
                    <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {LINE_TYPES.map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.uomItem, line.item_type === t && styles.uomItemActive]}
                          onPress={() => setLineType(index, t)}
                        >
                          <Text style={[styles.uomItemText, line.item_type === t && styles.uomItemTextActive]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Asset No. — modal picker for Fixed Asset lines; Item lines have no code */}
              <View style={[styles.itemsCell, { flex: 1.0 }]}>
                {line.item_type === 'Fixed Asset' ? (
                  <TouchableOpacity
                    style={[styles.cellInput, { justifyContent: 'center' }]}
                    onPress={() => setAssetModalLine(index)}
                    accessibilityRole="button"
                  >
                    <Text style={{ fontSize: 12, color: line.asset_code ? gp.text : gp.textMuted }} numberOfLines={1}>
                      {line.asset_code || 'Select…'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontSize: 12, color: gp.textMuted, textAlign: 'center' }}>—</Text>
                )}
              </View>

              {/* Description — FA: auto-filled from the master on pick, then
                  editable (user may append detail like "with charger";
                  decision 14 Jul 2026). Item: picked/created via the Item
                  master lookup — shows existing items and lets the user
                  name a new one when the asset they need isn't mastered. */}
              <View style={[styles.itemsCell, { flex: 2.0 }]}>
                {line.item_type === 'Fixed Asset' ? (
                  <TextInput
                    style={styles.cellInput}
                    value={line.description}
                    onChangeText={(v) => updateLine(index, { description: v.slice(0, 250) })}
                    placeholder="Auto-fills from asset master"
                    placeholderTextColor={gp.textMuted}
                  />
                ) : (
                  <TouchableOpacity
                    style={[styles.cellInput, { justifyContent: 'center' }]}
                    onPress={() => setItemModalLine(index)}
                    accessibilityRole="button"
                  >
                    <Text style={{ fontSize: 12, color: line.description ? gp.text : gp.textMuted }} numberOfLines={1}>
                      {line.description || 'Select or add an item…'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Serial No. */}
              <View style={[styles.itemsCell, { flex: 0.9 }]}>
                <TextInput
                  style={styles.cellInput}
                  value={line.serial_no}
                  onChangeText={(v) => updateLine(index, { serial_no: v })}
                  placeholder="Serial"
                  placeholderTextColor={gp.textMuted}
                />
              </View>

              {/* Qty — narrow */}
              <View style={[styles.itemsCell, { flex: 0.35 }]}>
                <TextInput
                  style={styles.cellInput}
                  value={String(line.quantity)}
                  onChangeText={(v) => updateLine(index, { quantity: v.replace(/[^0-9]/g, '') })}
                  placeholder="0"
                  placeholderTextColor={gp.textMuted}
                  keyboardType="numeric"
                />
              </View>

              {/* Unit — inline dropdown */}
              <View style={[styles.itemsCell, { flex: 0.65, position: 'relative', overflow: 'visible' }]}>
                <TouchableOpacity
                  style={styles.uomTrigger}
                  onPress={() => handleOpenUom(index)}
                >
                  <Text style={styles.uomTriggerText}>{line.uom || 'NOS'}</Text>
                  <Text style={{ fontSize: 9, color: gp.textMuted }}>{openUomLine === index ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {openUomLine === index && (
                  <View style={styles.uomMenu}>
                    <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {UOM_OPTIONS.map((u) => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.uomItem, line.uom === u && styles.uomItemActive]}
                          onPress={() => { updateLine(index, { uom: u }); setOpenUomLine(null); }}
                        >
                          <Text style={[styles.uomItemText, line.uom === u && styles.uomItemTextActive]}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Amount */}
              <View style={[styles.itemsCell, { flex: 0.7 }]}>
                <TextInput
                  style={styles.cellInput}
                  value={String(line.amount)}
                  onChangeText={(v) => updateLine(index, { amount: v.replace(/[^0-9.]/g, '') })}
                  placeholder="0.00"
                  placeholderTextColor={gp.textMuted}
                  keyboardType="numeric"
                />
              </View>

              {/* Chargeable — dropdown */}
              <View style={[styles.itemsCell, { flex: 0.8, position: 'relative', overflow: 'visible' }]}>
                <TouchableOpacity
                  style={[
                    styles.uomTrigger,
                    line.chargeable === 'Chargeable' && { borderColor: gp.accent, backgroundColor: '#e8f4ff' },
                    line.chargeable === 'Non-chargeable' && { borderColor: gp.border },
                  ]}
                  onPress={() => handleOpenChargeable(index)}
                >
                  <Text style={[
                    styles.uomTriggerText,
                    { fontSize: 11 },
                    line.chargeable === 'Chargeable' && { color: gp.accent, fontWeight: '600' },
                    line.chargeable === 'Non-chargeable' && { color: gp.textMuted },
                    !line.chargeable && { color: gp.textMuted },
                  ]}>
                    {line.chargeable || '— Select —'}
                  </Text>
                  <Text style={{ fontSize: 9, color: gp.textMuted }}>
                    {openChargeableLine === index ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
                {openChargeableLine === index && (
                  <View style={[styles.uomMenu, { minWidth: 130 }]}>
                    <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {/* Blank / clear option */}
                      <TouchableOpacity
                        style={[styles.uomItem, !line.chargeable && styles.uomItemActive]}
                        onPress={() => { updateLine(index, { chargeable: null }); setOpenChargeableLine(null); }}
                      >
                        <Text style={[styles.uomItemText, !line.chargeable && styles.uomItemTextActive]}>— None —</Text>
                      </TouchableOpacity>
                      {CHARGEABLE_OPTIONS.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.uomItem, line.chargeable === c && styles.uomItemActive]}
                          onPress={() => { updateLine(index, { chargeable: c }); setOpenChargeableLine(null); }}
                        >
                          <Text style={[styles.uomItemText, line.chargeable === c && styles.uomItemTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Remove */}
              <TouchableOpacity
                onPress={() => removeLine(index)}
                style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}
                accessibilityRole="button"
              >
                <Text style={styles.lineRemove}>×</Text>
              </TouchableOpacity>
            </View>

          </View>
        ))}

        {/* Add line button — prominent */}
        <TouchableOpacity
          onPress={addLine}
          style={styles.addLineBtn}
          accessibilityRole="button"
        >
          <Text style={styles.addLineBtnText}>+ Add Line</Text>
        </TouchableOpacity>
      </View>

      {/* Initiator remarks — frozen after creation */}
      <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Remarks</Text>
      <TextInput
        style={[styles.input, styles.remarksInput]}
        value={remarks}
        onChangeText={setRemarks}
        placeholder="Remarks for this pass"
        placeholderTextColor={gp.textMuted}
        multiline
      />

      {/* ── Wireframe action buttons ── */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.wfButton, styles.btnRelease]}
          onPress={handleCreateAndRelease}
          disabled={submitting}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.wfButtonText}>Release</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.wfButton, styles.btnSecondary]}
          onPress={handleClear}
          disabled={submitting}
          accessibilityRole="button"
        >
          <Text style={styles.wfButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.autoFilledNote, { marginTop: 8 }]}>
        Dispatch, Inward and Print become available after release — Dispatch/Inward on the security
        guard's screen, Print from the pass lists.
      </Text>

      {/* ── Navision-style lookup modals ── */}
      <LookupModal
        visible={vendorModalOpen}
        title="Select Vendor"
        keyField="vendor_code"
        columns={[
          { key: 'vendor_code', label: 'No.', flex: 0.9 },
          { key: 'vendor_name', label: 'Name', flex: 2.0 },
          { key: 'city', label: 'City', flex: 1.0 },
          { key: 'post_code', label: 'Post Code', flex: 0.8 },
          { key: 'phone_no', label: 'Phone No.', flex: 1.0 },
          { key: 'contact', label: 'Contact', flex: 1.0 },
        ]}
        fetchRows={(q) => gatePassAPI.searchVendors(q)}
        onPick={pickVendor}
        onClose={() => setVendorModalOpen(false)}
      />
      <LookupModal
        visible={customerModalOpen}
        title="Select Customer"
        keyField="customer_code"
        columns={[
          { key: 'customer_code', label: 'No.', flex: 0.9 },
          { key: 'customer_name', label: 'Name', flex: 2.0 },
          { key: 'city', label: 'City', flex: 1.0 },
          { key: 'post_code', label: 'Post Code', flex: 0.8 },
          { key: 'phone_no', label: 'Phone No.', flex: 1.0 },
          { key: 'contact', label: 'Contact', flex: 1.0 },
        ]}
        fetchRows={(q) => gatePassAPI.searchCustomers(q)}
        onPick={pickCustomer}
        onClose={() => setCustomerModalOpen(false)}
      />
      <LookupModal
        visible={assetModalLine !== null}
        title="Select Fixed Asset"
        keyField="asset_code"
        columns={[
          { key: 'asset_code', label: 'No.', flex: 1.0 },
          { key: 'asset_name', label: 'Description', flex: 2.0 },
          { key: 'fa_class_code', label: 'FA Class Code', flex: 0.9 },
        ]}
        fetchRows={(q) => gatePassAPI.searchAssets(q)}
        onPick={(asset) => pickAsset(assetModalLine, asset)}
        onClose={() => setAssetModalLine(null)}
      />
      <LookupModal
        visible={itemModalLine !== null}
        title="Select or Add Item"
        keyField="item_id"
        columns={[
          { key: 'item_name', label: 'Description of Goods', flex: 1 },
        ]}
        fetchRows={(q) => gatePassAPI.searchItems(q)}
        onPick={(item) => pickItem(itemModalLine, item.item_name)}
        onClose={() => setItemModalLine(null)}
        allowCreate
        onCreate={(name) => pickItem(itemModalLine, name)}
      />
    </View>
  );
};

export default GatePassForm;
