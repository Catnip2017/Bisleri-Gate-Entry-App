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

// This screen registers LOCAL / CONTRACTOR users only.
// AD (company) employees are provisioned via the Assign Access tab.

const DEPARTMENTS = ['IT', 'Finance', 'Sales', 'Marketing', 'Admin', 'HR'];

const EMPTY_FORM = {
  username: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: '',
  role: 'Security Guard',
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
    try {
      const data = await adminAPI.getWarehouses();
      setWarehouses(data);
    } catch (e) {
      console.error('Error loading warehouses:', e);
    }
  };

  const loadGpLocations = async () => {
    try {
      const data = await gatePassAPI.getLocations();
      setGpLocations(data || []);
    } catch (e) {
      console.error('Error loading GP locations:', e);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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

  const selectWarehouse = (warehouse) => {
    setFormData(prev => ({
      ...prev,
      warehouseCode: warehouse.warehouse_code,
      warehouseName: warehouse.warehouse_name,
      siteCode: warehouse.site_code,
    }));
    setSearchText(warehouse.warehouse_code);
    setShowDropdown(false);
    setFilteredWarehouses([]);
  };

  const needsWarehouse = ['Security Guard', 'Security Admin'].includes(formData.role);
  const needsGpScope = formData.role === 'Gate Pass User';
  const needsCopacker = formData.role === 'Co Packer';

  const validateForm = () => {
    const usernameError = validateUsername(formData.username);
    if (usernameError) { showAlert('Validation Error', usernameError); return false; }

    const firstNameError = validateName(formData.firstName, 'First name');
    if (firstNameError) { showAlert('Validation Error', firstNameError); return false; }

    const lastNameError = validateName(formData.lastName, 'Last name');
    if (lastNameError) { showAlert('Validation Error', lastNameError); return false; }

    const passwordError = validatePassword(formData.password);
    if (passwordError) { showAlert('Validation Error', passwordError); return false; }

    const passwordMatchError = validatePasswordMatch(formData.password, formData.confirmPassword);
    if (passwordMatchError) { showAlert('Validation Error', passwordMatchError); return false; }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      showAlert('Validation Error', 'Enter a valid email address');
      return false;
    }

    if (formData.phone_number && !/^\d{10}$/.test(formData.phone_number)) {
      showAlert('Validation Error', 'Enter a valid 10-digit mobile number');
      return false;
    }

    if (needsWarehouse && (!formData.warehouseCode || !formData.warehouseName)) {
      showAlert('Validation Error', 'Please select a valid Warehouse');
      return false;
    }

    if (needsCopacker && !formData.copackerLocation.trim()) {
      showAlert('Validation Error', 'Copacker Location is required for Co Packer role');
      return false;
    }

    if (needsGpScope && !formData.department) {
      showAlert('Validation Error', 'Department is required for Gate Pass User role');
      return false;
    }

    if (needsGpScope && !formData.gatePassLocation) {
      showAlert('Validation Error', 'Gate Pass Location is required for Gate Pass User role');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const userData = {
        username: formData.username.trim(),
        password: formData.password,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        role: formData.role,
        warehouse_code: needsWarehouse ? formData.warehouseCode?.trim() : undefined,
        site_code: needsWarehouse ? formData.siteCode?.trim() : undefined,
        copacker_location: needsCopacker ? formData.copackerLocation.trim() : undefined,
        department: needsGpScope ? formData.department : undefined,
        gate_pass_location: needsGpScope ? formData.gatePassLocation : undefined,
      };
      if (formData.email?.trim()) userData.email = formData.email.trim();
      if (formData.phone_number?.trim()) userData.phone_number = formData.phone_number.trim();

      const response = await adminAPI.registerUser(userData);
      showAlert('Success', response.message || 'User registered successfully!', [
        { text: 'OK', onPress: () => { setFormData({ ...EMPTY_FORM }); setSearchText(''); } },
      ]);
    } catch (error) {
      showAlert('Registration Error', handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>

        {/* Auth type badge */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#f3e5f5', borderRadius: 8,
          borderWidth: 0.5, borderColor: '#ce93d8',
          paddingHorizontal: 12, paddingVertical: 8,
          marginBottom: 18, gap: 8,
        }}>
          <Text style={{ fontSize: 13, color: '#6a1b9a', fontWeight: '500' }}>
            🔒 Local / Contractor Account
          </Text>
          <Text style={{ fontSize: 11, color: '#9c27b0', flex: 1 }}>
            — password login only. For company employees use Assign Access.
          </Text>
        </View>

        <View style={styles.panels}>

          {/* ── LEFT PANEL: Role + Scope ── */}
          <View style={styles.leftPanel}>
            <Text style={styles.sectionTitle}>Role</Text>
            <View style={styles.roleContainer}>
              {['Security Guard', 'Security Admin', 'IT Admin', 'Gate Pass User', 'Co Packer'].map(role => {
                const active = formData.role === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleButton, active && styles.roleButtonActive]}
                    onPress={() => handleInputChange('role', role)}
                  >
                    {/* Radio dot */}
                    <View style={{
                      width: 14, height: 14, borderRadius: 7,
                      borderWidth: 2,
                      borderColor: active ? '#1976d2' : '#bbb',
                      backgroundColor: active ? '#1976d2' : 'transparent',
                      marginRight: 2,
                    }} />
                    <Text style={[styles.roleButtonText, active && styles.roleButtonTextActive]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Scope: Security Guard / Admin → Warehouse ── */}
            {needsWarehouse && (
              <View style={styles.scopeBox}>
                <Text style={styles.sectionTitle}>Scope</Text>
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

            {/* ── Scope: Co Packer → Location ── */}
            {needsCopacker && (
              <View style={styles.scopeBox}>
                <Text style={styles.sectionTitle}>Scope</Text>
                <Text style={styles.copackerNote}>
                  Exclusive role — cannot be combined with others.
                </Text>
                <Text style={styles.label}>Copacker Location *</Text>
                <TextInput
                  style={[styles.input, { marginBottom: 0 }]}
                  placeholder="Enter copacker location..."
                  value={formData.copackerLocation}
                  onChangeText={v => handleInputChange('copackerLocation', v)}
                />
              </View>
            )}

            {/* ── Scope: Gate Pass User → Dept + GP Location ── */}
            {needsGpScope && (
              <View style={styles.scopeBox}>
                <Text style={styles.sectionTitle}>Scope</Text>

                <Text style={styles.label}>Department *</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {DEPARTMENTS.map(dept => {
                    const active = formData.department === dept;
                    return (
                      <TouchableOpacity
                        key={dept}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 6,
                          borderRadius: 6, borderWidth: 1.5,
                          borderColor: active ? '#1976d2' : '#ccc',
                          backgroundColor: active ? '#e8f1fb' : '#f5f5f5',
                        }}
                        onPress={() => handleInputChange('department', dept)}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600',
                          color: active ? '#1565c0' : '#666' }}>
                          {dept}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Gate Pass Location *</Text>
                <View style={{ flexDirection: 'column', gap: 5 }}>
                  {gpLocations.map(loc => {
                    const active = formData.gatePassLocation === loc.location_code;
                    return (
                      <TouchableOpacity
                        key={loc.location_code}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 8,
                          borderRadius: 6, borderWidth: 1.5,
                          borderColor: active ? '#1976d2' : '#ccc',
                          backgroundColor: active ? '#e8f1fb' : '#f5f5f5',
                          flexDirection: 'row', alignItems: 'center', gap: 6,
                        }}
                        onPress={() => handleInputChange('gatePassLocation', loc.location_code)}
                      >
                        <View style={{
                          width: 12, height: 12, borderRadius: 6,
                          borderWidth: 2, borderColor: active ? '#1976d2' : '#bbb',
                          backgroundColor: active ? '#1976d2' : 'transparent',
                        }} />
                        <Text style={{ fontSize: 12, color: active ? '#1565c0' : '#555', fontWeight: active ? '600' : '400' }}>
                          {loc.location_code} — {loc.location_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {gpLocations.length === 0 && (
                    <Text style={{ fontSize: 12, color: '#aaa' }}>Loading locations...</Text>
                  )}
                </View>
              </View>
            )}

            {/* ── IT Admin: no scope needed ── */}
            {formData.role === 'IT Admin' && (
              <View style={{ backgroundColor: '#e3f2fd', borderRadius: 8, padding: 12, marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: '#1565c0', lineHeight: 18 }}>
                  IT Admin has system-wide access. No scope assignment needed.
                </Text>
              </View>
            )}
          </View>

          {/* ── RIGHT PANEL: Personal details ── */}
          <View style={styles.rightPanel}>
            <Text style={styles.sectionTitle}>Personal Details</Text>

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
                <TextInput
                  style={styles.input}
                  placeholder="10-digit mobile"
                  value={formData.phone_number}
                  onChangeText={v => handleInputChange('phone_number', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={10}
                />
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
            <TextInput
              style={styles.input}
              placeholder="Email (optional)"
              value={formData.email}
              onChangeText={v => handleInputChange('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
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
