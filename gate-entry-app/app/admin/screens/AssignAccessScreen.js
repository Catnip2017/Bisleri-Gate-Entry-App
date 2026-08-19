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

// Multi-select dropdown for gate pass locations. Built for scale: the
// location master will hold 500+ rows once the Fabric pipeline lands, so
// options live inside a searchable, scrollable menu — never a flat list.
// selections: [{ location_code, is_default }]; ★ only rendered when
// showStar (GPU present) — guards' worklist defaults to All, no star needed.
function LocationMultiSelect({ options, selections, onChange, showStar }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const term = search.trim().toLowerCase();
  const filtered = term
    ? options.filter(l =>
        (l.location_code || '').toLowerCase().includes(term) ||
        (l.location_name || '').toLowerCase().includes(term))
    : options;

  const toggle = (code) => {
    const exists = selections.find(x => x.location_code === code);
    if (exists) {
      const next = selections.filter(x => x.location_code !== code);
      // keep exactly one star if any remain
      if (exists.is_default && next.length > 0) next[0] = { ...next[0], is_default: true };
      onChange(next);
    } else {
      onChange([...selections, { location_code: code, is_default: selections.length === 0 }]);
    }
  };

  const setStar = (code) =>
    onChange(selections.map(x => ({ ...x, is_default: x.location_code === code })));

  const summary = selections.length
    ? selections
        .map(s => s.location_code + (showStar && s.is_default ? ' ★' : ''))
        .join(', ')
    : null;

  return (
    <View style={{ marginBottom: 12, zIndex: open ? 998 : 1 }}>
      <TouchableOpacity style={styles.ddTrigger} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={[styles.ddTriggerText, !summary && { color: '#bbb' }]} numberOfLines={1}>
          {summary || 'Select locations...'}
        </Text>
        <Text style={{ color: '#aaa', fontSize: 10 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.ddMenu}>
          <TextInput
            style={[styles.input, { marginHorizontal: 6, marginTop: 6, marginBottom: 2 }]}
            placeholder="Search code or name..."
            placeholderTextColor="#aaa"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="characters"
          />
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filtered.map((l) => {
              const sel = selections.find(x => x.location_code === l.location_code);
              return (
                <View key={l.location_code}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    onPress={() => toggle(l.location_code)}
                  >
                    <Text style={{ fontSize: 15, width: 22 }}>{sel ? '☑' : '☐'}</Text>
                    <Text style={{ fontSize: 13, color: '#333' }} numberOfLines={1}>
                      {l.location_code} — {l.location_name}
                    </Text>
                  </TouchableOpacity>
                  {sel && showStar && (
                    <TouchableOpacity
                      onPress={() => setStar(l.location_code)}
                      accessibilityLabel={`Make ${l.location_code} the default`}
                    >
                      <Text style={{ fontSize: 16, color: sel.is_default ? '#f5a623' : '#c8c8c8' }}>
                        {sel.is_default ? '★' : '☆'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {filtered.length === 0 && (
              <Text style={{ fontSize: 12, color: '#999', padding: 10 }}>No locations match your search</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// Role model LOCKED 14 Jul 2026: Security Admin removed; Gate Pass User
// split into Creator (initiates; alone or with ITA) and Dispatcher (gate
// actions; only with Security Guard). Illegal combos are blocked here with
// explanatory popups AND server-side (validate_role_combo).
const AVAILABLE_ROLES = ['Security Guard', 'Gate Pass Dispatcher', 'IT Admin', 'Gate Pass Creator', 'Co Packer'];
const GUARD_ROLES = ['Security Guard'];

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
  const [departments, setDepartments] = useState([]);   // live from gate_pass_departments
  const [gatePassLocation, setGatePassLocation] = useState('');
  const [gpLocations, setGpLocations] = useState([]);
  // Gate Pass User multi-location: [{ location_code, is_default }]
  const [gpLocSelections, setGpLocSelections] = useState([]);
  // Deactivate-don't-delete: account on/off switch
  const [isActive, setIsActive] = useState(true);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getInitials = (user) => {
    const f = user.first_name?.[0] || '';
    const l = user.last_name?.[0] || '';
    return (f + l).toUpperCase() || user.username?.[0]?.toUpperCase() || '?';
  };

  const hasNoRoles = (user) => !user.role || user.role.trim() === '';

  const needsWarehouse   = roles.some(r => GUARD_ROLES.includes(r));
  const needsGuardGPLoc = roles.includes('Gate Pass Dispatcher');
  const needsGpScope     = roles.includes('Gate Pass Creator');
  // ONE shared location list per user (junction table) covering both hats:
  // guard worklist access AND GPU initiation. The ★ default only matters to
  // GPUs (pre-selects the New Pass form); guards' worklist shows all their
  // locations, so the star is hidden when the user isn't a GPU.
  const needsGpLocations = needsGuardGPLoc || needsGpScope;

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
    setIsActive(user.is_active !== false);   // NULL/undefined = active
    try {
      const mine = await adminAPI.getUserGpLocations(user.username);
      setGpLocSelections(mine.locations || []);
    } catch (e) {
      setGpLocSelections(user.gate_pass_location
        ? [{ location_code: user.gate_pass_location, is_default: true }] : []);
    }

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

    if (!departments.length) {
      try {
        const data = await gatePassAPI.getDepartments();
        setDepartments(data?.departments || []);
      } catch (e) {
        console.error('Failed to load departments:', e);
      }
    }
  };

  // ── Role toggle with combo rules (LOCKED 14 Jul 2026) ────────────────────
  // Structural SOD: the creator of a pass can never be its dispatcher, so
  // the combos below are impossible to even assign. Server enforces the
  // same matrix (validate_role_combo) — the popups are the friendly layer.
  const toggleRole = (role) => {
    if (role === 'Co Packer') {
      setRoles(prev => prev.includes(role) ? [] : ['Co Packer']);
      return;
    }
    const selected = roles.includes(role);
    if (!selected) {
      if (role === 'Gate Pass Dispatcher' && !roles.includes('Security Guard'))
        return showAlert('Not Allowed',
          'Gate Pass Dispatcher can only be assigned together with Security Guard. Tick Security Guard first.');
      if (role === 'Gate Pass Creator' &&
          (roles.includes('Security Guard') || roles.includes('Gate Pass Dispatcher')))
        return showAlert('Not Allowed',
          'Gate Pass Creator cannot be combined with Security Guard or Gate Pass Dispatcher — the person who creates a pass can never be the one who dispatches or receives it.');
      if (role === 'IT Admin' &&
          (roles.includes('Security Guard') || roles.includes('Gate Pass Dispatcher')))
        return showAlert('Not Allowed',
          'IT Admin cannot be combined with Security Guard or Gate Pass Dispatcher.');
      if (role === 'Security Guard' && roles.includes('Gate Pass Creator'))
        return showAlert('Not Allowed',
          'Security Guard cannot be combined with Gate Pass Creator — the person who creates a pass can never be the one who dispatches or receives it.');
      if (role === 'Security Guard' && roles.includes('IT Admin'))
        return showAlert('Not Allowed',
          'Security Guard cannot be combined with IT Admin.');
      setRoles(prev => [...prev.filter(r => r !== 'Co Packer'), role]);
    } else {
      setRoles(prev => {
        let next = prev.filter(r => r !== role);
        // Removing Security Guard also removes Gate Pass Dispatcher —
        // GPD can never stand alone.
        if (role === 'Security Guard' && next.includes('Gate Pass Dispatcher')) {
          next = next.filter(r => r !== 'Gate Pass Dispatcher');
        }
        return next;
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
      return showAlert('Validation Error', 'Department is required for the Gate Pass Creator role');

    if (needsGpLocations && gpLocSelections.length === 0)
      return showAlert('Validation Error', 'At least one Gate Pass Location is required');

    setSaving(true);
    try {
      // Update role + scope
      await adminAPI.modifyUser(selectedUser.username, {
        role: roles.join(', '),
        copacker_location: roles.includes('Co Packer') ? copackerLocation.trim() : null,
        warehouse_code: needsWarehouse ? warehouseCode.trim() : null,
        department: needsGpScope ? department : null,
        // Guards AND GPUs both use the junction-table list (one shared list
        // per user). Backend syncs users_master.gate_pass_location to the
        // starred default. Legacy single-value field no longer sent.
        gate_pass_location: null,
        gate_pass_locations: needsGpLocations ? gpLocSelections : null,
        is_active: isActive,
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
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.authBadge, selectedUser.auth_type !== 'ad' && styles.authBadgeLocal]}>
                      <Text style={[styles.authBadgeText, selectedUser.auth_type !== 'ad' && styles.authBadgeLocalText]}>
                        {selectedUser.auth_type === 'ad' ? 'AD Account' : 'Local Account'}
                      </Text>
                    </View>
                    {/* Deactivate-don't-delete: takes effect on the user's NEXT
                        request (server checks every call). Self-deactivation is
                        rejected by the backend. */}
                    <TouchableOpacity
                      onPress={() => setIsActive((a) => !a)}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: isActive }}
                      style={{
                        marginLeft: 8, paddingHorizontal: 10, paddingVertical: 3,
                        borderRadius: 10, borderWidth: 1,
                        borderColor: isActive ? '#00843D' : '#c0392b',
                        backgroundColor: isActive ? '#e6f4ec' : '#fdecea',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700',
                        color: isActive ? '#00843D' : '#c0392b' }}>
                        {isActive ? '● Active' : '○ Deactivated'}
                      </Text>
                    </TouchableOpacity>
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

                  {/* Co Packer */}
                  {roles.includes('Co Packer') && (
                    <View style={{ marginBottom: 16, zIndex: 1 }}>
                      <Text style={styles.scopeSubLabel}>Co Packer</Text>
                      <Text style={styles.fieldLabel}>Location *</Text>
                      <TextInput style={styles.input} placeholder="Enter copacker location..."
                        placeholderTextColor="#aaa" value={copackerLocation} onChangeText={setCopackerLocation} />
                    </View>
                  )}

                  {/* Gate Pass — ONE shared location list for both hats:
                      guard worklist (dispatch/inward) + GPU initiation.
                      Department applies to GPUs only; the ★ default only
                      pre-selects the GPU New Pass form, so it's hidden for
                      guard-only users (their worklist defaults to All). */}
                  {needsGpLocations && (
                    <View style={{ zIndex: 1 }}>
                      <Text style={styles.scopeSubLabel}>Gate Pass</Text>
                      {needsGpScope && (
                        <>
                          <Text style={styles.fieldLabel}>Department *</Text>
                          <ScopeDropdown
                            value={department}
                            options={departments.map(d => ({ label: d, value: d }))}
                            onSelect={setDepartment}
                            placeholder="Select department..."
                          />
                        </>
                      )}
                      {/* GP Locations: searchable multi-select dropdown
                          (scales to 500+ locations once the pipeline lands);
                          one starred default, star shown for GPU only */}
                      <Text style={styles.fieldLabel}>
                        {needsGpScope
                          ? 'Gate Pass Locations * (★ = default)'
                          : 'Gate Pass Locations *'}
                      </Text>
                      <LocationMultiSelect
                        options={gpLocations}
                        selections={gpLocSelections}
                        onChange={setGpLocSelections}
                        showStar={needsGpScope}
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
