// app/admin/screens/UsersListScreen.js - "Users" tab of User Management
// (25 Nov 2026). Every user in one table with search + filters, so an admin
// can find people without knowing their name first, and see at a glance who
// is inactive or hasn't logged in for a while (supports periodic user access
// reviews and dormant-account clean-up). Clicking a row opens the user in
// the Assign Access editor.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { adminAPI, handleAPIError } from '../../../services/api';
import { daysSinceLogin, shortLastLogin, initialsOf } from '../utils/userUi';

const ROLE_FILTERS = ['All roles', 'Security Guard', 'Gate Pass Dispatcher', 'IT Admin',
  'Gate Pass Creator', 'Security Admin', 'Co Packer', 'Bisleri Inventory Operator', 'Blinkit Inventory Viewer', 'No role'];
const STATUS_FILTERS = ['All', 'Active', 'Deactivated'];
const ACTIVITY_FILTERS = [
  ['any', 'Any login'],
  ['30', 'Logged in last 30 days'],
  ['60+', 'No login 60+ days'],
  ['90+', 'No login 90+ days'],
  ['never', 'Never logged in'],
];

const roleList = (u) => (u.role || '').split(',').map((r) => r.trim()).filter(Boolean);

// Small select built from chips in a popover (no native <select> on RN)
function FilterSelect({ label, value, options, onChange, width = 190 }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o[0] === value);
  return (
    <View style={{ width, zIndex: open ? 50 : 1 }}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        style={S.select}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current ? current[1] : value}`}
      >
        <Text style={S.selectTxt} numberOfLines={1}>
          <Text style={{ color: '#8B99A3' }}>{label}: </Text>{current ? current[1] : value}
        </Text>
        <Text style={{ color: '#8B99A3', fontSize: 10 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={S.selectMenu}>
          {options.map(([v, l]) => (
            <TouchableOpacity key={v} onPress={() => { onChange(v); setOpen(false); }}
              style={[S.selectItem, v === value && { backgroundColor: '#E6F1EC' }]}>
              <Text style={{ fontSize: 13, color: '#12202A', fontWeight: v === value ? '700' : '400' }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// Multi-select with checkboxes + a search box (25 Nov 2026). selected = []
// means "all". Used for Role and Warehouse.
function MultiFilter({ label, allLabel, selected, options, onChange, width = 200 }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const shown = term ? options.filter((o) => o.toLowerCase().includes(term)) : options;
  const toggle = (o) => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  const summary = selected.length === 0 ? allLabel
    : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  return (
    <View style={{ width, zIndex: open ? 50 : 1 }}>
      <TouchableOpacity
        onPress={() => { setOpen((o) => !o); setSearch(''); }}
        style={[S.select, selected.length > 0 && { borderColor: '#0F6B46' }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${summary}`}
      >
        <Text style={S.selectTxt} numberOfLines={1}>
          <Text style={{ color: '#8B99A3' }}>{label}: </Text>{summary}
        </Text>
        <Text style={{ color: '#8B99A3', fontSize: 10 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={[S.selectMenu, { paddingTop: 6 }]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${label.toLowerCase()}…`}
            placeholderTextColor="#8B99A3"
            autoFocus
            autoCapitalize="none"
            style={{
              marginHorizontal: 8, marginBottom: 4, borderWidth: 1, borderColor: '#CFDDD7', borderRadius: 8,
              paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: '#12202A',
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 4 }}>
            <TouchableOpacity onPress={() => onChange([])}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F6B46' }}>{allLabel}</Text>
            </TouchableOpacity>
            {selected.length > 0 && (
              <TouchableOpacity onPress={() => onChange([])}>
                <Text style={{ fontSize: 12, color: '#C62828' }}>Clear ({selected.length})</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={{ maxHeight: 260, marginBottom: 4 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {shown.map((o) => {
              const on = selected.includes(o);
              return (
                <TouchableOpacity key={o} onPress={() => toggle(o)}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={o}
                  style={[S.selectItem, { flexDirection: 'row', alignItems: 'center', gap: 8 }, on && { backgroundColor: '#EAF5F0' }]}>
                  <View style={{
                    width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
                    borderColor: on ? '#0F6B46' : '#9AA8AF', backgroundColor: on ? '#0F6B46' : '#fff',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on ? <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', lineHeight: 12 }}>✓</Text> : null}
                  </View>
                  <Text style={{ fontSize: 13, color: '#12202A', fontWeight: on ? '700' : '400' }}>{o}</Text>
                </TouchableOpacity>
              );
            })}
            {shown.length === 0 && (
              <Text style={{ padding: 12, fontSize: 12.5, color: '#8B99A3' }}>No matches</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function UsersListScreen({ onOpenUser, onRegister }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [roleSel, setRoleSel] = useState([]);        // [] = all roles
  const [warehouseSel, setWarehouseSel] = useState([]); // [] = all warehouses
  const [status, setStatus] = useState('Active');
  const [activity, setActivity] = useState('any');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      setUsers((await adminAPI.getUsersOverview()) || []);
    } catch (e) {
      setError(handleAPIError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const warehouses = useMemo(() => {
    const set = new Set(users.map((u) => u.warehouse_code).filter(Boolean));
    return Array.from(set).sort();
  }, [users]);

  const counts = useMemo(() => {
    const active = users.filter((u) => u.is_active !== false);
    return {
      total: users.length,
      active: active.length,
      never: active.filter((u) => !u.last_login).length,
      stale90: active.filter((u) => { const d = daysSinceLogin(u.last_login); return d !== null && d >= 90; }).length,
    };
  }, [users]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users.filter((u) => {
      if (term) {
        const hay = `${u.first_name || ''} ${u.last_name || ''} ${u.username} ${u.email || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      const rl = roleList(u);
      // Role: match ANY of the ticked roles ('No role' = users without a role)
      if (roleSel.length && !roleSel.some((r) => (r === 'No role' ? rl.length === 0 : rl.includes(r)))) return false;
      if (warehouseSel.length && !warehouseSel.includes(u.warehouse_code)) return false;
      const isActive = u.is_active !== false;
      if (status === 'Active' && !isActive) return false;
      if (status === 'Deactivated' && isActive) return false;
      const d = daysSinceLogin(u.last_login);
      if (activity === '30' && !(d !== null && d <= 30)) return false;
      if (activity === '60+' && !(d === null || d >= 60)) return false;
      if (activity === '90+' && !(d === null || d >= 90)) return false;
      if (activity === 'never' && u.last_login) return false;
      return true;
    });
  }, [users, q, roleSel, warehouseSel, status, activity]);

  const kpi = (label, value, onPress, hint) => (
    <TouchableOpacity style={S.kpi} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      <Text style={S.kpiLabel}>{label}</Text>
      <Text style={S.kpiValue}>{value}</Text>
      {hint ? <Text style={S.kpiHint}>{hint}</Text> : null}
    </TouchableOpacity>
  );

  return (
    <View style={S.page}>
      {/* Filters */}
      <View style={[S.toolbar, { zIndex: 20 }]}>
        <TextInput
          style={S.search}
          placeholder="🔍  Search name, username or email…"
          placeholderTextColor="#8B99A3"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
        />
        <MultiFilter label="Role" allLabel="All roles" selected={roleSel}
          options={ROLE_FILTERS.filter((r) => r !== 'All roles')} onChange={setRoleSel} width={185} />
        <MultiFilter label="Warehouse" allLabel="All warehouses" selected={warehouseSel}
          options={warehouses} onChange={setWarehouseSel} width={185} />
        <FilterSelect label="Status" value={status} options={STATUS_FILTERS.map((s) => [s, s])} onChange={setStatus} width={150} />
        <FilterSelect label="Login" value={activity} options={ACTIVITY_FILTERS} onChange={setActivity} width={210} />
        <TouchableOpacity style={S.primaryBtn} onPress={onRegister} accessibilityRole="button">
          <Text style={S.primaryBtnTxt}>＋ Register User</Text>
        </TouchableOpacity>
      </View>

      {/* Counts — tap to filter */}
      <View style={S.kpiRow}>
        {kpi('Total users', counts.total, () => { setStatus('All'); setActivity('any'); setRoleSel([]); setWarehouseSel([]); })}
        {kpi('Active', counts.active, () => { setStatus('Active'); setActivity('any'); })}
        {kpi('Never logged in', counts.never, () => { setStatus('Active'); setActivity('never'); }, 'active accounts')}
        {kpi('No login 90+ days', counts.stale90, () => { setStatus('Active'); setActivity('90+'); }, 'active accounts')}
      </View>

      {/* Table */}
      <View style={S.tableCard}>
        <View style={[S.tr, S.th]}>
          <Text style={[S.thTxt, { flex: 2.2 }]}>USER</Text>
          <Text style={[S.thTxt, { flex: 2 }]}>ROLES</Text>
          <Text style={[S.thTxt, { flex: 1.4 }]}>WAREHOUSE / SCOPE</Text>
          <Text style={[S.thTxt, { flex: 1.2 }]}>LAST LOGIN</Text>
          <Text style={[S.thTxt, { flex: 1 }]}>STATUS</Text>
          <Text style={[S.thTxt, { width: 60 }]} />
        </View>
        {loading ? (
          <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color="#0F6B46" /></View>
        ) : error ? (
          <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
            <Text style={{ color: '#C62828' }}>{error}</Text>
            <TouchableOpacity style={S.outlineBtn} onPress={load}><Text style={S.outlineBtnTxt}>Retry</Text></TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }}>
            {rows.map((u) => {
              const rl = roleList(u);
              const active = u.is_active !== false;
              const d = daysSinceLogin(u.last_login);
              const stale = active && (d === null || d >= 90);
              const scope = u.warehouse_code || u.copacker_location ||
                (u.department ? `${u.gate_pass_location || ''}${u.gate_pass_location ? ' · ' : ''}${u.department}` : '') || '—';
              return (
                <TouchableOpacity key={u.username} style={S.tr} onPress={() => onOpenUser(u)}
                  accessibilityRole="button" accessibilityLabel={`Edit ${u.username}`}>
                  <View style={{ flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <View style={S.avatar}><Text style={S.avatarTxt}>{initialsOf(u)}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={S.name} numberOfLines={1}>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username}</Text>
                      <Text style={S.sub} numberOfLines={1}>{u.username}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    {rl.length === 0 ? (
                      <View style={[S.chip, { backgroundColor: '#FFF3CD' }]}><Text style={[S.chipTxt, { color: '#856404' }]}>No role</Text></View>
                    ) : (
                      <>
                        <View style={S.chip}><Text style={S.chipTxt} numberOfLines={1}>{rl[0]}</Text></View>
                        {rl.length > 1 && (
                          <View style={[S.chip, { backgroundColor: '#F1EFE8' }]} accessibilityLabel={rl.slice(1).join(', ')}>
                            <Text style={[S.chipTxt, { color: '#5F5E5A' }]}>+{rl.length - 1}</Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                  <Text style={[S.cell, { flex: 1.4 }]} numberOfLines={1}>{scope}</Text>
                  <Text style={[S.cell, { flex: 1.2, color: stale ? '#A35F00' : '#5B6B75' }]} numberOfLines={1}>
                    {shortLastLogin(u.last_login)}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <View style={[S.chip, !active && { backgroundColor: '#FCEBEB' }]}>
                      <Text style={[S.chipTxt, !active && { color: '#A32D2D' }]}>{active ? '● Active' : '○ Deactivated'}</Text>
                    </View>
                  </View>
                  <Text style={{ width: 60, color: '#0F6B46', fontWeight: '700', fontSize: 13 }}>Edit ›</Text>
                </TouchableOpacity>
              );
            })}
            {rows.length === 0 && (
              <Text style={{ padding: 24, textAlign: 'center', color: '#8B99A3' }}>No users match these filters</Text>
            )}
          </ScrollView>
        )}
        {!loading && !error && (
          <Text style={S.footer}>Showing {rows.length} of {users.length} users</Text>
        )}
      </View>
    </View>
  );
}

const S = {
  page:       { flex: 1, padding: 16, backgroundColor: '#EEF5F2' },
  toolbar:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  search:     { flex: 1, minWidth: 200, borderWidth: 1.5, borderColor: '#CFDDD7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff', color: '#12202A' },
  select:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#CFDDD7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}) },
  selectTxt:  { fontSize: 13.5, color: '#12202A', flex: 1 },
  selectMenu: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E9E5', borderRadius: 10, paddingVertical: 4, zIndex: 100, elevation: 8, ...(Platform.OS === 'web' ? { boxShadow: '0px 6px 18px rgba(0,0,0,0.12)' } : {}) },
  selectItem: { paddingHorizontal: 12, paddingVertical: 9 },
  primaryBtn: { backgroundColor: '#0F6B46', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18 },
  primaryBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  outlineBtn: { borderWidth: 1.5, borderColor: '#0F6B46', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  outlineBtnTxt: { color: '#0F6B46', fontWeight: '700' },
  kpiRow:     { flexDirection: 'row', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  kpi:        { flex: 1, minWidth: 160, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E0E9E5', paddingVertical: 12, paddingHorizontal: 16, ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}) },
  kpiLabel:   { fontSize: 12.5, color: '#5B6B75' },
  kpiValue:   { fontSize: 24, fontWeight: '700', color: '#00604F', marginTop: 2 },
  kpiHint:    { fontSize: 11, color: '#8B99A3' },
  tableCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E0E9E5', overflow: 'hidden' },
  tr:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EEF3F1', ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}) },
  th:         { backgroundColor: '#F4FAF7', borderTopWidth: 0, paddingVertical: 10 },
  thTxt:      { fontSize: 11.5, fontWeight: '700', color: '#5B6B75', letterSpacing: 0.6 },
  avatar:     { width: 34, height: 34, borderRadius: 17, backgroundColor: '#00836F', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:  { color: '#fff', fontWeight: '700', fontSize: 12 },
  name:       { fontSize: 14, fontWeight: '700', color: '#12202A' },
  sub:        { fontSize: 12, color: '#5B6B75' },
  cell:       { fontSize: 13.5, color: '#2B3A42' },
  chip:       { backgroundColor: '#E6F1EC', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start', flexShrink: 1 },
  chipTxt:    { fontSize: 11.5, fontWeight: '600', color: '#00604F' },
  footer:     { fontSize: 12, color: '#8B99A3', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#EEF3F1' },
};
