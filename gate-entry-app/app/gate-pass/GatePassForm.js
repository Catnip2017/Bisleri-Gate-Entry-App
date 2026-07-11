// app/gate-pass/GatePassForm.js - Create-once gate pass form (NO EDIT by design).
// Layout follows the approved wireframe: Entry Type pills + NR/R badge,
// "General Details" section bar, field grid (auto-generated pass no, document
// date/time, status, user id, dispatch date/time placeholders), blue items
// table (Description of Goods | Qty | Unit), wireframe action buttons.
// A wrong pass is cancelled and recreated — there is no edit path anywhere.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { gatePassAPI, handleAPIError } from '../../services/api';
import { getCurrentUser } from '../../utils/jwtUtils';
import { showSuccess, showError, showValidationError, confirmAction } from '../../utils/customModal';
import DateField from '../../components/ui/DateField';
import styles, { gp } from './styles/gatePassStyles';

const EMPTY_LINE = () => ({
  item_code: '',
  item_type: null,
  description: '',
  serial_no: '',
  uom: 'NOS',
  quantity: '',
  amount: '',
  chargeable: null,
});

const UOM_OPTIONS = ['NOS', 'KG', 'LTR', 'BOX', 'SET'];
const CHARGEABLE_OPTIONS = ['Chargeable', 'Non-chargeable'];

