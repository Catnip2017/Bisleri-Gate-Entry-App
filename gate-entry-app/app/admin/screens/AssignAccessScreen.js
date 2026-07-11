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

// Simple inline dropdown for scope fields
function ScopeDropdown({ value, options, onSelect, placeholder = 'Select...' }) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <View style={{ marginBottom: 12, zIndex: open ? 999 : 1 }}>
      <TouchableOpacity style={styles.ddTrigger} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={[styles.ddTriggerText, !selected && { color: '#bbb' }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={{ color: '#aaa', fontSize: 10 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.ddMenu}>
          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
            {options.map(opt => (
              <TouchableOpacity key={opt.value}
                style={[styles.ddItem, value === opt.value && styles.ddItemActive]}
                onPress={() => { onSelect(opt.value); setOpen(false); }}>
                <Text style={[styles.ddItemText, value === opt.value && styles.ddItemTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

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

  const needsWarehouse   = roles.some(r => GUARD_ROLES.includes(r));
  const needsGuardGPLoc = roles.includes('Security Guard');
  const needsGpScope     = roles.includes('Gate Pass User');

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

    if (needsGuardGPLoc && !gatePassLocation)
      return showAlert('Validation Error', 'Gate Pass Location is required for Security Guard');

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
        gate_pass_location: (needsGuardGPLoc || needsGpScope) ? gatePassLocation : null,
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
        <Text style={styles.panelTitle}>Search User</Text>

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
      <View style={styles.rightPanel}>
        {!selectedUser ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>👤</Text>
            <Text style={styles.placeholderText}>
              Search for a user on the left to assign or{'\n'}update their access
            </Text>
          </View>
        ) : (
          <View style={styles.rightPanelRow}>

            {/* ── MAIN COLUMN: header + details + roles + save ── */}
            <ScrollView style={styles.mainCol} contentContainerStyle={{ padding: 20 }}>

              {/* User header */}
              <View style={styles.userHeader}>
                <View style={[styles.avatar, styles.avatarLarge]}>
                  <Text style={[styles.avatarText, styles.avatarTextLarge]}>{getInitials(selectedUser)}</Text>
                </View>
                <View style={styles.userHeaderInfo}>
                  <Text style={styles.userHeaderName}>{firstName} {lastName}</Text>
                  <Text style={styles.userHeaderSub}>{selectedUser.email || selectedUser.username}</Text>
                  <View style={[styles.authBadge, selectedUser.auth_type !== 'ad' && styles.authBadgeLocal]}>
                    <Text style={[styles.authBadgeText, selectedUser.auth_type !== 'ad' && styles.authBadgeLocalText]}>
                      {selectedUser.auth_type === 'ad' ? 'AD Account' : 'Local Account'}
                    </Text>
                  </View>
                </View>
                {hasNoRoles(selectedUser) && (
                  <View style={styles.badgeWarn}><Text style={styles.badgeWarnText}>No roles assigned</Text></View>
                )}
              </View>

              {/* Details */}
              <Text style={styles.sectionLabel}>Details</Text>
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>First name</Text>
                  <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor="#aaa" />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Last name</Text>
                  <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor="#aaa" />
                </View>
              </View>
              <Text style={styles.fieldLabel}>Mobile number</Text>
              <TextInput style={styles.input} value={phoneNumber}
                onChangeText={v => setPhoneNumber(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad" maxLength={10} placeholder="10-digit mobile" placeholderTextColor="#aaa" />
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={[styles.input, styles.inputDisabled]}>
                <Text style={styles.inputDisabledText}>{selectedUser.email || '—'}</Text>
              </View>
              {selectedUser.auth_type === 'ad' && (
                <Text style={styles.fieldNote}>Email is linked to Active Directory and cannot be changed here</Text>
              )}

              {/* Roles */}
              <Text style={styles.sectionLabel}>Roles</Text>
              <View style={styles.pillRow}>
                {AVAILABLE_ROLES.map(role => {
                  const isCp = role === 'Co Packer';
                  const cpOn = roles.includes('Co Packer');
                  const isDisabled = (isCp && !cpOn && roles.some(r => r !== 'Co Packer')) || (!isCp && cpOn);
                  const isSelected = roles.includes(role);
                  return (
                    <TouchableOpacity key={role}
                      style={[styles.pill, isSelected && styles.pillSelected, isDisabled && styles.pillDisabled]}
                      onPress={() => !isDisabled && toggleRole(role)} disabled={isDisabled}>
                      <Text style={[styles.pillText, isSelected && styles.pillTextSelected, isDisabled && styles.pillTextDisabled]}>
                        {role}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {roles.includes('Co Packer') && (
                <Text style={styles.copackerNote}>Co Packer is an exclusive role — cannot be combined with others</Text>
              )}

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>

            {/* ── SCOPE COLUMN (right side, only when needed) ── */}
            {(needsWarehouse || needsGuardGPLoc || needsGpScope || roles.includes('Co Packer')) && (
              <>
                <View style={styles.scopeDivider} />
                <ScrollView style={styles.scopeCol} contentContainerStyle={{ padding: 16 }}>
                  <Text style={styles.sectionLabel}>Scope</Text>

                  {/* Warehouse */}
                  {needsWarehouse && (
                    <View style={{ marginBottom: 16, zIndex: showWarehouseDropdown ? 100 : 2 }}>
                      <Text style={styles.scopeSubLabel}>Warehouse *</Text>
                      <View style={styles.dropdownWrapper}>
                        <TextInput style={styles.input} placeholder="Type code or name..."
                          placeholderTextColor="#aaa" value={warehouseSearch}
                          onChangeText={handleWarehouseSearch} autoCapitalize="characters" />
                        {showWarehouseDropdown && (
                          <View style={styles.dropdown}>
                            <ScrollView nestedScrollEnabled style={{ maxHeight: 130 }}>
                              {filteredWarehouses.map(w => (
                                <TouchableOpacity key={w.warehouse_code} style={styles.dropdownItem} onPress={() => selectWarehouse(w)}>
                                  <Text style={styles.dropdownCode}>{w.warehouse_code}</Text>
                                  <Text style={styles.dropdownName}>{w.warehouse_name}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dimLabel}>Name</Text>
                          <View style={[styles.input, styles.inputDisabled]}>
                            <Text style={styles.inputDisabledText}>{warehouseName || '—'}</Text>
                          </View>
                        </View>
                        <View style={{ width: 72 }}>
                          <Text style={styles.dimLabel}>Site Code</Text>
                          <View style={[styles.input, styles.inputDisabled]}>
                            <Text style={styles.inputDisabledText}>{siteCode || '—'}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Security Guard — Gate Pass Location */}
                  {needsGuardGPLoc && (
                    <View style={{ marginBottom: 16, zIndex: 1 }}>
                      <Text style={styles.scopeSubLabel}>Security Guard</Text>
                      <Text style={styles.fieldLabel}>Gate Pass Location *</Text>
                      <ScopeDropdown
                        value={gatePassLocation}
                        options={gpLocations.map(l => ({ label: `${l.location_code} — ${l.location_name}`, value: l.location_code }))}
                        onSelect={setGatePassLocation}
                        placeholder="Select gate location..."
                      />
                    </View>
                  )}

                  {/* Co Packer */}
                  {roles.includes('Co Packer') && (
                    <View style={{ marginBottom: 16, zIndex: 1 }}>
                      <Text style={styles.scopeSubLabel}>Co Packer</Text>
                      <Text style={styles.fieldLabel}>Location *</Text>
                      <TextInput style={styles.input} placeholder="Enter copacker location..."
                        placeholderTextColor="#aaa" value={copackerLocation} onChangeText={setCopackerLocation} />
                    </View>
                  )}

                  {/* Gate Pass User */}
                  {needsGpScope && (
                    <View style={{ zIndex: 1 }}>
                      <Text style={styles.scopeSubLabel}>Gate Pass User</Text>
                      {/* Department dropdown */}
                      <Text style={styles.fieldLabel}>Department *</Text>
                      <ScopeDropdown
                        value={department}
                        options={DEPARTMENTS.map(d => ({ label: d, value: d }))}
                        onSelect={setDepartment}
                        placeholder="Select department..."
                      />
                      {/* GP Location dropdown */}
                      <Text style={styles.fieldLabel}>Gate Pass Location *</Text>
                      <ScopeDropdown
                        value={gatePassLocation}
                        options={gpLocations.map(l => ({ label: `${l.location_code} — ${l.location_name}`, value: l.location_code }))}
                        onSelect={setGatePassLocation}
                        placeholder="Select location..."
                      />
                    </View>
                  )}
                </ScrollView>
              </>
            )}

          </View>
        )}
      </View>
    </View>
  );
};

export default AssignAccessScreen;
