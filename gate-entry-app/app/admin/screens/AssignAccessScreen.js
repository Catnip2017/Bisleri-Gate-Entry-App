import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { adminAPI, gatePassAPI, handleAPIError } from '../../../services/api';
import { showAlert } from '../../../utils/customModal';
import styles from '../styles/AssignAccessScreenStyle';

const AVAILABLE_ROLES = ['Security Guard', 'Security Admin', 'IT Admin', 'Gate Pass User', 'Co Packer'];
const GUARD_ROLES = ['Security Guard', 'Security Admin'];
const DEPARTMENTS = ['IT', 'Finance', 'Sales', 'Marketing', 'Admin', 'HR'];

const AssignAccessScreen = () => {
  // ── Left panel state ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searching, setSearching] = useState(false);

  // ── Right panel state ─────────────────────────────────────────────────────
  const [roles, setRoles] = useState([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [copackerLocation, setCopackerLocation] = useState('');
  const [saving, setSaving] = useState(false);

  // Warehouse autocomplete
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);

  // Gate Pass User scope
  const [department, setDepartment] = useState('');
  const [gatePassLocation, setGatePassLocation] = useState('');
  const [gpLocations, setGpLocations] = useState([]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getInitials = (user) => {
    const f = user.first_name?.[0] || '';
    const l = user.last_name?.[0] || '';
    return (f + l).toUpperCase() || user.username?.[0]?.toUpperCase() || '?';
  };

  const hasNoRoles = (user) => !user.role || user.role.trim() === '';

  const needsWarehouse = roles.some(r => GUARD_ROLES.includes(r));
  const needsGpScope = roles.includes('Gate Pass User');

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async (query) => {
    setSearchQuery(query);
    setSelectedUser(null);
    setSearchResults([]);
    if (!query.trim()) return;

    setSearching(true);
    try {
      // NOTE (BACKEND): searchUsers should search by email AND username.
      // Backend update needed: match on users_master.email ILIKE or username ILIKE.
      const results = await adminAPI.searchUsers(query.trim());
      setSearchResults(results || []);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // ── Select user ───────────────────────────────────────────────────────────
  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setSearchResults([]);

    const userRoles = user.role
      ? user.role.split(',').map(r => r.trim()).filter(Boolean)
      : [];
    setRoles(userRoles);
    setFirstName(user.first_name || '');
    setLastName(user.last_name || '');
    setPhoneNumber(user.phone_number || '');
    setCopackerLocation(user.copacker_location || '');
    setWarehouseCode(user.warehouse_code || '');
    setWarehouseName(user.warehouse_name || '');
    setSiteCode(user.site_code || '');
    setWarehouseSearch(user.warehouse_code || '');
    setDepartment(user.department || '');
    setGatePassLocation(user.gate_pass_location || '');

    if (!warehouses.length) {
      try {
        const data = await adminAPI.getWarehouses();
        setWarehouses(data);
      } catch (e) {
        console.error('Failed to load warehouses:', e);
      }
    }

    if (!gpLocations.length) {
      try {
        const data = await gatePassAPI.getLocations();
        setGpLocations(data || []);
      } catch (e) {
        console.error('Failed to load GP locations:', e);
      }
    }
  };

  // ── Role toggle ───────────────────────────────────────────────────────────
  const toggleRole = (role) => {
    if (role === 'Co Packer') {
      setRoles(prev => prev.includes(role) ? [] : ['Co Packer']);
    } else {
      setRoles(prev => {
        const withoutCopacker = prev.filter(r => r !== 'Co Packer');
        return withoutCopacker.includes(role)
          ? withoutCopacker.filter(r => r !== role)
          : [...withoutCopacker, role];
      });
    }
  };

  // ── Warehouse autocomplete ────────────────────────────────────────────────
  const handleWarehouseSearch = (text) => {
    setWarehouseSearch(text);
    if (!text.trim()) {
      setWarehouseCode('');
      setWarehouseName('');
      setSiteCode('');
      setFilteredWarehouses([]);
      setShowWarehouseDropdown(false);
      return;
    }
    const term = text.toLowerCase();
    const filtered = warehouses.filter(w =>
      (w.warehouse_code?.toLowerCase() || '').includes(term) ||
      (w.warehouse_name?.toLowerCase() || '').includes(term)
    );
    setFilteredWarehouses(filtered);
    setShowWarehouseDropdown(filtered.length > 0);
    setWarehouseCode(text);
    setWarehouseName('');
    setSiteCode('');
  };

  const selectWarehouse = (w) => {
    setWarehouseCode(w.warehouse_code);
    setWarehouseName(w.warehouse_name);
    setSiteCode(w.site_code);
    setWarehouseSearch(w.warehouse_code);
    setShowWarehouseDropdown(false);
    setFilteredWarehouses([]);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetRightPanel = () => {
    setSelectedUser(null);
    setSearchQuery('');
    setSearchResults([]);
    setRoles([]);
    setFirstName('');
    setLastName('');
    setPhoneNumber('');
    setCopackerLocation('');
    setWarehouseCode('');
    setWarehouseName('');
    setSiteCode('');
    setWarehouseSearch('');
    setDepartment('');
    setGatePassLocation('');
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedUser) return;

    if (!roles.length)
      return showAlert('Validation Error', 'Please assign at least one role');

    if (roles.includes('Co Packer') && !copackerLocation.trim())
      return showAlert('Validation Error', 'Copacker Location is required for Co Packer role');

    if (needsWarehouse && (!warehouseCode || !warehouseName))
      return showAlert('Validation Error', 'Please select a valid warehouse for Security roles');

    if (needsGpScope && !department)
      return showAlert('Validation Error', 'Department is required for Gate Pass User');

    if (needsGpScope && !gatePassLocation)
      return showAlert('Validation Error', 'Gate Pass Location is required for Gate Pass User');

    setSaving(true);
    try {
      // Update role + scope
      await adminAPI.modifyUser(selectedUser.username, {
        role: roles.join(', '),
        copacker_location: roles.includes('Co Packer') ? copackerLocation.trim() : null,
        warehouse_code: needsWarehouse ? warehouseCode.trim() : null,
        department: needsGpScope ? department : null,
        gate_pass_location: needsGpScope ? gatePassLocation : null,
      });

      // Update personal details
      await adminAPI.updateUser(selectedUser.username, {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone_number: phoneNumber.trim() || null,
      });

      showAlert(
        'Success',
        `Access updated for ${firstName} ${lastName}`.trim() || selectedUser.username,
        [{ text: 'OK', onPress: resetRightPanel }]
      );
    } catch (e) {
      console.error('AssignAccess save error:', e);
      showAlert('Error', handleAPIError(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── LEFT PANEL ── */}
      <View style={styles.leftPanel}>
        <Text style={styles.panelTitle}>Search user</Text>

        <View style={styles.searchWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="Email or username..."
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {searching && (
            <ActivityIndicator style={styles.searchSpinner} size="small" color="#1976d2" />
          )}
        </View>

        <ScrollView style={styles.resultsList} nestedScrollEnabled>
          {searchResults.map(user => (
            <TouchableOpacity
              key={user.username}
              style={[
                styles.userRow,
                selectedUser?.username === user.username && styles.userRowSelected,
              ]}
              onPress={() => handleSelectUser(user)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user)}</Text>
              </View>
              <View style={styles.userRowInfo}>
                <Text style={styles.userRowName} numberOfLines={1}>
                  {user.first_name} {user.last_name}
                </Text>
                <Text style={styles.userRowSub} numberOfLines={1}>
                  {user.username}
                </Text>
                {user.email ? (
                  <Text style={[styles.userRowSub, { color: '#90a4ae', fontSize: 11 }]} numberOfLines={1}>
                    {user.email}
                  </Text>
                ) : null}
              </View>
              {hasNoRoles(user) && (
                <View style={styles.badgeWarn}>
                  <Text style={styles.badgeWarnText}>No role</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}

          {!searching && searchQuery.trim() !== '' && searchResults.length === 0 && (
            <Text style={styles.emptyText}>No users found</Text>
          )}

          {searchQuery.trim() === '' && (
            <Text style={styles.emptyText}>
              Type an email or username to search
            </Text>
          )}
        </ScrollView>
      </View>

      {/* ── RIGHT PANEL ── */}
      <ScrollView style={styles.rightPanel} contentContainerStyle={styles.rightPanelContent}>

        {!selectedUser ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Search for a user on the left to assign or update their access
            </Text>
          </View>
        ) : (
          <>
            {/* User header */}
            <View style={styles.userHeader}>
              <View style={[styles.avatar, styles.avatarLarge]}>
                <Text style={[styles.avatarText, styles.avatarTextLarge]}>
                  {getInitials(selectedUser)}
                </Text>
              </View>
              <View style={styles.userHeaderInfo}>
                <Text style={styles.userHeaderName}>
                  {firstName} {lastName}
                </Text>
                <Text style={styles.userHeaderSub}>
                  {selectedUser.email || selectedUser.username}
                </Text>
                <View style={[
                  styles.authBadge,
                  selectedUser.auth_type !== 'ad' && styles.authBadgeLocal,
                ]}>
                  <Text style={[
                    styles.authBadgeText,
                    selectedUser.auth_type !== 'ad' && styles.authBadgeLocalText,
                  ]}>
                    {selectedUser.auth_type === 'ad' ? 'AD Account' : 'Local Account'}
                  </Text>
                </View>
              </View>
              {hasNoRoles(selectedUser) && (
                <View style={styles.badgeWarn}>
                  <Text style={styles.badgeWarnText}>No roles assigned</Text>
                </View>
              )}
            </View>

            {/* ── Details ── */}
            <Text style={styles.sectionLabel}>Details</Text>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>First name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor="#aaa"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Last name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor="#aaa"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Mobile number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={v => setPhoneNumber(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="10-digit mobile"
              placeholderTextColor="#aaa"
            />

            {/* Email: locked for AD users */}
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={[styles.input, styles.inputDisabled]}>
              <Text style={styles.inputDisabledText}>
                {selectedUser.email || '—'}
              </Text>
            </View>
            {selectedUser.auth_type === 'ad' && (
              <Text style={styles.fieldNote}>
                Email is linked to Active Directory and cannot be changed here
              </Text>
            )}

            {/* ── Roles ── */}
            <Text style={styles.sectionLabel}>Roles</Text>
            <View style={styles.pillRow}>
              {AVAILABLE_ROLES.map(role => {
                const isCopacker = role === 'Co Packer';
                const copackerSelected = roles.includes('Co Packer');
                const isDisabled =
                  (isCopacker && !copackerSelected && roles.some(r => r !== 'Co Packer')) ||
                  (!isCopacker && copackerSelected);
                const isSelected = roles.includes(role);

                return (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.pill,
                      isSelected && styles.pillSelected,
                      isDisabled && styles.pillDisabled,
                    ]}
                    onPress={() => !isDisabled && toggleRole(role)}
                    disabled={isDisabled}
                  >
                    <Text style={[
                      styles.pillText,
                      isSelected && styles.pillTextSelected,
                      isDisabled && styles.pillTextDisabled,
                    ]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {roles.includes('Co Packer') && (
              <Text style={styles.copackerNote}>
                Co Packer is an exclusive role — cannot be combined with others
              </Text>
            )}

            {/* ── Scope: Warehouse ── */}
            {needsWarehouse && (
              <>
                <Text style={styles.sectionLabel}>Scope</Text>

                <Text style={styles.fieldLabel}>
                  Warehouse <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.dropdownWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Type warehouse code or name..."
                    placeholderTextColor="#aaa"
                    value={warehouseSearch}
                    onChangeText={handleWarehouseSearch}
                    onFocus={() => {
                      if (warehouseSearch && filteredWarehouses.length > 0)
                        setShowWarehouseDropdown(true);
                    }}
                    autoCapitalize="characters"
                  />
                  {showWarehouseDropdown && (
                    <View style={styles.dropdown}>
                      <ScrollView nestedScrollEnabled>
                        {filteredWarehouses.map(w => (
                          <TouchableOpacity
                            key={w.warehouse_code}
                            style={styles.dropdownItem}
                            onPress={() => selectWarehouse(w)}
                          >
                            <Text style={styles.dropdownCode}>{w.warehouse_code}</Text>
                            <Text style={styles.dropdownName}>{w.warehouse_name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <Text style={styles.fieldLabel}>Warehouse name</Text>
                <View style={[styles.input, styles.inputDisabled]}>
                  <Text style={styles.inputDisabledText}>{warehouseName || '—'}</Text>
                </View>

                <Text style={styles.fieldLabel}>Site code</Text>
                <View style={[styles.input, styles.inputDisabled]}>
                  <Text style={styles.inputDisabledText}>{siteCode || '—'}</Text>
                </View>
              </>
            )}

            {/* ── Scope: Co Packer ── */}
            {roles.includes('Co Packer') && (
              <>
                <Text style={styles.sectionLabel}>Scope</Text>
                <Text style={styles.fieldLabel}>
                  Copacker location <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter copacker location..."
                  placeholderTextColor="#aaa"
                  value={copackerLocation}
                  onChangeText={setCopackerLocation}
                />
              </>
            )}

            {/* ── Scope: Gate Pass User ── */}
            {needsGpScope && (
              <>
                <Text style={styles.sectionLabel}>Scope</Text>

                <Text style={styles.fieldLabel}>
                  Department <Text style={styles.required}>*</Text>
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {DEPARTMENTS.map(dept => (
                    <TouchableOpacity
                      key={dept}
                      style={[styles.pill, { flex: 0, paddingHorizontal: 14, paddingVertical: 8 },
                        department === dept && styles.pillSelected]}
                      onPress={() => setDepartment(dept)}
                    >
                      <Text style={[styles.pillText, { fontSize: 13 },
                        department === dept && styles.pillTextSelected]}>
                        {dept}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>
                  Gate Pass Location <Text style={styles.required}>*</Text>
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {gpLocations.map(loc => (
                    <TouchableOpacity
                      key={loc.location_code}
                      style={[styles.pill, { flex: 0, paddingHorizontal: 14, paddingVertical: 8 },
                        gatePassLocation === loc.location_code && styles.pillSelected]}
                      onPress={() => setGatePassLocation(loc.location_code)}
                    >
                      <Text style={[styles.pillText, { fontSize: 13 },
                        gatePassLocation === loc.location_code && styles.pillTextSelected]}>
                        {loc.location_code} — {loc.location_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {gpLocations.length === 0 && (
                    <Text style={{ fontSize: 12, color: '#aaa' }}>Loading locations...</Text>
                  )}
                </View>
              </>
            )}

            {/* ── Save ── */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveButtonText}>Save Changes</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default AssignAccessScreen;