const GatePassForm = ({ onCreated }) => {
  const [passType, setPassType] = useState('NR');
  const [username, setUsername] = useState('');
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locationCode, setLocationCode] = useState('');
  const [department, setDepartment] = useState('');
  const [partyQuery, setPartyQuery] = useState('');
  const [partyResults, setPartyResults] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [modeOfTransport, setModeOfTransport] = useState('Hand Delivery');
  const [vehicleNo, setVehicleNo] = useState('');
  const [senderName, setSenderName] = useState('');
  const [approverName, setApproverName] = useState('');
  const [expectedInwardDate, setExpectedInwardDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [itemResults, setItemResults] = useState([]);
  const [itemSearchLine, setItemSearchLine] = useState(null);
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
        const [locs, depts, user] = await Promise.all([
          gatePassAPI.getLocations(),
          gatePassAPI.getDepartments(),
          getCurrentUser(),
        ]);
        setLocations(locs);
        setDepartments(depts.departments || []);
        setUsername(user?.username || '');
        if (locs.length > 0) setLocationCode(locs[0].location_code);
        if (depts.departments?.length > 0) setDepartment(depts.departments[0]);
      } catch (error) {
        showError(handleAPIError(error));
      } finally {
        setLoadingMasters(false);
      }
    })();
  }, []);

  // ── Party lookup (code <-> name bidirectional) ────────────────────────────
  const searchParties = useCallback(async (q) => {
    setPartyQuery(q);
    setSelectedParty(null);
    if (!q || q.length < 2) {
      setPartyResults([]);
      return;
    }
    try {
      const results = await gatePassAPI.searchParties(q);
      setPartyResults(results);
    } catch (error) {
      setPartyResults([]);
    }
  }, []);

  const pickParty = (party) => {
    setSelectedParty(party);
    setPartyQuery(`${party.party_code} — ${party.party_name}`);
    setPartyResults([]);
  };

  // ── Item lookup per line ──────────────────────────────────────────────────
  const searchItems = async (lineIndex, q) => {
    updateLine(lineIndex, { item_code: q, item_type: null });
    setItemSearchLine(lineIndex);
    if (!q || q.length < 2) {
      setItemResults([]);
      return;
    }
    try {
      const results = await gatePassAPI.searchItems(q);
      setItemResults(results);
    } catch (error) {
      setItemResults([]);
    }
  };

  const pickItem = (lineIndex, item) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i === lineIndex
          ? {
              ...l,
              item_code: item.item_code,
              item_type: item.item_type,
              description: l.description || item.item_name,
              uom: item.uom || 'NOS',
            }
          : l
      )
    );
    setItemResults([]);
    setItemSearchLine(null);
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
    if (!selectedParty) return 'Select a party from the lookup';
    if (!department) return 'Select a department';
    if (modeOfTransport === 'Vehicle' && !vehicleNo.trim()) {
      return 'Vehicle number is required when mode of transport is Vehicle';
    }
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      if (!l.description.trim()) return `Line ${i + 1}: description is required`;
      const qty = parseInt(l.quantity, 10);
      if (!qty || qty <= 0) return `Line ${i + 1}: quantity must be a positive number`;
    }
    return null;
  };

  const buildPayload = () => ({
    pass_type: passType,
    location_code: locationCode,
    party_code: selectedParty.party_code,
    department,
    mode_of_transport: modeOfTransport,
    vehicle_no: vehicleNo.trim() || null,
    sender_name: senderName.trim() || null,
    approver_name: approverName.trim() || null,
    expected_inward_date:
      passType === 'R' ? expectedInwardDate.toISOString().split('T')[0] : null,
    remarks: remarks.trim() || null,
    lines: lines.map((l) => ({
      item_code: l.item_code?.trim() || null,
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
    setSelectedParty(null);
    setPartyQuery('');
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
                {locations.map((loc) => (
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

      {/* Party lookup */}
      <View style={[styles.fieldRow, { zIndex: partyResults.length > 0 ? 150 : 1 }]}>
        <View style={[styles.fieldHalf, { zIndex: partyResults.length > 0 ? 150 : 1 }]}>
          <Text style={styles.fieldLabel}>Party Code *</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={styles.input}
              value={partyQuery}
              onChangeText={searchParties}
              placeholder="-- Select (type code or name) --"
              placeholderTextColor={gp.textMuted}
            />
            {partyResults.length > 0 && (
              <View style={styles.lookupPanel}>
                {partyResults.map((p) => (
                  <TouchableOpacity key={p.party_code} style={styles.lookupRow} onPress={() => pickParty(p)}>
                    <Text style={styles.lookupCode}>{p.party_code}</Text>
                    <Text style={styles.lookupName}>{p.party_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Party Name</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={selectedParty?.party_name || ''}
            placeholder="Auto-filled from code"
            placeholderTextColor={gp.textMuted}
            editable={false}
          />
        </View>
      </View>

      <View style={[styles.fieldRow, { zIndex: deptDropdownOpen ? 190 : 1 }]}>
        <View style={[styles.fieldThird, { zIndex: deptDropdownOpen ? 190 : 10 }]}>
          <Text style={styles.fieldLabel}>Dept. Code *</Text>
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
        </View>
        <View style={styles.fieldThird}>
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
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabel}>
            Vehicle No. {modeOfTransport === 'Vehicle' ? '*' : ''}
          </Text>
          <TextInput
            style={[styles.input, modeOfTransport !== 'Vehicle' && styles.inputDisabled]}
            value={vehicleNo}
            onChangeText={(v) => setVehicleNo(v.replace(/[^A-Z0-9]/g, ''))}
            placeholder={modeOfTransport === 'Vehicle' ? 'e.g. MH12AB1234' : 'N/A'}
            placeholderTextColor={gp.textMuted}
            autoCapitalize="characters"
            editable={modeOfTransport === 'Vehicle'}
          />
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Sender Name</Text>
          <TextInput
            style={styles.input}
            value={senderName}
            onChangeText={setSenderName}
            placeholder="Enter sender name"
            placeholderTextColor={gp.textMuted}
          />
        </View>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Approver Name</Text>
          <TextInput
            style={styles.input}
            value={approverName}
            onChangeText={setApproverName}
            placeholder="Enter approver"
            placeholderTextColor={gp.textMuted}
          />
        </View>
      </View>

      {isReturnable && (
        <View style={styles.fieldRow}>
          <View style={styles.fieldThird}>
            <DateField
              label="Expected Inward Date *"
              value={expectedInwardDate}
              onChange={setExpectedInwardDate}
            />
          </View>
        </View>
      )}

      {/* ── Items table (wireframe: blue header) ── */}
      <View style={styles.sectionBar}>
        <Text style={styles.sectionBarText}>Items</Text>
      </View>
      <View style={styles.itemsTable}>
        {/* Header */}
        <View style={styles.itemsHeaderRow}>
          <Text style={[styles.itemsHeaderCell, { flex: 1.0 }]}>Item Code</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 2.0 }]}>Description of Goods</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 0.9 }]}>Serial No.</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 0.35 }]}>Qty</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 0.65 }]}>Unit</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 0.7 }]}>Amount</Text>
          <Text style={[styles.itemsHeaderCell, { flex: 0.8 }]}>Chargeable</Text>
          <Text style={[styles.itemsHeaderCell, { width: 28 }]} />
        </View>

        {lines.map((line, index) => (
          <View key={index} style={{ position: 'relative' }}>
            {/* Single-row line item */}
            <View style={[styles.itemsRow, { zIndex: (openUomLine === index || openChargeableLine === index) ? 100 : 1 }]}>

              {/* Item Code */}
              <View style={[styles.itemsCell, { flex: 1.0 }]}>
                <TextInput
                  style={styles.cellInput}
                  value={line.item_code}
                  onChangeText={(q) => searchItems(index, q)}
                  placeholder="Code"
                  placeholderTextColor={gp.textMuted}
                  autoCapitalize="characters"
                />
              </View>

              {/* Description */}
              <View style={[styles.itemsCell, { flex: 2.0 }]}>
                <TextInput
                  style={styles.cellInput}
                  value={line.description}
                  onChangeText={(v) => updateLine(index, { description: v.slice(0, 250) })}
                  placeholder="Description"
                  placeholderTextColor={gp.textMuted}
                />
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

            {/* Item search results — anchored to row wrapper (position:relative above) */}
            {itemSearchLine === index && itemResults.length > 0 && (
              <View style={[styles.lookupPanel, { left: 4, right: 'auto', minWidth: 300 }]}>
                {itemResults.map((it) => (
                  <TouchableOpacity key={it.item_code} style={styles.lookupRow} onPress={() => pickItem(index, it)}>
                    <Text style={styles.lookupCode}>{it.item_code}</Text>
                    <Text style={styles.lookupName}>{it.item_name}{it.item_type ? ` (${it.item_type})` : ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
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
    </View>
  );
};

export default GatePassForm;
