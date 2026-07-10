import React, { useState, useEffect } from 'react';
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

export default function RegisterScreen() {
  const [formData, setFormData]               = useState({ ...EMPTY_FORM });
  const [selectedRoles, setSelectedRoles]     = useState([]);
  const [warehouses, setWarehouses]           = useState([]);
  const [gpLocations, setGpLocations]         = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [warehouseText, setWarehouseText]     = useState('');
  const [showWHDropdown, setShowWHDropdown]   = useState(false);
  const [filteredWH, setFilteredWH]           = useState([]);

  useEffect(() => {
    adminAPI.getWarehouses().then(setWarehouses).catch(() => {});
    gatePassAPI.getLocations().then(d => setGpLocations(d || [])).catch(() => {});
  }, []);

  const set = (field, value) => setFormData(p => ({ ...p, [field]: value }));

  // ── Role toggle ────────────────────────────────────────────────────────────
  const toggleRole = (role) => {
    setSelectedRoles(prev => {
      if (role === 'Co Packer') return prev.includes('Co Packer') ? [] : ['Co Packer'];
      const without = prev.filter(r => r !== 'Co Packer');
      return without.includes(role) ? without.filter(r => r !== role) : [...without, role];
    });
  };

  // ── Warehouse autocomplete ─────────────────────────────────────────────────
  const onWarehouseType = (text) => {
    setWarehouseText(text);
    set('warehouseCode', ''); set('warehouseName', ''); set('siteCode', '');
    if (!text.trim()) { setFilteredWH([]); setShowWHDropdown(false); return; }
    const term = text.toLowerCase();
    const f = warehouses.filter(w =>
      w.warehouse_code?.toLowerCase().includes(term) ||
      w.warehouse_name?.toLowerCase().includes(term)
    );
    setFilteredWH(f); setShowWHDropdown(f.length > 0);
  };

  const pickWarehouse = (w) => {
    setWarehouseText(w.warehouse_code);
    setFormData(p => ({ ...p, warehouseCode: w.warehouse_code, warehouseName: w.warehouse_name, siteCode: w.site_code }));
    setShowWHDropdown(false); setFilteredWH([]);
  };

  // ── Derived flags ──────────────────────────────────────────────────────────
  const needsWH       = selectedRoles.some(r => GUARD_ROLES.includes(r));
  const needsGP       = selectedRoles.includes('Gate Pass User');
  const needsCP       = selectedRoles.includes('Co Packer');
  const needsScope    = needsWH || needsGP || needsCP;
  const itAdminOnly   = selectedRoles.length === 1 && selectedRoles[0] === 'IT Admin';

  // ── Validate & submit ──────────────────────────────────────────────────────
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
    if (needsWH && !formData.warehouseName) {
      showAlert('Validation Error', 'Select a valid warehouse'); return;
    }
    if (needsCP && !formData.copackerLocation.trim()) {
      showAlert('Validation Error', 'Copacker location is required'); return;
    }
    if (needsGP && !formData.department) {
      showAlert('Validation Error', 'Department is required for Gate Pass User'); return;
    }
    if (needsGP && !formData.gatePassLocation) {
      showAlert('Validation Error', 'Gate Pass Location is required'); return;
    }

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>

        {/* Auth badge */}
        <View style={styles.authBadge}>
          <Text style={styles.authBadgeText}>🔒 Local / Contractor Account</Text>
          <Text style={styles.authBadgeNote}> — password login only. For company employees use Assign Access.</Text>
        </View>

        {/* ── TOP ROW: Role (left) | Personal Details (right) ── */}
        <View style={styles.topRow}>

          {/* Left: Roles */}
          <View style={styles.rolePanel}>
            <Text style={styles.sectionTitle}>ROLE</Text>
            {ALL_ROLES.map(role => {
              const active    = selectedRoles.includes(role);
              const isCp      = role === 'Co Packer';
              const disabled  = (isCp && !active && selectedRoles.some(r => r !== 'Co Packer'))
                             || (!isCp && !active && selectedRoles.includes('Co Packer'));
              return (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleBtn, active && styles.roleBtnActive, disabled && styles.roleBtnDisabled]}
                  onPress={() => !disabled && toggleRole(role)}
                  disabled={disabled}
                >
                  <View style={[styles.roleCheck, isCp && styles.roleCheckCircle, {
                    borderColor: disabled ? '#ccc' : active ? '#1976d2' : '#aaa',
                    backgroundColor: active ? '#1976d2' : 'transparent',
                  }]}>
                    {active && <Text style={styles.roleCheckTick}>✓</Text>}
                  </View>
                  <Text style={[styles.roleBtnText, active && styles.roleBtnTextActive, disabled && styles.roleBtnTextDisabled]}>
                    {role}
                  </Text>
                  {isCp && <Text style={[styles.exclusiveTag, { color: disabled ? '#ccc' : '#b45309' }]}>excl.</Text>}
                </TouchableOpacity>
              );
            })}

            {itAdminOnly && (
              <View style={styles.itAdminNote}>
                <Text style={styles.itAdminNoteText}>System-wide access. No scope needed.</Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.vDivider} />

          {/* Right: Personal Details */}
          <View style={styles.detailsPanel}>
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
        </View>

        {/* ── BOTTOM: Scope (full-width, side-by-side if multiple) ── */}
        {needsScope && (
          <>
            <View style={styles.hDivider} />
            <View style={styles.scopeRow}>

              {/* Warehouse scope */}
              {needsWH && (
                <View style={[styles.scopeBlock, needsGP && { flex: 1 }]}>
                  <Text style={styles.sectionTitle}>SCOPE — WAREHOUSE</Text>
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={[styles.input, { marginBottom: 0 }]}
                      placeholder="Type warehouse code or name..."
                      value={warehouseText}
                      onChangeText={onWarehouseType}
                      autoCapitalize="characters"
                    />
                    {showWHDropdown && (
                      <View style={styles.dropdown}>
                        <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                          {filteredWH.map(w => (
                            <TouchableOpacity key={w.warehouse_code} style={styles.dropdownItem} onPress={() => pickWarehouse(w)}>
                              <Text style={styles.dropdownItemCode}>{w.warehouse_code}</Text>
                              <Text style={styles.dropdownItemName}>{w.warehouse_name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { fontSize: 11, color: '#777', marginTop: 4 }]}>Name</Text>
                      <TextInput style={[styles.input, styles.inputDisabled, { marginBottom: 0 }]}
                        value={formData.warehouseName} editable={false} />
                    </View>
                    <View style={{ width: 90 }}>
                      <Text style={[styles.label, { fontSize: 11, color: '#777', marginTop: 4 }]}>Site Code</Text>
                      <TextInput style={[styles.input, styles.inputDisabled, { marginBottom: 0 }]}
                        value={formData.siteCode} editable={false} />
                    </View>
                  </View>
                </View>
              )}

              {/* Vertical divider between scope blocks */}
              {needsWH && needsGP && <View style={[styles.vDivider, { marginHorizontal: 16 }]} />}

              {/* Gate Pass scope */}
              {needsGP && (
                <View style={[styles.scopeBlock, needsWH && { flex: 1 }]}>
                  <Text style={styles.sectionTitle}>SCOPE — GATE PASS USER</Text>
                  <Text style={styles.label}>Department *</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {DEPARTMENTS.map(dept => {
                      const active = formData.department === dept;
                      return (
                        <TouchableOpacity key={dept}
                          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
                            borderWidth: 1.5, borderColor: active ? '#1976d2' : '#ccc',
                            backgroundColor: active ? '#e8f1fb' : '#f5f5f5' }}
                          onPress={() => set('department', dept)}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#1565c0' : '#666' }}>{dept}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.label}>Gate Pass Location *</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {gpLocations.map(loc => {
                      const active = formData.gatePassLocation === loc.location_code;
                      return (
                        <TouchableOpacity key={loc.location_code}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
                            borderWidth: 1.5, borderColor: active ? '#1976d2' : '#ccc',
                            backgroundColor: active ? '#e8f1fb' : '#f5f5f5',
                            flexDirection: 'row', alignItems: 'center', gap: 5 }}
                          onPress={() => set('gatePassLocation', loc.location_code)}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2,
                            borderColor: active ? '#1976d2' : '#aaa', backgroundColor: active ? '#1976d2' : 'transparent' }} />
                          <Text style={{ fontSize: 12, color: active ? '#1565c0' : '#555', fontWeight: active ? '600' : '400' }}>
                            {loc.location_code} — {loc.location_name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {gpLocations.length === 0 && <Text style={{ fontSize: 12, color: '#aaa' }}>Loading...</Text>}
                  </View>
                </View>
              )}

              {/* Co Packer scope */}
              {needsCP && (
                <View style={styles.scopeBlock}>
                  <Text style={styles.sectionTitle}>SCOPE — CO PACKER</Text>
                  <Text style={styles.copackerNote}>Exclusive role — cannot be combined with others.</Text>
                  <Text style={styles.label}>Copacker Location *</Text>
                  <TextInput style={styles.input} placeholder="Enter copacker location..."
                    value={formData.copackerLocation} onChangeText={v => set('copackerLocation', v)} />
                </View>
              )}

            </View>
          </>
        )}

      </View>
    </ScrollView>
  );
}
