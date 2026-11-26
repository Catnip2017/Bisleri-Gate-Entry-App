import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { adminAPI, gatePassAPI, handleAPIError } from '../../../services/api';
import { validateUsername, validatePassword, validateName, validatePasswordMatch, validateMobile } from '../utils/validation';
import { showAlert } from '../../../utils/customModal';
// Same searchable multi-select (with ★ default) used by Assign Access, so
// Register and Update behave identically (30 Oct 2026).
import { LocationMultiSelect } from './AssignAccessScreen';
import { ROLE_INFO, roleBlockReason, accessPreview, generatePassword, passwordStrength, PasswordChecklist } from '../utils/userUi';
import InventoryScope, {
  INV_OPERATOR, INV_VIEWER, EMPTY_INV_SCOPE, needsInventoryScope, inventoryScopeError,
} from '../utils/InventoryScope';

// 25 Nov 2026: Register is now 4 steps — Role → Details → Scope → Review —
// so only the fields the chosen role needs are asked for. The final submit
// (handleRegister) and every validation in it are unchanged.
const STEPS = ['Role', 'Details', 'Scope', 'Review'];

// Role model LOCKED 14 Jul 2026 — same matrix as Assign Access + backend.
const ALL_ROLES   = ['Security Guard', 'Gate Pass Dispatcher', 'IT Admin', 'Gate Pass Creator', 'Security Admin', 'Co Packer',
  INV_OPERATOR, INV_VIEWER];   // Blinkit Inventory Portal roles (26 Nov 2026), exclusive
const GUARD_ROLES = ['Security Guard', 'Security Admin'];

const EMPTY = {
  username: '', password: '', confirmPassword: '',
  firstName: '', lastName: '', email: '', phone_number: '',
  warehouseCode: '', warehouseName: '', siteCode: '',
  copackerLocation: '', department: '', gatePassLocation: '',
};

// Dropdown menus hang directly under their trigger (trigger has no bottom
// margin; menu gets a full border + small gap) so the first row is never
// hidden by a detached/borderless panel (30 Oct 2026).
const MENU_FIX = { borderTopWidth: 1, borderRadius: 8, marginTop: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8 };

