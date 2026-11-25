// app/admin/utils/userUi.js - Shared pieces for the User Management screens
// (25 Nov 2026 redesign): role descriptions + combo rules, the "what this
// user will see" preview, password helpers, last-login formatting and the
// one search-result row used by Assign Access and Reset Password.
//
// The combo rules here only drive the UI (greying cards with a reason).
// The real enforcement is unchanged: toggleRole() in each screen and
// validate_role_combo() on the server.
import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';

export const ROLE_INFO = {
  'Security Guard':       'Creates gate entries for their warehouse',
  'Gate Pass Dispatcher': 'Dispatches / receives gate passes at the gate',
  'IT Admin':             'All applications + User Management',
  'Gate Pass Creator':    'Raises gate passes for their department',
  'Security Admin':       'View-only Gate Entry, Insights (with report download) and Gate Pass list',
  'Co Packer':            'Production line capture (exclusive role)',
};

// Why a role can't be added to the current selection, or null if it can.
export function roleBlockReason(role, roles) {
  if (roles.includes(role)) return null;
  const has = (r) => roles.includes(r);
  const others = roles.filter((r) => r !== 'Co Packer');
  if (role === 'Co Packer') return others.length ? "Can't be combined with other roles" : null;
  if (has('Co Packer')) return 'Untick Co Packer first';
  if (role === 'Security Admin') return others.length ? 'Standalone role — untick the others first' : null;
  if (has('Security Admin')) return "Can't be combined with Security Admin";
  if (role === 'Gate Pass Dispatcher' && !has('Security Guard')) return 'Needs Security Guard ticked first';
  if (role === 'Gate Pass Creator' && (has('Security Guard') || has('Gate Pass Dispatcher')))
    return "Can't be combined with Security Guard / Dispatcher";
  if (role === 'IT Admin' && (has('Security Guard') || has('Gate Pass Dispatcher')))
    return "Can't be combined with Security Guard";
  if (role === 'Security Guard' && has('Gate Pass Creator')) return "Can't be combined with Gate Pass Creator";
  if (role === 'Security Guard' && has('IT Admin')) return "Can't be combined with IT Admin";
  return null;
}

// Plain-language list of what the chosen roles + scope give access to.
export function accessPreview(roles, { warehouse, locations = [], department, copacker } = {}) {
  const wh = warehouse || 'their warehouse';
  const locs = locations.length ? locations.join(', ') : 'selected locations';
  const yes = [];
  const has = (r) => roles.includes(r);
  if (has('IT Admin')) yes.push('All applications and User Management');
  if (has('Security Guard')) {
    yes.push(`Gate Entry (create entries) — ${wh}`);
    yes.push(`Insights — ${wh}`);
    yes.push(has('Gate Pass Dispatcher')
      ? `Gate Pass: dispatch / inward — ${locs}`
      : 'Gate Pass tab (no actions without Dispatcher role)');
  }
  if (has('Security Admin')) {
    yes.push(`Gate Entry (view only) — ${wh}`);
    yes.push(`Insights + Download Report — ${wh}`);
    yes.push(`Gate Pass list (view only) — ${locs}`);
  }
  if (has('Gate Pass Creator')) yes.push(`Gate Pass: create passes — ${department || 'department'}, ${locs}`);
  if (has('Co Packer')) yes.push(`Co Packer sessions — ${copacker || 'their location'}`);
  const no = has('IT Admin') ? [] : ['Admin Hub, User Management'];
  return { yes, no };
}

// 12-character password: letters + digits + one symbol (meets the current
// 6-character minimum with room to spare). Uses crypto when available.
export function generatePassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%*'];
  const all = sets.join('');
  const rnd = (n) => {
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n;
      }
    } catch (e) { /* fall through */ }
    return Math.floor(Math.random() * n);
  };
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < 12) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

// The four policy rules, each with pass/fail — shown as a live checklist
// under password boxes (min 6, upper-case, number, special character).
export function passwordChecks(pw) {
  const p = pw || '';
  return [
    ['6+ characters', p.length >= 6],
    ['1 upper-case letter', /[A-Z]/.test(p)],
    ['1 number', /\d/.test(p)],
    ['1 special character', /[^A-Za-z0-9]/.test(p)],
  ];
}

export function PasswordChecklist({ password }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4, marginBottom: 10 }}>
      {passwordChecks(password).map(([label, ok]) => (
        <View key={label} style={{
          flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10,
          paddingHorizontal: 8, paddingVertical: 3,
          backgroundColor: ok ? '#E6F4EC' : '#F4F5F5',
        }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: ok ? '#1E8A4C' : '#8B99A3' }}>
            {ok ? '✓' : '○'} {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function passwordStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < 6) return { label: 'Too short', pct: 15, color: '#C62828' };
  if (passwordChecks(pw).some(([, ok]) => !ok)) return { label: 'Does not meet the rules yet', pct: 35, color: '#E07B00' };
  if (score <= 2) return { label: 'Weak', pct: 35, color: '#E07B00' };
  if (score <= 3) return { label: 'Medium', pct: 65, color: '#C9A100' };
  return { label: 'Strong', pct: 100, color: '#2FB164' };
}

// users_master.last_login is naive UTC. Returns days since login (or null).
export function daysSinceLogin(raw) {
  if (!raw) return null;
  const iso = /(Z|[+-]\d\d:?\d\d)$/.test(raw) ? raw : `${raw}Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function shortLastLogin(raw) {
  if (!raw) return 'Never';
  const iso = /(Z|[+-]\d\d:?\d\d)$/.test(raw) ? raw : `${raw}Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const days = daysSinceLogin(raw);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const initialsOf = (u) =>
  (((u?.first_name || '')[0] || '') + ((u?.last_name || '')[0] || '')).toUpperCase()
  || (u?.username || '?')[0].toUpperCase();

// The ONE search-result row: name, then "username · warehouse", and a
// green/grey active dot. Roles are deliberately NOT shown here — long role
// strings used to wrap one letter per line in the narrow column.
export function UserResultRow({ user, selected, onPress }) {
  const active = user.is_active !== false;
  const scope = user.warehouse_code || user.copacker_location || user.department || '';
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${user.first_name || ''} ${user.last_name || ''} ${user.username}`}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4,
        backgroundColor: selected ? '#E6F1EC' : 'transparent',
        borderWidth: 1, borderColor: selected ? '#9CCBB8' : 'transparent',
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
      }}
    >
      <View style={{
        width: 34, height: 34, borderRadius: 17, backgroundColor: '#00836F',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{initialsOf(user)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#12202A' }} numberOfLines={1}>
          {`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}
        </Text>
        <Text style={{ fontSize: 11.5, color: '#5B6B75' }} numberOfLines={1}>
          {user.username}{scope ? ` · ${scope}` : ''}
        </Text>
      </View>
      {!user.role || !user.role.trim() ? (
        <View style={{ backgroundColor: '#FFF3CD', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#856404' }}>No role</Text>
        </View>
      ) : null}
      <View
        accessibilityLabel={active ? 'Active' : 'Deactivated'}
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? '#2FB164' : '#C9CFD3' }}
      />
    </TouchableOpacity>
  );
}
