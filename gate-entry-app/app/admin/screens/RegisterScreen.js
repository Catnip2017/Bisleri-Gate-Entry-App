import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { adminAPI, gatePassAPI, handleAPIError } from '../../../services/api';
import styles from '../styles/RegisterScreenStyle';
import {
  validateUsername,
  validatePassword,
  validateName,
  validatePasswordMatch,
} from '../utils/validation';
import { showAlert } from '../../../utils/customModal';

// LOCAL / CONTRACTOR registration only.
// AD (company) employees are provisioned via the Assign Access tab.

const DEPARTMENTS = ['IT', 'Finance', 'Sales', 'Marketing', 'Admin', 'HR'];
const ALL_ROLES = ['Security Guard', 'Security Admin', 'IT Admin', 'Gate Pass User', 'Co Packer'];
const GUARD_ROLES = ['Security Guard', 'Security Admin'];

const EMPTY_FORM = {
  username: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: '',
  warehouseCode: '',
  warehouseName: '',
  siteCode: '',
  email: '',
  phone_number: '',
  copackerLocation: '',
  department: '',
  gatePassLocation: '',
};

const RegisterScreen = () => {
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [selectedRoles, setSelectedRoles] = useState([]);   // ← multi-select array
  const [warehouses, setWarehouses] = useState([]);
  const [gpLocations, setGpLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);

  useEffect(() => {
    loadWarehouses();
    loadGpLocations();
  }, []);

  const loadWarehouses = async () => {
    try { setWarehouses(await adminAPI.getWarehouses()); }
    catch (e) { console.error('Error loading warehouses:', e); }
  };

  const loadGpLocations = async () => {
    try { setGpLocations((await gatePassAPI.getLocations()) || []); }
    catch (e) { console.error('Error loading GP locations:', e); }
  };

  const handleInputChange = (field, value) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  // ── Role toggle logic ──────────────────────────────────────────────────────
  // Co Packer is exclusive. All other roles can be combined freely.
  const toggleRole = (role) => {
    setSelectedRoles(prev => {
      if (role === 'Co Packer') {
        // Co Packer: exclusive toggle — selecting it clears everything else
        return prev.includes('Co Packer') ? [] : ['Co Packer'];
      }
      // Non-Co-Packer: remove Co Packer if present, then toggle this role
      const withoutCopacker = prev.filter(r => r !== 'Co Packer');
      return withoutCopacker.includes(role)
        ? withoutCopacker.filter(r => r !== role)
        : [...withoutCopacker, role];
    });
  };

  // ── Warehouse autocomplete ─────────────────────────────────────────────────
  const handleWarehouseCodeChange = (text) => {
    setSearchText(text);
    if (!text.trim()) {
      setFormData(prev => ({ ...prev, warehouseCode: '', warehouseName: '', siteCode: '' }));
      setFilteredWarehouses([]);
      setShowDropdown(false);
      return;
    }
    const term = text.toLowerCase();
    const filtered = warehouses.filter(w =>
      (w.warehouse_code?.toLowerCase() || '').includes(term) ||
      (w.warehouse_name?.toLowerCase() || '').includes(term)
    );
    setFilteredWarehouses(filtered);
    setShowDropdown(filtered.length > 0);
    setFormData(prev => ({ ...prev, warehouseCode: text, warehouseName: '', siteCode: '' }));
  };

  const selectWarehouse = (w) => {
    setFormData(prev => ({ ...prev, warehouseCode: w.warehouse_code, warehouseName: w.warehouse_name, siteCode: w.site_code }));
    setSearchText(w.warehouse_code);
    setShowDropdown(false);
    setFilteredWarehouses([]);
  };

  // ── Derived scope flags ────────────────────────────────────────────────────
  const needsWarehouse = selectedRoles.some(r => GUARD_ROLES.includes(r));
  const needsGpScope   = selectedRoles.includes('Gate Pass User');
  const needsCopacker  = selectedRoles.includes('Co Packer');
  const isItAdminOnly  = selectedRoles.length === 1 && selectedRoles[0] === 'IT Admin';

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    if (!selectedRoles.length) { showAlert('Validation Error', 'Please select at least one role'); return false; }

    const errs = [
      validateUsername(formData.username),
      validateName(formData.firstName, 'First name'),
      validateName(formData.lastName, 'Last name'),
      validatePassword(formData.password),
      validatePasswordMatch(formData.password, formData.confirmPassword),
    ].filter(Boolean);
    if (errs.length) { showAlert('Validation Error', errs[0]); return false; }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      showAlert('Validation Error', 'Enter a valid email address'); return false;
    }
    if (formData.phone_number && !/^\d{10}$/.test(formData.phone_number)) {
      showAlert('Validation Error', 'Enter a valid 10-digit mobile number'); return false;
    }
    if (needsWarehouse && (!formData.warehouseCode || !formData.warehouseName)) {
      showAlert('Validation Error', 'Please select a valid Warehouse'); return false;
    }
    if (needsCopacker && !formData.copackerLocation.trim()) {
      showAlert('Validation Error', 'Copacker Location is required'); return false;
    }
    if (needsGpScope && !formData.department) {
      showAlert('Validation Error', 'Department is required for Gate Pass User'); return false;
    }
    if (needsGpScope && !formData.gatePassLocation) {
      showAlert('Validation Error', 'Gate Pass Location is required for Gate Pass User'); return false;
    }
    return true;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const userData = {
        username: formData.username.trim(),
        password: formData.password,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        role: selectedRoles.join(', '),
        warehouse_code: needsWarehouse ? formData.warehouseCode?.trim() : undefined,
        site_code:      needsWarehouse ? formData.siteCode?.trim()      : undefined,
        copacker_location: needsCopacker ? formData.copackerLocation.trim() : undefined,
        department:        needsGpScope  ? formData.department            : undefined,
        gate_pass_location: needsGpScope ? formData.gatePassLocation      : undefined,
      };
      if (formData.email?.trim())        userData.email        = formData.email.trim();
      if (formData.phone_number?.trim()) userData.phone_number = formData.phone_number.trim();

      const response = await adminAPI.registerUser(userData);
      showAlert('Success', response.message || 'User registered successfully!', [
        { text: 'OK', onPress: () => { setFormData({ ...EMPTY_FORM }); setSelectedRoles([]); setSearchText(''); } },
      ]);
    } catch (error) {
      showAlert('Registration Error', handleAPIError(error));
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

        <View style={styles.panels}>

          {/* ── LEFT PANEL ── */}
          <View style={styles.leftPanel}>
            <Text style={styles.sectionTitle}>ROLE</Text>
            <View style={styles.roleContainer}>
              {ALL_ROLES.map(role => {
                const active    = selectedRoles.includes(role);
                const isCopacker = role === 'Co Packer';
                // Disable Co Packer when other roles are selected (and vice-versa)
                const disabled  =
                  (isCopacker && selectedRoles.some(r => r !== 'Co Packer') && !active) ||
                  (!isCopacker && selectedRoles.includes('Co Packer') && !active);

                return (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      active   && styles.roleButtonActive,
                      disabled && styles.roleButtonDisabled,
                    ]}
                    onPress={() => !disabled && toggleRole(role)}
                    disabled={disabled}
                  >
                    {/* Checkbox indicator */}
                    <View style={{
                      width: 16, height: 16, borderRadius: isCopacker ? 8 : 3,
                      borderWidth: 2,
                      borderColor: disabled ? '#ccc' : active ? '#1976d2' : '#aaa',
                      backgroundColor: active ? '#1976d2' : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: 8, flexShrink: 0,
                    }}>
                      {active && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', lineHeight: 12 }}>✓</Text>}
                    </View>
                    <Text style={[
                      styles.roleButtonText,
                      active   && styles.roleButtonTextActive,
                      disabled && styles.roleButtonTextDisabled,
                    ]}>
                      {role}
                    </Text>
                    {isCopacker && (
                      <Text style={{ fontSize: 10, color: disabled ? '#ccc' : '#b45309', marginLeft: 4 }}>excl.</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Scope: Warehouse ── */}
            {needsWarehouse && (
              <View style={styles.scopeBox}>
                <Text style={styles.sectionTitle}>SCOPE</Text>
                <Text style={styles.label}>Warehouse *</Text>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={[styles.input, { marginBottom: 0 }]}
                    placeholder="Type code or name..."
                    value={searchText}
                    onChangeText={handleWarehouseCodeChange}
                    onFocus={() => { if (searchText && filteredWarehouses.length > 0) setShowDropdown(true); }}
                    autoCapitalize="characters"
                  />
                  {showDropdown && (
                    <View style={styles.dropdown}>
                      <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled>
                        {filteredWarehouses.map(w => (
                          <TouchableOpacity key={w.warehouse_code} style={styles.dropdownItem} onPress={() => selectWarehouse(w)}>
                            <Text style={styles.dropdownItemCode}>{w.warehouse_code}</Text>
                            <Text style={styles.dropdownItemName}>{w.warehouse_name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { fontSize: 11, color: '#777' }]}>Name</Text>
                    <TextInput style={[styles.input, styles.inputDisabled, { fontSize: 12, marginBottom: 0 }]}
                      value={formData.warehouseName} editable={false} />
                  </View>
                  <View style={{ width: 80 }}>
                    <Text style={[styles.label, { fontSize: 11, color: '#777' }]}>Site Code</Text>
                    <TextInput style={[styles.input, styles.inputDisabled, { fontSize: 12, marginBottom: 0 }]}
                      value={formData.siteCode} editable={false} />
                  </View>
                </View>
              </View>
            )}

            {/* ── Scope: Co Packer ── */}
            {needsCopacker && (
              <View style={styles.scopeBox}>
                <Text style={styles.sectionTitle}>SCOPE</Text>
                <Text style={styles.copackerNote}>Exclusive role — cannot be combined with others.</Text>
                <Text style={styles.label}>Copacker Location *</Text>
                <TextInput
                  style={[styles.input, { marginBottom: 0 }]}
                  placeholder="Enter copacker location..."
                  value={formData.copackerLocation}
                  onChangeText={v => handleInputChange('copackerLocation', v)}
                />
              </View>
            )}

            {/* ── Scope: Gate Pass User ── */}
            {needsGpScope && (
              <View style={styles.scopeBox}>
                <Text style={styles.sectionTitle}>SCOPE</Text>
                <Text style={styles.label}>Department *</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {DEPARTMENTS.map(dept => {
                    const active = formData.department === dept;
                    return (
                      <TouchableOpacity key={dept}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
                          borderWidth: 1.5, borderColor: active ? '#1976d2' : '#ccc',
                          backgroundColor: active ? '#e8f1fb' : '#f5f5f5' }}
                        onPress={() => handleInputChange('department', dept)}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#1565c0' : '#666' }}>{dept}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.label}>Gate Pass Location *</Text>
                <View style={{ flexDirection: 'column', gap: 5 }}>
                  {gpLocations.map(loc => {
                    const active = formData.gatePassLocation === loc.location_code;
                    return (
                      <TouchableOpacity key={loc.location_code}
                        style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6,
                          borderWidth: 1.5, borderColor: active ? '#1976d2' : '#ccc',
                          backgroundColor: active ? '#e8f1fb' : '#f5f5f5',
                          flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        onPress={() => handleInputChange('gatePassLocation', loc.location_code)}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2,
                          borderColor: active ? '#1976d2' : '#bbb', backgroundColor: active ? '#1976d2' : 'transparent' }} />
                        <Text style={{ fontSize: 12, color: active ? '#1565c0' : '#555', fontWeight: active ? '600' : '400' }}>
                          {loc.location_code} — {loc.location_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {gpLocations.length === 0 && <Text style={{ fontSize: 12, color: '#aaa' }}>Loading locations...</Text>}
                </View>
              </View>
            )}

            {/* IT Admin: no scope */}
            {isItAdminOnly && (
              <View style={{ backgroundColor: '#e3f2fd', borderRadius: 8, padding: 12, marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: '#1565c0', lineHeight: 18 }}>
                  IT Admin has system-wide access. No scope assignment needed.
                </Text>
              </View>
            )}
          </View>

          {/* ── RIGHT PANEL ── */}
          <View style={styles.rightPanel}>
            <Text style={styles.sectionTitle}>PERSONAL DETAILS</Text>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput style={styles.input} placeholder="First Name"
                  value={formData.firstName} onChangeText={v => handleInputChange('firstName', v)} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Last Name *</Text>
                <TextInput style={styles.input} placeholder="Last Name"
                  value={formData.lastName} onChangeText={v => handleInputChange('lastName', v)} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Username *</Text>
                <TextInput style={styles.input} placeholder="Username"
                  value={formData.username} onChangeText={v => handleInputChange('username', v)}
                  autoCapitalize="none" />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Mobile Number</Text>
                <TextInput style={styles.input} placeholder="10-digit mobile"
                  value={formData.phone_number}
                  onChangeText={v => handleInputChange('phone_number', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad" maxLength={10} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Password *</Text>
                <TextInput style={styles.input} placeholder="Password" secureTextEntry
                  value={formData.password} onChangeText={v => handleInputChange('password', v)} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password *</Text>
                <TextInput style={styles.input} placeholder="Confirm Password" secureTextEntry
                  value={formData.confirmPassword} onChangeText={v => handleInputChange('confirmPassword', v)} />
              </View>
            </View>

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} placeholder="Email (optional)"
              value={formData.email} onChangeText={v => handleInputChange('email', v)}
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
      </View>
    </ScrollView>
  );
};

export default RegisterScreen;