// ── Reusable inline Dropdown ───────────────────────────────────────────────
function InlineDropdown({ label, value, options, onSelect, placeholder = 'Select...' }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <View style={{ marginBottom: 12, zIndex: open ? 999 : 1 }}>
      {label ? <Text style={S.fieldLabel}>{label}</Text> : null}
      <TouchableOpacity style={[S.ddTrigger, { marginBottom: 0 }]} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={[S.ddTriggerText, !selected && { color: '#bbb' }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={{ color: '#aaa', fontSize: 11 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={[S.ddMenu, MENU_FIX]}>
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
  const [gpLocSelections, setGpLocSelections] = useState([]);   // [{location_code,is_default}]
  const [departments, setDepartments]         = useState([]);   // live from gate_pass_departments
  const [loading, setLoading]                 = useState(false);
  const [whText, setWhText]                   = useState('');
  const [showWH, setShowWH]                   = useState(false);
  const [filteredWH, setFilteredWH]           = useState([]);
  const [step, setStep]                       = useState(0);
  const [showPwd, setShowPwd]                 = useState(false);
  const [userStatus, setUserStatus]           = useState(null);   // null | 'checking' | 'available' | 'taken'
  const [invScope, setInvScope]               = useState(EMPTY_INV_SCOPE);

  // Live "username available?" check (uses the existing user search)
  useEffect(() => {
    const u = form.username.trim();
    if (!u || validateUsername(u)) { setUserStatus(null); return; }
    setUserStatus('checking');
    const t = setTimeout(async () => {
      try {
        const res = await adminAPI.searchUsers(u);
        const taken = (res || []).some(x => (x.username || '').toLowerCase() === u.toLowerCase());
        setUserStatus(taken ? 'taken' : 'available');
      } catch (e) { setUserStatus(null); }
    }, 450);
    return () => clearTimeout(t);
  }, [form.username]);

  useEffect(() => {
    adminAPI.getWarehouses().then(setWarehouses).catch(() => {});
    gatePassAPI.getLocations().then(d => setGpLocations(d || [])).catch(() => {});
    gatePassAPI.getDepartments().then(d => setDepartments(d?.departments || [])).catch(() => {});
  }, []);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const toggleRole = (role) => {
    // Inventory Portal roles are exclusive: picking one replaces any others
    // (the cards are greyed while another role is ticked).
    if (role === INV_OPERATOR || role === INV_VIEWER) {
      setRoles(prev => (prev.includes(role) ? [] : [role]));
      return;
    }
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
      // Security Admin is standalone (view-only oversight, one warehouse)
      if (role === 'Security Admin') {
        if (noCp.length > 0 && !noCp.includes(role)) {
          showAlert('Not Allowed', 'Security Admin is a standalone role — untick the other roles first.');
          return prev;
        }
      } else if (noCp.includes('Security Admin')) {
        showAlert('Not Allowed', 'Security Admin is a standalone role — untick it before adding another role.');
        return prev;
      }
      if (noCp.includes(role)) {
        let next = noCp.filter(r => r !== role);
        // GPD can never stand alone — removing SG removes it too
        if (role === 'Security Guard') next = next.filter(r => r !== 'Gate Pass Dispatcher');
        return next;
      }
      // Combo rules (LOCKED 14 Jul 2026) — mirrored server-side
      if (role === 'Gate Pass Dispatcher' && !noCp.includes('Security Guard')) {
        showAlert('Not Allowed',
          'Gate Pass Dispatcher can only be assigned together with Security Guard. Tick Security Guard first.');
        return prev;
      }
      if (role === 'Gate Pass Creator' &&
          (noCp.includes('Security Guard') || noCp.includes('Gate Pass Dispatcher'))) {
        showAlert('Not Allowed',
          'Gate Pass Creator cannot be combined with Security Guard or Gate Pass Dispatcher — the person who creates a pass can never be the one who dispatches or receives it.');
        return prev;
      }
      if (role === 'IT Admin' &&
          (noCp.includes('Security Guard') || noCp.includes('Gate Pass Dispatcher'))) {
        showAlert('Not Allowed', 'IT Admin cannot be combined with Security Guard or Gate Pass Dispatcher.');
        return prev;
      }
      if (role === 'Security Guard' &&
          (noCp.includes('Gate Pass Creator') || noCp.includes('IT Admin'))) {
        showAlert('Not Allowed',
          'Security Guard cannot be combined with IT Admin or Gate Pass Creator.');
        return prev;
      }
      return [...noCp, role];
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
  const needsGuardGPLoc = roles.includes('Gate Pass Dispatcher') || roles.includes('Security Admin');
  const needsGP         = roles.includes('Gate Pass Creator');
  // Security Admin: Gate Pass locations are optional (26 Nov 2026)
  const gpLocRequired   = roles.includes('Gate Pass Dispatcher') || needsGP;
  const needsCP         = roles.includes('Co Packer');
  const needsInv        = needsInventoryScope(roles);
  const needsScope      = needsWH || needsGP || needsCP || needsInv;
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
    { const m = validateMobile(form.phone_number); if (m) { showAlert('Validation Error', m); return; } }
    if (needsWH && !form.warehouseName) { showAlert('Validation Error', 'Select a valid warehouse'); return; }
    if (roles.includes('Gate Pass Dispatcher') && gpLocSelections.length === 0) { showAlert('Validation Error', 'At least one Gate Pass Location is required for Gate Pass Dispatcher'); return; }
    if (needsCP && !form.copackerLocation.trim()) { showAlert('Validation Error', 'Copacker location is required'); return; }
    if (needsGP && !form.department) { showAlert('Validation Error', 'Department is required'); return; }
    if (needsGP && gpLocSelections.length === 0) { showAlert('Validation Error', 'At least one Gate Pass Location is required'); return; }
    { const ie = inventoryScopeError(roles, invScope); if (ie) { showAlert('Validation Error', ie); return; } }

    setLoading(true);
    try {
      const payload = {
        username: form.username.trim(), password: form.password,
        first_name: form.firstName.trim(), last_name: form.lastName.trim(),
        role: roles.join(', '),
        ...(needsWH && { warehouse_code: form.warehouseCode, site_code: form.siteCode }),
        ...((needsGuardGPLoc || needsGP) && { gate_pass_locations: gpLocSelections }),
        ...(needsCP && { copacker_location: form.copackerLocation.trim() }),
        ...(needsGP && { department: form.department }),
        ...(form.email?.trim() && { email: form.email.trim() }),
        ...(form.phone_number?.trim() && { phone_number: form.phone_number.trim() }),
        ...(needsInv && {
          inventory_warehouses: invScope.warehouses,
          inventory_viewers: roles.includes(INV_OPERATOR) ? invScope.viewers : [],
          store_code: roles.includes(INV_VIEWER) ? invScope.store_code : null,
        }),
      };
      const res = await adminAPI.registerUser(payload);
      showAlert('Success', res.message || 'User registered!', [{
        text: 'OK', onPress: () => { setForm({ ...EMPTY }); setRoles([]); setWhText(''); setGpLocSelections([]); setInvScope(EMPTY_INV_SCOPE); setStep(0); setShowPwd(false); },
      }]);
    } catch (e) { showAlert('Registration Error', handleAPIError(e)); }
    finally { setLoading(false); }
  };

  const deptOpts  = departments.map(d => ({ label: d, value: d }));
  const locOpts   = gpLocations.map(l => ({ label: `${l.location_code} — ${l.location_name}`, value: l.location_code }));

  // Per-step checks — same messages as handleRegister, just asked earlier
  const stepError = (n) => {
    if (n === 0) return roles.length ? null : 'Select at least one role';
    if (n === 1) {
      for (const e of [validateName(form.firstName, 'First name'), validateName(form.lastName, 'Last name'),
        validateUsername(form.username), validatePassword(form.password),
        validatePasswordMatch(form.password, form.confirmPassword)]) { if (e) return e; }
      if (userStatus === 'taken') return 'That username is already taken';
      if (form.email && !/\S+@\S+\.\S+/.test(form.email)) return 'Enter a valid email';
      { const m = validateMobile(form.phone_number); if (m) return m; }
      return null;
    }
    if (n === 2) {
      if (needsWH && !form.warehouseName) return 'Select a valid warehouse';
      if (needsGP && !form.department) return 'Department is required';
      if (gpLocRequired && gpLocSelections.length === 0) return 'At least one Gate Pass Location is required';
      if (needsCP && !form.copackerLocation.trim()) return 'Copacker location is required';
      { const ie = inventoryScopeError(roles, invScope); if (ie) return ie; }
      return null;
    }
    return null;
  };
  const goNext = () => {
    const e = stepError(step);
    if (e) { showAlert('Validation Error', e); return; }
    setStep(st => Math.min(st + 1, STEPS.length - 1));
  };

  const strength = passwordStrength(form.password);
  const preview = accessPreview(roles, {
    warehouse: form.warehouseCode,
    locations: gpLocSelections.map(g => g.location_code),
    department: form.department,
    copacker: form.copackerLocation,
    inventory: invScope,
  });
  const summaryRows = [
    ['Account', 'Local / Contractor (password login)'],
    ['Role', roles.join(', ') || '—'],
    ['Name', `${form.firstName} ${form.lastName}`.trim() || '—'],
    ['Username', form.username || '—'],
    ['Mobile', form.phone_number || '—'],
    ...(needsWH ? [['Warehouse', form.warehouseCode ? `${form.warehouseCode} — ${form.warehouseName}` : '—']] : []),
    ...(needsGP ? [['Department', form.department || '—']] : []),
    ...((needsGuardGPLoc || needsGP) ? [['Gate Pass Locations', gpLocSelections.map(g => g.location_code).join(', ') || '—']] : []),
    ...(needsCP ? [['Co Packer location', form.copackerLocation || '—']] : []),
    ...(roles.includes(INV_VIEWER) ? [['Blinkit store', invScope.store_code || '—']] : []),
    ...(needsInv ? [['Inventory warehouses', invScope.warehouses.join(', ') || '—']] : []),
    ...(roles.includes(INV_OPERATOR) ? [['Blinkit users', invScope.viewers.join(', ') || '—']] : []),
  ];

  return (
    <View style={S.wizPage}>
      <View style={S.wizCard}>
        {/* Stepper */}
        <View style={S.stepper}>
          {STEPS.map((label, n) => {
            const done = n < step, current = n === step;
            return (
              <TouchableOpacity key={label} style={S.stepItem}
                onPress={() => { if (n < step) setStep(n); }} disabled={n >= step}
                accessibilityRole="button" accessibilityLabel={`Step ${n + 1}: ${label}`}>
                <View style={[S.stepDot, done && S.stepDotDone, current && S.stepDotCur]}>
                  <Text style={[S.stepDotTxt, (done || current) && { color: '#fff' }]}>{done ? '✓' : n + 1}</Text>
                </View>
                <Text style={[S.stepLabel, (done || current) && { color: '#12202A' }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={S.wizBody}>
          <View style={{ flex: 1, minWidth: 0 }}>

            {/* ── Step 1: Role ── */}
            {step === 0 && (
              <View>
                <View style={S.authBadge}>
                  <Text style={S.authBadgeText}>🔒 Local / Contractor</Text>
                  <Text style={S.authBadgeNote}>Password login only</Text>
                </View>
                <Text style={S.sectionTitle}>WHAT WILL THIS PERSON DO?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ALL_ROLES.map(role => {
                    const active = roles.includes(role);
                    const reason = roleBlockReason(role, roles);
                    const disabled = !active && !!reason;
                    return (
                      <TouchableOpacity key={role}
                        onPress={() => !disabled && toggleRole(role)} disabled={disabled}
                        accessibilityRole="checkbox" accessibilityState={{ checked: active, disabled }}
                      accessibilityLabel={`${role}${disabled ? ' (not available)' : ''}`}
                        style={[S.roleCard, active && S.roleCardOn, disabled && S.roleCardOff]}>
                        <Text style={[S.roleCardTitle, active && { color: '#0B5236' }]}>{active ? '☑' : '☐'} {role}</Text>
                        <Text style={[S.roleCardSub, disabled && { color: '#A35F00' }]} numberOfLines={2}>
                          {disabled ? reason : ROLE_INFO[role]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Step 2: Details ── */}
            {step === 1 && (
              <View>
                <Text style={S.sectionTitle}>PERSONAL DETAILS</Text>
                <View style={S.row}>
                  <View style={S.field}><Text style={S.fieldLabel}>First Name *</Text>
                    <TextInput style={S.input} placeholder="First Name" value={form.firstName} onChangeText={v => set('firstName', v)} /></View>
                  <View style={S.field}><Text style={S.fieldLabel}>Last Name *</Text>
                    <TextInput style={S.input} placeholder="Last Name" value={form.lastName} onChangeText={v => set('lastName', v)} /></View>
                </View>
                <View style={S.row}>
                  <View style={S.field}><Text style={S.fieldLabel}>Username *</Text>
                    <TextInput style={S.input} placeholder="Username" value={form.username} onChangeText={v => set('username', v)} autoCapitalize="none" />
                    {userStatus ? (
                      <Text style={[S.inlineMsg, { color: userStatus === 'available' ? '#2FB164' : userStatus === 'taken' ? '#C62828' : '#8B99A3' }]}>
                        {userStatus === 'available' ? '✓ Available' : userStatus === 'taken' ? '✕ Already taken' : 'Checking…'}
                      </Text>
                    ) : null}
                  </View>
                  <View style={S.field}><Text style={S.fieldLabel}>Mobile Number *</Text>
                    <TextInput style={S.input} placeholder="10-digit mobile" value={form.phone_number}
                      onChangeText={v => set('phone_number', v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={10} /></View>
                </View>
                <Text style={S.fieldLabel}>Email</Text>
                <TextInput style={S.input} placeholder="Email (optional)" value={form.email}
                  onChangeText={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
                <View style={[S.row, { alignItems: 'flex-end' }]}>
                  <View style={S.field}><Text style={S.fieldLabel}>Password *</Text>
                    <TextInput style={S.input} placeholder="Password" secureTextEntry={!showPwd} value={form.password} onChangeText={v => set('password', v)} autoCapitalize="none" /></View>
                  <View style={S.field}><Text style={S.fieldLabel}>Confirm Password *</Text>
                    <TextInput style={S.input} placeholder="Confirm Password" secureTextEntry={!showPwd} value={form.confirmPassword} onChangeText={v => set('confirmPassword', v)} autoCapitalize="none" /></View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: -4 }}>
                  <TouchableOpacity style={S.outlineBtn}
                    onPress={() => { const pw = generatePassword(); setForm(p => ({ ...p, password: pw, confirmPassword: pw })); setShowPwd(true); }}>
                    <Text style={S.outlineBtnTxt}>⚄ Generate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.outlineBtn} onPress={() => setShowPwd(v => !v)}>
                    <Text style={S.outlineBtnTxt}>{showPwd ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                  {strength ? (
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <View style={{ height: 5, borderRadius: 3, backgroundColor: '#E0E9E5' }}>
                        <View style={{ height: 5, borderRadius: 3, width: `${strength.pct}%`, backgroundColor: strength.color }} />
                      </View>
                      <Text style={{ fontSize: 11.5, color: strength.color, marginTop: 3, fontWeight: '600' }}>{strength.label}</Text>
                    </View>
                  ) : <View style={{ flex: 1 }} />}
                </View>
                <View style={{ marginTop: 12 }}><PasswordChecklist password={form.password} /></View>
                {form.confirmPassword ? (
                  <Text style={[S.inlineMsg, { marginTop: 0, color: form.confirmPassword === form.password ? '#2FB164' : '#C62828' }]}>
                    {form.confirmPassword === form.password ? '✓ Passwords match' : "✕ Passwords don't match"}
                  </Text>
                ) : null}
              </View>
            )}

            {/* ── Step 3: Scope ── */}
            {step === 2 && (
              <View>
                <Text style={S.sectionTitle}>SCOPE</Text>
                {!needsScope && (
                  <View style={S.itNote}><Text style={S.itNoteTxt}>The chosen role needs no warehouse or location — continue to Review.</Text></View>
                )}
                {needsWH && (
                  <View style={{ marginBottom: 14, zIndex: showWH ? 100 : 3, maxWidth: 520 }}>
                    <Text style={S.scopeSubLabel}>Warehouse *</Text>
                    <View style={S.whWrap}>
                      <TextInput style={[S.input, { marginBottom: 0 }]} placeholder="Type code or name..."
                        value={whText} onChangeText={onWhType} autoCapitalize="characters" />
                      {showWH && (
                        <View style={S.whDrop}>
                          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
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
                      <View style={{ width: 90 }}>
                        <Text style={S.dimLabel}>Site Code</Text>
                        <TextInput style={[S.input, S.inputDis, { marginBottom: 0 }]} value={form.siteCode} editable={false} />
                      </View>
                    </View>
                  </View>
                )}
                {(needsGuardGPLoc || needsGP) && (
                  <View style={{ marginBottom: 14, zIndex: 2, maxWidth: 520 }}>
                    <Text style={S.scopeSubLabel}>Gate Pass</Text>
                    {needsGP && (
                      <InlineDropdown label="Department *" value={form.department} options={deptOpts}
                        onSelect={v => set('department', v)} placeholder="Select department..." />
                    )}
                    <Text style={S.fieldLabel}>
                      {needsGP ? 'Gate Pass Locations * (★ = default)' : gpLocRequired ? 'Gate Pass Locations *' : 'Gate Pass Locations (optional)'}
                    </Text>
                    {roles.includes('Security Admin') && !gpLocRequired ? (
                      <Text style={{ fontSize: 11.5, color: '#8B99A3', marginBottom: 6 }}>
                        Optional for Security Admin — leave empty if this person does not oversee gate passes (their Gate Pass page will say no location is assigned).
                      </Text>
                    ) : null}
                    <LocationMultiSelect
                      options={gpLocations}
                      selections={gpLocSelections}
                      onChange={setGpLocSelections}
                      showStar={needsGP}
                    />
                  </View>
                )}
                {needsInv && (
                  <View style={{ zIndex: 4, maxWidth: 520 }}>
                    <InventoryScope roles={roles} value={invScope} onChange={setInvScope} warehouses={warehouses} />
                  </View>
                )}
                {needsCP && (
                  <View style={{ zIndex: 1, maxWidth: 520 }}>
                    <Text style={S.scopeSubLabel}>Co Packer</Text>
                    <Text style={S.fieldLabel}>Location *</Text>
                    <TextInput style={S.input} placeholder="Enter location..." value={form.copackerLocation} onChangeText={v => set('copackerLocation', v)} />
                  </View>
                )}
              </View>
            )}

            {/* ── Step 4: Review ── */}
            {step === 3 && (
              <View>
                <Text style={S.sectionTitle}>REVIEW</Text>
                {summaryRows.map(([k, v]) => (
                  <View key={k} style={S.reviewRow}>
                    <Text style={S.reviewKey}>{k}</Text>
                    <Text style={S.reviewVal}>{v}</Text>
                  </View>
                ))}
                <View style={S.previewBox}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#12202A', marginBottom: 6 }}>What this user will see</Text>
                  {preview.yes.map(l => <Text key={l} style={{ fontSize: 12.5, color: '#2B3A42', lineHeight: 20 }}>✓ {l}</Text>)}
                  {preview.no.map(l => <Text key={l} style={{ fontSize: 12.5, color: '#8B99A3', lineHeight: 20 }}>✕ {l}</Text>)}
                </View>
              </View>
            )}
          </View>

          {/* Summary (steps 1–3) */}
          {step < 3 && (
            <View style={S.summaryCard}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#12202A', marginBottom: 8 }}>Summary</Text>
              {summaryRows.map(([k, v]) => (
                <Text key={k} style={{ fontSize: 12.5, color: '#5B6B75', lineHeight: 20 }} numberOfLines={2}>
                  <Text style={{ fontWeight: '600', color: '#2B3A42' }}>{k}: </Text>{v}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={S.wizFooter}>
          {step > 0 ? (
            <TouchableOpacity style={S.outlineBtn} onPress={() => setStep(st => st - 1)} disabled={loading}>
              <Text style={S.outlineBtnTxt}>‹ Back</Text>
            </TouchableOpacity>
          ) : <View />}
          {step < 3 ? (
            <TouchableOpacity style={S.primaryBtn} onPress={goNext}>
              <Text style={S.submitTxt}>Next: {STEPS[step + 1]} ›</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[S.primaryBtn, loading && S.submitBtnDis]} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.submitTxt}>Register User</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  // Wizard (25 Nov 2026)
  wizPage:      { flex: 1, padding: 16, backgroundColor: '#EEF5F2', alignItems: 'center' },
  wizCard:      { width: '100%', maxWidth: 1040, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E0E9E5' },
  stepper:      { flexDirection: 'row', paddingHorizontal: 22, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E0E9E5', gap: 8 },
  stepItem:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot:      { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E6F1EC', alignItems: 'center', justifyContent: 'center' },
  stepDotDone:  { backgroundColor: '#2FB164' },
  stepDotCur:   { backgroundColor: '#0F6B46' },
  stepDotTxt:   { fontSize: 13, fontWeight: '700', color: '#5B6B75' },
  stepLabel:    { fontSize: 14, fontWeight: '700', color: '#8B99A3' },
  wizBody:      { flexDirection: 'row', gap: 20, padding: 22, alignItems: 'flex-start', zIndex: 5, minHeight: 380 },
  wizFooter:    { zIndex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E0E9E5' },
  summaryCard:  { width: 290, backgroundColor: '#FAFCFB', borderRadius: 12, borderWidth: 1, borderColor: '#E0E9E5', padding: 14 },
  roleCard:     { width: '48.5%', minHeight: 64, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0E9E5', backgroundColor: '#fff', paddingVertical: 9, paddingHorizontal: 11 },
  roleCardOn:   { borderColor: '#0F6B46', backgroundColor: '#EAF5F0' },
  roleCardOff:  { backgroundColor: '#F7F8F8', opacity: 0.6 },
  roleCardTitle:{ fontSize: 13.5, fontWeight: '700', color: '#12202A' },
  roleCardSub:  { fontSize: 11.5, color: '#5B6B75', marginTop: 2 },
  inlineMsg:    { fontSize: 12, fontWeight: '600', marginTop: -8, marginBottom: 10 },
  outlineBtn:   { borderWidth: 1.5, borderColor: '#0F6B46', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: '#fff' },
  outlineBtnTxt:{ color: '#0F6B46', fontWeight: '700', fontSize: 13 },
  primaryBtn:   { backgroundColor: '#0F6B46', borderRadius: 8, paddingVertical: 11, paddingHorizontal: 22, minWidth: 170, alignItems: 'center' },
  reviewRow:    { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F0F4F2' },
  reviewKey:    { width: 170, fontSize: 13, color: '#5B6B75' },
  reviewVal:    { flex: 1, fontSize: 13, fontWeight: '600', color: '#12202A' },
  previewBox:   { marginTop: 14, borderWidth: 1, borderColor: '#E0E9E5', borderRadius: 10, padding: 12, backgroundColor: '#FAFCFB' },
  page:         { flex: 1, flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#f4f6f8' },
  card1:        { width: 280, backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: '#e0e0e0', padding: 16, flexShrink: 0 },
  card2:        { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: '#e0e0e0', padding: 20 },
  card2Inner:   { flex: 1, flexDirection: 'row' },
  detailsCol:   { flex: 1, maxWidth: 680 },
  colDivider:   { width: 1, backgroundColor: '#efefef', marginHorizontal: 16, alignSelf: 'stretch' },
  scopeCol:     { width: 290, flexShrink: 0 },
  authBadge:    { backgroundColor: '#f3e5f5', borderRadius: 7, borderWidth: 0.5, borderColor: '#ce93d8', padding: 8, marginBottom: 14 },
  authBadgeText:{ fontSize: 12, color: '#6a1b9a', fontWeight: '700' },
  authBadgeNote:{ fontSize: 11, color: '#9c27b0', marginTop: 2 },
  sectionTitle: { fontSize: 10, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 10 },
  scopeSubLabel:{ fontSize: 11, fontWeight: '700', color: '#0F6B46', letterSpacing: 0.4, marginBottom: 8 },
  hint:         { fontSize: 10, color: '#ccc', marginTop: 8, lineHeight: 15 },
  // Roles
  roleBtn:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 9, borderRadius: 7, borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fafafa', marginBottom: 5 },
  roleBtnActive:{ borderColor: '#0F6B46', backgroundColor: '#E6F1EC' },
  roleBtnDisabled: { opacity: 0.4 },
  checkbox:     { width: 14, height: 14, borderRadius: 3, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 7, flexShrink: 0 },
  tick:         { color: '#fff', fontSize: 8, fontWeight: '900', lineHeight: 10 },
  roleTxt:      { fontSize: 12, fontWeight: '500', color: '#555', flex: 1 },
  roleTxtActive:{ color: '#0B5236', fontWeight: '600' },
  roleTxtDisabled: { color: '#bbb' },
  // Form
  row:          { flexDirection: 'row', gap: 10 },
  field:        { flex: 1 },
  fieldLabel:   { fontSize: 12, fontWeight: '600', color: '#444', marginBottom: 4 },
  dimLabel:     { fontSize: 10, color: '#999', marginBottom: 3 },
  input:        { backgroundColor: '#f8f9fa', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 12, fontSize: 13, color: '#333' },
  inputDis:     { backgroundColor: '#efefef', color: '#999' },
  submitBtn:    { backgroundColor: '#0F6B46', paddingVertical: 12, borderRadius: 8, marginTop: 8, alignItems: 'center' },
  submitBtnDis: { backgroundColor: '#b0bec5' },
  submitTxt:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Scope
  whWrap:       { position: 'relative', zIndex: 999 },
  whDrop:       { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderTopWidth: 0, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, zIndex: 999, elevation: 5 },
  whItem:       { padding: 9, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  whCode:       { fontSize: 12, fontWeight: '700', color: '#0F6B46' },
  whName:       { fontSize: 11, color: '#777' },
  ddTrigger:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8f9fa', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 12 },
  ddTriggerText:{ fontSize: 12, color: '#333', flex: 1 },
  ddMenu:       { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, zIndex: 9999, elevation: 6 },
  ddItem:       { paddingVertical: 9, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: '#f3f3f3' },
  ddItemActive: { backgroundColor: '#E6F1EC' },
  ddItemText:   { fontSize: 12, color: '#444' },
  ddItemTextActive: { color: '#0B5236', fontWeight: '600' },
  cpNote:       { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 6, padding: 7, marginBottom: 8 },
  cpNoteText:   { fontSize: 11, color: '#b45309' },
  itNote:       { backgroundColor: '#E6F1EC', borderRadius: 7, padding: 10 },
  itNoteTxt:    { fontSize: 11, color: '#0B5236', lineHeight: 17 },
};
