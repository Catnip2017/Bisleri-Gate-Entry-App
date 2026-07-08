// app/gate-pass/GatePassForm.js - Create-once gate pass form (NO EDIT by design).
// The user fills the form and either releases it to security or cancels it.
// A wrong pass is cancelled and recreated — there is no edit path anywhere.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { gatePassAPI, handleAPIError } from '../../services/api';
import { showSuccess, showError, showValidationError, confirmAction } from '../../utils/customModal';
import AppButton from '../../components/ui/AppButton';
import DateField from '../../components/ui/DateField';
import { colors } from '../../utils/theme';
import styles from './styles/gatePassStyles';

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

const GatePassForm = ({ onCreated }) => {
  const [passType, setPassType] = useState('NR');
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
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [locs, depts] = await Promise.all([
          gatePassAPI.getLocations(),
          gatePassAPI.getDepartments(),
        ]);
        setLocations(locs);
        setDepartments(depts.departments || []);
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
  const searchItems = useCallback(async (lineIndex, q) => {
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
  }, [lines]);

  const pickItem = (lineIndex, item) => {
    updateLine(lineIndex, {
      item_code: item.item_code,
      item_type: item.item_type,
      description: lines[lineIndex].description || item.item_name,
      uom: item.uom || 'NOS',
    });
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

  const handleSaveOpen = async () => {
    const error = validate();
    if (error) {
      showValidationError(error);
      return;
    }
    setSubmitting(true);
    try {
      const created = await gatePassAPI.createPass(buildPayload());
      showSuccess(
        'Gate pass created',
        `Pass number: ${created.gate_pass_no}\nStatus: Open — release it from My Passes when ready.`
      );
      resetForm();
      if (onCreated) onCreated();
    } catch (error) {
      showError(handleAPIError(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMasters) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.formCard}>
      {/* Entry type toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.fieldLabel}>Entry type</Text>
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
      </View>

      <View style={styles.noEditBanner}>
        <Text style={styles.noEditBannerText}>
          No edits after creation — a wrong pass must be cancelled and recreated.
        </Text>
      </View>

      {/* Location + department */}
      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Location *</Text>
          <View style={styles.chipRow}>
            {locations.map((loc) => (
              <TouchableOpacity
                key={loc.location_code}
                style={locationCode === loc.location_code ? styles.chipActive : styles.chip}
                onPress={() => setLocationCode(loc.location_code)}
              >
                <Text style={locationCode === loc.location_code ? styles.chipActiveText : styles.chipText}>
                  {loc.location_code}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Department *</Text>
          <View style={styles.chipRow}>
            {departments.map((d) => (
              <TouchableOpacity
                key={d}
                style={department === d ? styles.chipActive : styles.chip}
                onPress={() => setDepartment(d)}
              >
                <Text style={department === d ? styles.chipActiveText : styles.chipText}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Party lookup */}
      <Text style={styles.fieldLabel}>Party (code or name) *</Text>
      <TextInput
        style={styles.input}
        value={partyQuery}
        onChangeText={searchParties}
        placeholder="Type at least 2 characters to search"
        placeholderTextColor={colors.textMuted}
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
      {selectedParty && (
        <Text style={styles.autoFilledNote}>Party name auto-filled: {selectedParty.party_name}</Text>
      )}

      {/* Transport */}
      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Mode of transport *</Text>
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
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>
            Vehicle no. {modeOfTransport === 'Vehicle' ? '*' : '(optional)'}
          </Text>
          <TextInput
            style={styles.input}
            value={vehicleNo}
            onChangeText={setVehicleNo}
            placeholder="MH01AB1234"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />
        </View>
      </View>

      {/* Sender / approver */}
      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Sender name (optional)</Text>
          <TextInput
            style={styles.input}
            value={senderName}
            onChangeText={setSenderName}
            placeholder="Enter sender name"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.fieldHalf}>
          <Text style={styles.fieldLabel}>Approver name (optional)</Text>
          <TextInput
            style={styles.input}
            value={approverName}
            onChangeText={setApproverName}
            placeholder="Enter approver name"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      {/* Expected inward date — returnable only */}
      {passType === 'R' && (
        <View style={styles.fieldHalf}>
          <DateField
            label="Expected inward date *"
            value={expectedInwardDate}
            onChange={setExpectedInwardDate}
          />
        </View>
      )}

      {/* Item lines */}
      <Text style={styles.sectionTitle}>Items</Text>
      {lines.map((line, index) => (
        <View key={index} style={styles.lineCard}>
          <View style={styles.lineHeader}>
            <Text style={styles.lineTitle}>Line {index + 1}</Text>
            <TouchableOpacity onPress={() => removeLine(index)} accessibilityRole="button">
              <Text style={styles.lineRemove}>Remove</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Item code (blank if none)</Text>
              <TextInput
                style={styles.input}
                value={line.item_code}
                onChangeText={(q) => searchItems(index, q)}
                placeholder="e.g. FA-COM-0412"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
              {itemSearchLine === index && itemResults.length > 0 && (
                <View style={styles.lookupPanel}>
                  {itemResults.map((it) => (
                    <TouchableOpacity
                      key={it.item_code}
                      style={styles.lookupRow}
                      onPress={() => pickItem(index, it)}
                    >
                      <Text style={styles.lookupCode}>{it.item_code}</Text>
                      <Text style={styles.lookupName}>
                        {it.item_name} ({it.item_type})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Serial no. (optional)</Text>
              <TextInput
                style={styles.input}
                value={line.serial_no}
                onChangeText={(v) => updateLine(index, { serial_no: v })}
                placeholder="Serial number"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
          <Text style={styles.fieldLabel}>Description * (max 250 chars)</Text>
          <TextInput
            style={styles.input}
            value={line.description}
            onChangeText={(v) => updateLine(index, { description: v.slice(0, 250) })}
            placeholder="Description of goods"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.fieldRow}>
            <View style={styles.fieldThird}>
              <Text style={styles.fieldLabel}>Qty *</Text>
              <TextInput
                style={styles.input}
                value={String(line.quantity)}
                onChangeText={(v) => updateLine(index, { quantity: v.replace(/[^0-9]/g, '') })}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.fieldThird}>
              <Text style={styles.fieldLabel}>Unit</Text>
              <View style={styles.chipRow}>
                {UOM_OPTIONS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={line.uom === u ? styles.chipActiveSmall : styles.chipSmall}
                    onPress={() => updateLine(index, { uom: u })}
                  >
                    <Text style={line.uom === u ? styles.chipActiveText : styles.chipText}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.fieldThird}>
              <Text style={styles.fieldLabel}>Amount (optional)</Text>
              <TextInput
                style={styles.input}
                value={String(line.amount)}
                onChangeText={(v) => updateLine(index, { amount: v.replace(/[^0-9.]/g, '') })}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={styles.chipRow}>
            {['Chargeable', 'Non-chargeable'].map((c) => (
              <TouchableOpacity
                key={c}
                style={line.chargeable === c ? styles.chipActiveSmall : styles.chipSmall}
                onPress={() => updateLine(index, { chargeable: line.chargeable === c ? null : c })}
              >
                <Text style={line.chargeable === c ? styles.chipActiveText : styles.chipText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <AppButton title="Add line" icon="add" variant="secondary" onPress={addLine} style={styles.addLineButton} />

      {/* Initiator remarks — frozen after creation */}
      <Text style={styles.fieldLabel}>Remarks (optional)</Text>
      <TextInput
        style={[styles.input, styles.remarksInput]}
        value={remarks}
        onChangeText={setRemarks}
        placeholder="Remarks for this pass"
        placeholderTextColor={colors.textMuted}
        multiline
      />

      {/* Actions */}
      <View style={styles.actionRow}>
        <AppButton
          title="Release to security"
          icon="send"
          variant="primary"
          onPress={handleCreateAndRelease}
          loading={submitting}
        />
        <AppButton
          title="Save as Open"
          icon="save"
          variant="secondary"
          onPress={handleSaveOpen}
          loading={submitting}
        />
      </View>
    </View>
  );
};

export default GatePassForm;
