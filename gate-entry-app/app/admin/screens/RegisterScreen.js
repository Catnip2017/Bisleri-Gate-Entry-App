import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { adminAPI, gatePassAPI, handleAPIError } from '../../../services/api';
import { validateUsername, validatePassword, validateName, validatePasswordMatch } from '../utils/validation';
import { showAlert } from '../../../utils/customModal';

const DEPARTMENTS = ['IT', 'Finance', 'Sales', 'Marketing', 'Admin', 'HR'];
const ALL_ROLES   = ['Security Guard', 'Security Admin', 'IT Admin', 'Gate Pass User', 'Co Packer'];
const GUARD_ROLES = ['Security Guard', 'Security Admin'];

const EMPTY = {
  username: '', password: '', confirmPassword: '',
  firstName: '', lastName: '', email: '', phone_number: '',
  warehouseCode: '', warehouseName: '', siteCode: '',
  copackerLocation: '', department: '', gatePassLocation: '',
};

// ── Reusable inline Dropdown ───────────────────────────────────────────────
function InlineDropdown({ label, value, options, onSelect, placeholder = 'Select...' }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <View style={{ marginBottom: 12, zIndex: open ? 999 : 1 }}>
      {label ? <Text style={S.fieldLabel}>{label}</Text> : null}
      <TouchableOpacity style={S.ddTrigger} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={[S.ddTriggerText, !selected && { color: '#bbb' }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={{ color: '#aaa', fontSize: 11 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={S.ddMenu}>
          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
            {options.map(opt => (
              <TouchableOpacity key={opt.value}
                style={[S.ddItem, value === opt.value && S.ddItemActive]}
                onPress={() => { onSelect(opt.value); setOpen(false); }}>
                <Text style={[S.ddItemText, value === opt.value && S.ddItemTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function RegisterScreen() {
  const [form, setForm]                       = useState({ ...EMPTY });
  const [roles, setRoles]                     = useState([]);
  const [warehouses, setWarehouses]           = useState([]);
  const [gpLocations, setGpLocations]         = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [whText, setWhText]                   = useState('');
  const [showWH, setShowWH]                   = useState(false);
  const [filteredWH, setFilteredWH]           = useState([]);

  useEffect(() => {
    adminAPI.getWarehouses().then(setWarehouses).catch(() => {});
    gatePassAPI.getLocations().then(d => setGpLocations(d || [])).catch(() => {});
  }, []);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const toggleRole = (role) => {
    setRoles(prev => {
      if (role === 'Co Packer') {
        if (prev.includes('Co Packer')) return [];
        if (prev.length > 0) {
          showAlert('Exclusive Role',
            'Co Packer cannot be combined with other roles. Selecting it will clear all current selections.',
            [{ text: 'Cancel', style: 'cancel' },
             { text: 'Select Co Packer', onPress: () => setRoles(['Co Packer']) }]);
          return prev;
        }
        return ['Co Packer'];
      }
      const noCp = prev.filter(r => r !== 'Co Packer');
      return noCp.includes(role) ? noCp.filter(r => r !== role) : [...noCp, role];
    });
  };

  const onWhType = (text) => {
    setWhText(text); set('warehouseCode', ''); set('warehouseName', ''); set('siteCode', '');
    if (!text.trim()) { setFilteredWH([]); setShowWH(false); return; }
    const t = text.toLowerCase();
    const f = warehouses.filter(w => w.warehouse_code?.toLowerCase().includes(t) || w.warehouse_name?.toLowerCase().includes(t));
    setFilteredWH(f); setShowWH(f.length > 0);
  };
  const pickWH = (w) => {
    setWhText(w.warehouse_code);
    setForm(p => ({ ...p, warehouseCode: w.warehouse_code, warehouseName: w.warehouse_name, siteCode: w.site_code }));
    setShowWH(false); setFilteredWH([]);
  };

  const needsWH         = roles.some(r => GUARD_ROLES.includes(r));
  const needsGuardGPLoc = roles.includes('Security Guard');
  const needsGP         = roles.includes('Gate Pass User');
  const needsCP         = roles.includes('Co Packer');
  const needsScope      = needsWH || needsGP || needsCP;
  const cpOn      = roles.includes('Co Packer');
  const hasNonCP  = roles.some(r => r !== 'Co Packer');

  const handleRegister = async () => {
    if (!roles.length) { showAlert('Error', 'Select at least one role'); return; }
    for (const e of [validateUsername(form.username), validateName(form.firstName, 'First name'),
      validateName(form.lastName, 'Last name'), validatePassword(form.password),
      validatePasswordMatch(form.password, form.confirmPassword)]) {
      if (e) { showAlert('Validation Error', e); return; }
    }
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) { showAlert('Validation Error', 'Enter a valid email'); return; }
    if (form.phone_number && !/^\d{10}$/.test(form.phone_number)) { showAlert('Validation Error', 'Enter a valid 10-digit mobile'); return; }
    if (needsWH && !form.warehouseName) { showAlert('Validation Error', 'Select a valid warehouse'); return; }
    if (needsGuardGPLoc && !form.gatePassLocation) { showAlert('Validation Error', 'Gate Pass Location is required for Security Guard'); return; }
    if (needsCP && !form.copackerLocation.trim()) { showAlert('Validation Error', 'Copacker location is required'); return; }
    if (needsGP && !form.department) { showAlert('Validation Error', 'Department is required'); return; }
    if (needsGP && !form.gatePassLocation) { showAlert('Validation Error', 'Gate Pass Location is required'); return; }

    setLoading(true);
    try {
      const payload = {
        username: form.username.trim(), password: form.password,
        first_name: form.firstName.trim(), last_name: form.lastName.trim(),
        role: roles.join(', '),
        ...(needsWH && { warehouse_code: form.warehouseCode, site_code: form.siteCode }),
        ...(needsGuardGPLoc && { gate_pass_location: form.gatePassLocation }),
        ...(needsCP && { copacker_location: form.copackerLocation.trim() }),
        ...(needsGP && { department: form.department, gate_pass_location: form.gatePassLocation }),
        ...(form.email?.trim() && { email: form.email.trim() }),
        ...(form.phone_number?.trim() && { phone_number: form.phone_number.trim() }),
      };
      const res = await adminAPI.registerUser(payload);
      showAlert('Success', res.message || 'User registered!', [{
        text: 'OK', onPress: () => { setForm({ ...EMPTY }); setRoles([]); setWhText(''); },
      }]);
    } catch (e) { showAlert('Registration Error', handleAPIError(e)); }
    finally { setLoading(false); }
  };

  const deptOpts  = DEPARTMENTS.map(d => ({ label: d, value: d }));
  const locOpts   = gpLocations.map(l => ({ label: `${l.location_code} — ${l.location_name}`, value: l.location_code }));

  return (
    <View style={S.page}>

      {/* ── CARD 1: Auth badge + Role selection ── */}
      <View style={S.card1}>
        <View style={S.authBadge}>
          <Text style={S.authBadgeText}>🔒 Local / Contractor</Text>
          <Text style={S.authBadgeNote}>Password login only</Text>
        </View>

        <Text style={S.sectionTitle}>ROLE</Text>
        {ALL_ROLES.map(role => {
          const active   = roles.includes(role);
          const disabled = (role === 'Co Packer' && hasNonCP && !active) || (role !== 'Co Packer' && cpOn && !active);
          return (
            <TouchableOpacity key={role}
              style={[S.roleBtn, active && S.roleBtnActive, disabled && S.roleBtnDisabled]}
              onPress={() => toggleRole(role)} activeOpacity={disabled ? 1 : 0.7}>
              <View style={[S.checkbox, {
                borderColor: disabled ? '#ccc' : active ? '#1976d2' : '#999',
                backgroundColor: active ? '#1976d2' : 'transparent',
              }]}>
                {active && <Text style={S.tick}>✓</Text>}
              </View>
              <Text style={[S.roleTxt, active && S.roleTxtActive, disabled && S.roleTxtDisabled]}>{role}</Text>
            </TouchableOpacity>
          );
        })}
        <Text style={S.hint}>Tap to select · tap again to deselect{'\n'}Co Packer cannot be combined</Text>
      </View>

      {/* ── CARD 2: Personal Details + Scope ── */}
      <View style={S.card2}>
        <View style={S.card2Inner}>

          {/* Details column */}
          <View style={S.detailsCol}>
            <Text style={S.sectionTitle}>PERSONAL DETAILS</Text>
            <View style={S.row}>
              <View style={S.field}><Text style={S.fieldLabel}>First Name *</Text>
                <TextInput style={S.input} placeholder="First Name" value={form.firstName} onChangeText={v => set('firstName', v)} /></View>
              <View style={S.field}><Text style={S.fieldLabel}>Last Name *</Text>
                <TextInput style={S.input} placeholder="Last Name" value={form.lastName} onChangeText={v => set('lastName', v)} /></View>
            </View>
            <View style={S.row}>
              <View style={S.field}><Text style={S.fieldLabel}>Username *</Text>
                <TextInput style={S.input} placeholder="Username" value={form.username} onChangeText={v => set('username', v)} autoCapitalize="none" /></View>
              <View style={S.field}><Text style={S.fieldLabel}>Mobile Number</Text>
                <TextInput style={S.input} placeholder="10-digit mobile" value={form.phone_number}
                  onChangeText={v => set('phone_number', v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={10} /></View>
            </View>
            <View style={S.row}>
              <View style={S.field}><Text style={S.fieldLabel}>Password *</Text>
                <TextInput style={S.input} placeholder="Password" secureTextEntry value={form.password} onChangeText={v => set('password', v)} /></View>
              <View style={S.field}><Text style={S.fieldLabel}>Confirm Password *</Text>
                <TextInput style={S.input} placeholder="Confirm Password" secureTextEntry value={form.confirmPassword} onChangeText={v => set('confirmPassword', v)} /></View>
            </View>
            <Text style={S.fieldLabel}>Email</Text>
            <TextInput style={S.input} placeholder="Email (optional)" value={form.email}
              onChangeText={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
            <TouchableOpacity style={[S.submitBtn, loading && S.submitBtnDis]} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.submitTxt}>Register Contractor</Text>}
            </TouchableOpacity>
          </View>

          {/* Scope column — only when needed */}
          {needsScope && (
            <>
              <View style={S.colDivider} />
              <View style={S.scopeCol}>
                <Text style={S.sectionTitle}>SCOPE</Text>

                {needsWH && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={S.scopeSubLabel}>Warehouse *</Text>
                    <View style={S.whWrap}>
                      <TextInput style={[S.input, { marginBottom: 0 }]} placeholder="Type code or name..."
                        value={whText} onChangeText={onWhType} autoCapitalize="characters" />
                      {showWH && (
                        <View style={S.whDrop}>
                          <ScrollView style={{ maxHeight: 130 }} nestedScrollEnabled>
                            {filteredWH.map(w => (
                              <TouchableOpacity key={w.warehouse_code} style={S.whItem} onPress={() => pickWH(w)}>
                                <Text style={S.whCode}>{w.warehouse_code}</Text>
                                <Text style={S.whName}>{w.warehouse_name}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={S.dimLabel}>Name</Text>
                        <TextInput style={[S.input, S.inputDis, { marginBottom: 0 }]} value={form.warehouseName} editable={false} />
                      </View>
                      <View style={{ width: 72 }}>
                        <Text style={S.dimLabel}>Site Code</Text>
                        <TextInput style={[S.input, S.inputDis, { marginBottom: 0 }]} value={form.siteCode} editable={false} />
                      </View>
                    </View>
                  </View>
                )}

                {needsGuardGPLoc && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={S.scopeSubLabel}>Security Guard</Text>
                    <InlineDropdown label="Gate Pass Location *" value={form.gatePassLocation} options={locOpts}
                      onSelect={v => set('gatePassLocation', v)} placeholder="Select gate location..." />
                  </View>
                )}

                {needsGP && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={S.scopeSubLabel}>Gate Pass User</Text>
                    <InlineDropdown label="Department *" value={form.department} options={deptOpts}
                      onSelect={v => set('department', v)} placeholder="Select department..." />
                    <InlineDropdown label="Gate Pass Location *" value={form.gatePassLocation} options={locOpts}
                      onSelect={v => set('gatePassLocation', v)} placeholder="Select location..." />
                  </View>
                )}

                {needsCP && (
                  <View>
                    <Text style={S.scopeSubLabel}>Co Packer</Text>
                    <View style={S.cpNote}><Text style={S.cpNoteText}>⚠ Exclusive — no other roles</Text></View>
                    <Text style={S.fieldLabel}>Location *</Text>
                    <TextInput style={S.input} placeholder="Enter location..." value={form.copackerLocation} onChangeText={v => set('copackerLocation', v)} />
                  </View>
                )}

                {roles.length === 1 && roles[0] === 'IT Admin' && (
                  <View style={S.itNote}><Text style={S.itNoteTxt}>System-wide access.{'\n'}No scope required.</Text></View>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  page:         { flex: 1, flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#f4f6f8' },
  card1:        { width: 195, backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: '#e0e0e0', padding: 14, flexShrink: 0 },
  card2:        { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: '#e0e0e0', padding: 20 },
  card2Inner:   { flex: 1, flexDirection: 'row' },
  detailsCol:   { flex: 1, maxWidth: 680 },
  colDivider:   { width: 1, backgroundColor: '#efefef', marginHorizontal: 16, alignSelf: 'stretch' },
  scopeCol:     { width: 290, flexShrink: 0 },
  authBadge:    { backgroundColor: '#f3e5f5', borderRadius: 7, borderWidth: 0.5, borderColor: '#ce93d8', padding: 8, marginBottom: 14 },
  authBadgeText:{ fontSize: 12, color: '#6a1b9a', fontWeight: '700' },
  authBadgeNote:{ fontSize: 11, color: '#9c27b0', marginTop: 2 },
  sectionTitle: { fontSize: 10, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 10 },
  scopeSubLabel:{ fontSize: 11, fontWeight: '700', color: '#1976d2', letterSpacing: 0.4, marginBottom: 8 },
  hint:         { fontSize: 10, color: '#ccc', marginTop: 8, lineHeight: 15 },
  // Roles
  roleBtn:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 9, borderRadius: 7, borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fafafa', marginBottom: 5 },
  roleBtnActive:{ borderColor: '#1976d2', backgroundColor: '#e8f1fb' },
  roleBtnDisabled: { opacity: 0.4 },
  checkbox:     { width: 14, height: 14, borderRadius: 3, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 7, flexShrink: 0 },
  tick:         { color: '#fff', fontSize: 8, fontWeight: '900', lineHeight: 10 },
  roleTxt:      { fontSize: 12, fontWeight: '500', color: '#555', flex: 1 },
  roleTxtActive:{ color: '#1565c0', fontWeight: '600' },
  roleTxtDisabled: { color: '#bbb' },
  // Form
  row:          { flexDirection: 'row', gap: 10 },
  field:        { flex: 1 },
  fieldLabel:   { fontSize: 12, fontWeight: '600', color: '#444', marginBottom: 4 },
  dimLabel:     { fontSize: 10, color: '#999', marginBottom: 3 },
  input:        { backgroundColor: '#f8f9fa', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 12, fontSize: 13, color: '#333' },
  inputDis:     { backgroundColor: '#efefef', color: '#999' },
  submitBtn:    { backgroundColor: '#1976d2', paddingVertical: 12, borderRadius: 8, marginTop: 8, alignItems: 'center' },
  submitBtnDis: { backgroundColor: '#b0bec5' },
  submitTxt:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Scope
  whWrap:       { position: 'relative', zIndex: 999 },
  whDrop:       { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderTopWidth: 0, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, zIndex: 999, elevation: 5 },
  whItem:       { padding: 9, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  whCode:       { fontSize: 12, fontWeight: '700', color: '#1976d2' },
  whName:       { fontSize: 11, color: '#777' },
  ddTrigger:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8f9fa', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 12 },
  ddTriggerText:{ fontSize: 12, color: '#333', flex: 1 },
  ddMenu:       { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, zIndex: 9999, elevation: 6 },
  ddItem:       { paddingVertical: 9, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: '#f3f3f3' },
  ddItemActive: { backgroundColor: '#e8f1fb' },
  ddItemText:   { fontSize: 12, color: '#444' },
  ddItemTextActive: { color: '#1565c0', fontWeight: '600' },
  cpNote:       { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 6, padding: 7, marginBottom: 8 },
  cpNoteText:   { fontSize: 11, color: '#b45309' },
  itNote:       { backgroundColor: '#e3f2fd', borderRadius: 7, padding: 10 },
  itNoteTxt:    { fontSize: 11, color: '#1565c0', lineHeight: 17 },
};
