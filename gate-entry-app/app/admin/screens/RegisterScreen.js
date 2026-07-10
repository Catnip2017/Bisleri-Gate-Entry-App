import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { adminAPI, gatePassAPI, handleAPIError } from '../../../services/api';
import styles from '../styles/RegisterScreenStyle';
import {
  validateUsername, validatePassword,
  validateName, validatePasswordMatch,
} from '../utils/validation';
import { showAlert } from '../../../utils/customModal';

const DEPARTMENTS = ['IT', 'Finance', 'Sales', 'Marketing', 'Admin', 'HR'];
const ALL_ROLES   = ['Security Guard', 'Security Admin', 'IT Admin', 'Gate Pass User', 'Co Packer'];
const GUARD_ROLES = ['Security Guard', 'Security Admin'];

const EMPTY_FORM = {
  username: '', password: '', confirmPassword: '',
  firstName: '', lastName: '', email: '', phone_number: '',
  warehouseCode: '', warehouseName: '', siteCode: '',
  copackerLocation: '', department: '', gatePassLocation: '',
};

// ── Simple Dropdown ────────────────────────────────────────────────────────
function Dropdown({ label, value, options, onSelect, placeholder = 'Select...' }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <View style={{ marginBottom: 14, zIndex: open ? 999 : 1 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={styles.dropdownTrigger}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.8}
      >
        <Text style={[styles.dropdownTriggerText, !selected && { color: '#aaa' }]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={{ color: '#888', fontSize: 12 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownMenu}>
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.dropdownMenuItem, value === opt.value && styles.dropdownMenuItemActive]}
                onPress={() => { onSelect(opt.value); setOpen(false); }}
              >
                <Text style={[styles.dropdownMenuItemText, value === opt.value && styles.dropdownMenuItemTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const [formData, setFormData]             = useState({ ...EMPTY_FORM });
  const [selectedRoles, setSelectedRoles]   = useState([]);
  const [warehouses, setWarehouses]         = useState([]);
  const [gpLocations, setGpLocations]       = useState([]);
  const [loading, setLoading]               = useState(false);
  const [warehouseText, setWarehouseText]   = useState('');
  const [showWHDrop, setShowWHDrop]         = useState(false);
  const [filteredWH, setFilteredWH]         = useState([]);

  useEffect(() => {
    adminAPI.getWarehouses().then(setWarehouses).catch(() => {});
    gatePassAPI.getLocations().then(d => setGpLocations(d || [])).catch(() => {});
  }, []);

  const set = (field, value) => setFormData(p => ({ ...p, [field]: value }));

  // ── Role toggle ────────────────────────────────────────────────────────────
  const toggleRole = (role) => {
    setSelectedRoles(prev => {
      if (role === 'Co Packer') {
        if (prev.includes('Co Packer')) return [];            // deselect
        if (prev.length > 0) {
          // other roles already selected → warn
          showAlert(
            'Exclusive Role',
            'Co Packer cannot be combined with other roles. Selecting it will clear all current selections.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Select Co Packer', onPress: () => setSelectedRoles(['Co Packer']) },
            ]
          );
          return prev;                                        // don't change yet — alert handles it
        }
        return ['Co Packer'];
      }
      // Non-Co-Packer
      const withoutCP = prev.filter(r => r !== 'Co Packer');
      return withoutCP.includes(role)
        ? withoutCP.filter(r => r !== role)
        : [...withoutCP, role];
    });
  };

  // ── Warehouse autocomplete ─────────────────────────────────────────────────
  const onWarehouseType = (text) => {
    setWarehouseText(text);
    set('warehouseCode', ''); set('warehouseName', ''); set('siteCode', '');
    if (!text.trim()) { setFilteredWH([]); setShowWHDrop(false); return; }
    const term = text.toLowerCase();
    const f = warehouses.filter(w =>
      w.warehouse_code?.toLowerCase().includes(term) ||
      w.warehouse_name?.toLowerCase().includes(term)
    );
    setFilteredWH(f); setShowWHDrop(f.length > 0);
  };
  const pickWarehouse = (w) => {
    setWarehouseText(w.warehouse_code);
    setFormData(p => ({ ...p, warehouseCode: w.warehouse_code, warehouseName: w.warehouse_name, siteCode: w.site_code }));
    setShowWHDrop(false); setFilteredWH([]);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const needsWH      = selectedRoles.some(r => GUARD_ROLES.includes(r));
  const needsGP      = selectedRoles.includes('Gate Pass User');
  const needsCP      = selectedRoles.includes('Co Packer');
  const needsScope   = needsWH || needsGP || needsCP;
  const cpSelected   = selectedRoles.includes('Co Packer');
  const hasNonCP     = selectedRoles.some(r => r !== 'Co Packer');

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!selectedRoles.length) { showAlert('Error', 'Select at least one role'); return; }
    for (const err of [
      validateUsername(formData.username),
      validateName(formData.firstName, 'First name'),
      validateName(formData.lastName, 'Last name'),
      validatePassword(formData.password),
      validatePasswordMatch(formData.password, formData.confirmPassword),
    ]) { if (err) { showAlert('Validation Error', err); return; } }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      showAlert('Validation Error', 'Enter a valid email'); return;
    }
    if (formData.phone_number && !/^\d{10}$/.test(formData.phone_number)) {
      showAlert('Validation Error', 'Enter a valid 10-digit mobile'); return;
    }
    if (needsWH && !formData.warehouseName) { showAlert('Validation Error', 'Select a valid warehouse'); return; }
    if (needsCP && !formData.copackerLocation.trim()) { showAlert('Validation Error', 'Copacker location is required'); return; }
    if (needsGP && !formData.department) { showAlert('Validation Error', 'Department is required'); return; }
    if (needsGP && !formData.gatePassLocation) { showAlert('Validation Error', 'Gate Pass Location is required'); return; }

    setLoading(true);
    try {
      const payload = {
        username: formData.username.trim(),
        password: formData.password,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        role: selectedRoles.join(', '),
        ...(needsWH && { warehouse_code: formData.warehouseCode, site_code: formData.siteCode }),
        ...(needsCP && { copacker_location: formData.copackerLocation.trim() }),
        ...(needsGP && { department: formData.department, gate_pass_location: formData.gatePassLocation }),
        ...(formData.email?.trim()        && { email: formData.email.trim() }),
        ...(formData.phone_number?.trim() && { phone_number: formData.phone_number.trim() }),
      };
      const res = await adminAPI.registerUser(payload);
      showAlert('Success', res.message || 'User registered!', [
        { text: 'OK', onPress: () => { setFormData({ ...EMPTY_FORM }); setSelectedRoles([]); setWarehouseText(''); } },
      ]);
    } catch (e) {
      showAlert('Registration Error', handleAPIError(e));
    } finally {
      setLoading(false);
    }
  };

  // ── Dropdown options ───────────────────────────────────────────────────────
  const deptOptions = DEPARTMENTS.map(d => ({ label: d, value: d }));
  const gpLocOptions = gpLocations.map(l => ({
    label: `${l.location_code} — ${l.location_name}`,
    value: l.location_code,
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>

        {/* Auth badge */}
        <View style={styles.authBadge}>
          <Text style={styles.authBadgeText}>🔒 Local / Contractor Account</Text>
          <Text style={styles.authBadgeNote}> — password login only. For company employees use Assign Access.</Text>
        </View>

        {/* ── 3-column layout ── */}
        <View style={styles.columns}>

          {/* COL 1: Roles */}
          <View style={styles.roleCol}>
            <Text style={styles.sectionTitle}>ROLE</Text>
            {ALL_ROLES.map(role => {
              const active   = selectedRoles.includes(role);
              const isCp     = role === 'Co Packer';
              // Grey out Co Packer when others are selected; grey out others when Co Packer is selected
              const disabled = (isCp && hasNonCP && !active) || (!isCp && cpSelected && !active);

              return (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleBtn, active && styles.roleBtnActive, disabled && styles.roleBtnDisabled]}
                  onPress={() => toggleRole(role)}
                  activeOpacity={disabled ? 1 : 0.7}
                >
                  {/* Unified checkbox for all roles */}
                  <View style={[styles.checkbox, {
                    borderColor: disabled ? '#ccc' : active ? '#1976d2' : '#999',
                    backgroundColor: active ? '#1976d2' : 'transparent',
                  }]}>
                    {active && <Text style={styles.checkTick}>✓</Text>}
                  </View>
                  <Text style={[
                    styles.roleBtnText,
                    active && styles.roleBtnTextActive,
                    disabled && styles.roleBtnTextDisabled,
                  ]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.roleHint}>
              Tap to select · Tap again to deselect{'\n'}Co Packer cannot be combined
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.vDivider} />

          {/* COL 2: Personal Details */}
          <View style={styles.detailsCol}>
            <Text style={styles.sectionTitle}>PERSONAL DETAILS</Text>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput style={styles.input} placeholder="First Name"
                  value={formData.firstName} onChangeText={v => set('firstName', v)} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Last Name *</Text>
                <TextInput style={styles.input} placeholder="Last Name"
                  value={formData.lastName} onChangeText={v => set('lastName', v)} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Username *</Text>
                <TextInput style={styles.input} placeholder="Username"
                  value={formData.username} onChangeText={v => set('username', v)} autoCapitalize="none" />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Mobile Number</Text>
                <TextInput style={styles.input} placeholder="10-digit mobile"
                  value={formData.phone_number}
                  onChangeText={v => set('phone_number', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad" maxLength={10} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Password *</Text>
                <TextInput style={styles.input} placeholder="Password" secureTextEntry
                  value={formData.password} onChangeText={v => set('password', v)} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password *</Text>
                <TextInput style={styles.input} placeholder="Confirm Password" secureTextEntry
                  value={formData.confirmPassword} onChangeText={v => set('confirmPassword', v)} />
              </View>
            </View>

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} placeholder="Email (optional)"
              value={formData.email} onChangeText={v => set('email', v)}
              keyboardType="email-address" autoCapitalize="none" />

            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerButtonDisabled]}
              onPress={handleRegister} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.registerText}>Register Contractor</Text>}
            </TouchableOpacity>
          </View>

          {/* COL 3: Scope (only when roles need it) */}
          {needsScope && (
            <>
              <View style={styles.vDivider} />
              <View style={styles.scopeCol}>
                <Text style={styles.sectionTitle}>SCOPE</Text>

                {/* Warehouse */}
                {needsWH && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.scopeSubtitle}>Warehouse *</Text>
                    <View style={styles.whContainer}>
                      <TextInput
                        style={[styles.input, { marginBottom: 0 }]}
                        placeholder="Type code or name..."
                        value={warehouseText}
                        onChangeText={onWarehouseType}
                        autoCapitalize="characters"
                      />
                      {showWHDrop && (
                        <View style={styles.whDropdown}>
                          <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                            {filteredWH.map(w => (
                              <TouchableOpacity key={w.warehouse_code} style={styles.whDropdownItem}
                                onPress={() => pickWarehouse(w)}>
                                <Text style={styles.whCode}>{w.warehouse_code}</Text>
                                <Text style={styles.whName}>{w.warehouse_name}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.disabledLabel}>Name</Text>
                        <TextInput style={[styles.input, styles.inputDisabled, { marginBottom: 0 }]}
                          value={formData.warehouseName} editable={false} />
                      </View>
                      <View style={{ width: 80 }}>
                        <Text style={styles.disabledLabel}>Site Code</Text>
                        <TextInput style={[styles.input, styles.inputDisabled, { marginBottom: 0 }]}
                          value={formData.siteCode} editable={false} />
                      </View>
                    </View>
                  </View>
                )}

                {/* Gate Pass User */}
                {needsGP && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.scopeSubtitle}>Gate Pass User</Text>
                    <Dropdown
                      label="Department *"
                      value={formData.department}
                      options={deptOptions}
                      onSelect={v => set('department', v)}
                      placeholder="Select department..."
                    />
                    <Dropdown
                      label="Gate Pass Location *"
                      value={formData.gatePassLocation}
                      options={gpLocOptions}
                      onSelect={v => set('gatePassLocation', v)}
                      placeholder="Select location..."
                    />
                  </View>
                )}

                {/* Co Packer */}
                {needsCP && (
                  <View>
                    <Text style={styles.scopeSubtitle}>Co Packer</Text>
                    <View style={styles.cpNote}>
                      <Text style={styles.cpNoteText}>⚠ Exclusive role — no other roles allowed</Text>
                    </View>
                    <Text style={styles.label}>Copacker Location *</Text>
                    <TextInput style={styles.input} placeholder="Enter copacker location..."
                      value={formData.copackerLocation} onChangeText={v => set('copackerLocation', v)} />
                  </View>
                )}

                {/* IT Admin only */}
                {selectedRoles.length === 1 && selectedRoles[0] === 'IT Admin' && (
                  <View style={styles.itNote}>
                    <Text style={styles.itNoteText}>System-wide access.{'\n'}No scope required.</Text>
                  </View>
                )}
              </View>
            </>
          )}

        </View>
      </View>
    </ScrollView>
  );
}
