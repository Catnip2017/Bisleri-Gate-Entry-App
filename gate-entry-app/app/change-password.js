// app/change-password.js - "Set a new password" (27 Nov 2026).
//
// Shown right after login when:
//   * the account still has an old-format password (from the first app), or
//   * ENFORCE_PASSWORD_POLICY is on and the password breaks the rule.
// The login token at this point can ONLY change the password (server-side),
// so this page talks to nothing else. On success the server returns a normal
// token and the user goes to their usual start page (then the mobile-number
// check, if needed).
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { authAPI, handleAPIError } from '../services/api';
import { getCurrentUser, getRoleBasedRoute } from '../utils/jwtUtils';
import { storage } from '../utils/storage';
import { brand } from '../contexts/ThemeContext';

const RULES = [
  ['At least 6 characters', (p) => p.length >= 6],
  ['1 capital letter', (p) => /[A-Z]/.test(p)],
  ['1 number', (p) => /\d/.test(p)],
  ['1 special character (e.g. @ # $ !)', (p) => /[^A-Za-z0-9]/.test(p)],
];

function PwField({ label, value, onChange, show, onToggle, autoFocus, onSubmit }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#12202A', marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#CFDDD7', borderRadius: 10, backgroundColor: '#fff' }}>
        <TextInput value={value} onChangeText={onChange} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false}
          autoFocus={autoFocus} onSubmitEditing={onSubmit} accessibilityLabel={label}
          style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: '#12202A' }} />
        <TouchableOpacity onPress={onToggle} accessibilityLabel={show ? 'Hide password' : 'Show password'} style={{ padding: 10 }}>
          <MaterialIcons name={show ? 'visibility-off' : 'visibility'} size={20} color="#5B6B75" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) { router.replace('/LoginScreen'); return; }
      if (!u.passwordChange) { router.replace(getRoleBasedRoute(u.roles || [])); return; }
      setUser(u);
    })();
  }, []);

  const ruleOk = RULES.map(([, f]) => f(next));
  const allOk = ruleOk.every(Boolean);

  const save = async () => {
    setError('');
    if (!current) { setError('Enter your current password.'); return; }
    if (!allOk) { setError('The new password does not meet all the rules below.'); return; }
    if (next !== repeat) { setError('The two new passwords are not the same.'); return; }
    if (next === current) { setError('The new password must be different from the current one.'); return; }
    setSaving(true);
    try {
      const res = await authAPI.changePassword(current, next);
      await storage.setItem('access_token', res.access_token);
      const u = await getCurrentUser();
      router.replace(getRoleBasedRoute(u?.roles || []));
    } catch (e) {
      setError(handleAPIError(e));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch (e) { /* ignore */ }
    await storage.removeItem('access_token');
    router.replace('/LoginScreen');
  };

  const legacy = user?.passwordChange === 'legacy';
  return (
    <View style={{ flex: 1, backgroundColor: '#EEF5F2' }}>
      <View style={[{ height: 76, backgroundColor: brand.teal, justifyContent: 'center', paddingHorizontal: 24 },
        Platform.OS === 'web' ? { backgroundImage: brand.headerGradient } : null]}>
        <Image source={require('../assets/images/bisleri-logo-white.png')} style={{ width: 130, height: 44 }}
          resizeMode="contain" accessibilityLabel="Bisleri" />
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <View style={{
          width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 18, padding: 28,
          borderWidth: 1, borderColor: '#E0E9E5',
          ...(Platform.OS === 'web' ? { boxShadow: '0px 12px 32px rgba(0,96,79,0.12)' } : { elevation: 6 }),
        }}>
          <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#E6F1EC', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <MaterialIcons name="lock-reset" size={28} color="#0F6B46" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#00604F' }}>Set a new password</Text>
          <Text style={{ fontSize: 14.5, color: '#5B6B75', marginTop: 6, lineHeight: 21 }}>
            {user?.firstName ? `Hi ${user.firstName}, ` : ''}
            {legacy
              ? 'your password was created in the old app and has to be renewed before you can continue.'
              : 'your password does not meet the current password rules. Please set a new one to continue.'}
          </Text>

          <PwField label="Current password *" value={current} onChange={(v) => { setCurrent(v); setError(''); }}
            show={show} onToggle={() => setShow((s) => !s)} autoFocus />
          <PwField label="New password *" value={next} onChange={(v) => { setNext(v); setError(''); }}
            show={show} onToggle={() => setShow((s) => !s)} />
          <View style={{ marginTop: 8, gap: 3 }}>
            {RULES.map(([label], i) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name={ruleOk[i] ? 'check-circle' : 'radio-button-unchecked'} size={15} color={ruleOk[i] ? '#0F6B46' : '#9AA8AF'} />
                <Text style={{ fontSize: 12.5, color: ruleOk[i] ? '#0F6B46' : '#5B6B75' }}>{label}</Text>
              </View>
            ))}
          </View>
          <PwField label="Repeat new password *" value={repeat} onChange={(v) => { setRepeat(v); setError(''); }}
            show={show} onToggle={() => setShow((s) => !s)} onSubmit={save} />
          {error ? <Text style={{ color: '#C62828', fontSize: 12.5, marginTop: 8 }}>{error}</Text> : null}

          <TouchableOpacity onPress={save} disabled={saving} accessibilityRole="button"
            style={{ marginTop: 20, backgroundColor: saving ? '#9CB5AA' : '#0F6B46', borderRadius: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Save and continue</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 14, padding: 6 }}>
            <Text style={{ color: '#5B6B75', fontSize: 13, textDecorationLine: 'underline' }}>Not you? Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
