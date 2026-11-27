// components/ui/MobileGate.js - Compulsory mobile number (25 Nov 2026).
//
// Wraps the whole app (app/_layout.tsx). After login, every user — whatever
// their role or pages — is checked once per session: if their account has no
// valid mobile number, this one page is shown instead of their app until they
// save one. Login screen and signed-out visits are never blocked.
//
// If the status check itself fails (server unreachable), the gate lets the
// user through rather than locking everyone out; the server still refuses
// saving an invalid number.
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Platform,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getCurrentUser } from '../../utils/jwtUtils';
import { authAPI, handleAPIError } from '../../services/api';
import { storage } from '../../utils/storage';
import { brand } from '../../contexts/ThemeContext';

const OPEN_ROUTES = ['/', '/LoginScreen', '/index', '/change-password'];
const confirmed = new Set();   // usernames already known to have a mobile (this session)

export default function MobileGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState('ok');   // 'ok' | 'checking' | 'needed'
  const [user, setUser] = useState(null);
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (OPEN_ROUTES.includes(pathname)) { setState('ok'); return; }
      const u = await getCurrentUser();
      if (!u) { setState('ok'); return; }           // AppShell handles signed-out
      // Must set a new password first (27 Nov 2026) — that page comes before this one
      if (u.passwordChange) { router.replace('/change-password'); return; }
      // An IT Admin's read-only "View as user" preview never asks for the number
      if (u.viewAsBy) { setState('ok'); return; }
      if (confirmed.has(u.username)) { setState('ok'); return; }
      setUser(u);
      setState((s) => (s === 'needed' ? s : 'checking'));
      try {
        const res = await authAPI.getMobileStatus();
        if (cancelled) return;
        if (res?.has_mobile) {
          confirmed.add(u.username);
          setState('ok');
        } else {
          setState('needed');
        }
      } catch (e) {
        if (!cancelled) setState('ok');             // fail open — see header note
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  const save = async () => {
    const digits = mobile.replace(/\D/g, '');
    if (!/^\d{10}$/.test(digits)) { setError('Enter a valid 10-digit mobile number.'); return; }
    setSaving(true); setError('');
    try {
      await authAPI.setMyMobile(digits);
      if (user) confirmed.add(user.username);
      setState('ok');
    } catch (e) {
      setError(handleAPIError(e));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch (e) { /* ignore */ }
    await storage.removeItem('access_token');
    setState('ok');
    router.replace('/LoginScreen');
  };

  // The app (navigator) always stays mounted underneath; the gate is a
  // full-screen layer on top, so nothing behind it can be clicked.
  const OVERLAY = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, elevation: 50 };

  if (state === 'ok') return children;

  if (state === 'checking') {
    return (
      <View style={{ flex: 1 }}>
        {children}
        <View style={[OVERLAY, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF5F2' }]}>
          <ActivityIndicator size="large" color="#0F6B46" />
        </View>
      </View>
    );
  }

  const name = user?.firstName || user?.fullName || user?.username || '';
  return (
    <View style={{ flex: 1 }}>
    {children}
    <View style={[OVERLAY, { backgroundColor: '#EEF5F2' }]}>
      <View style={[{
        height: 76, backgroundColor: brand.teal, justifyContent: 'center', paddingHorizontal: 24,
      }, Platform.OS === 'web' ? { backgroundImage: brand.headerGradient } : null]}>
        <Image source={require('../../assets/images/bisleri-logo-white.png')}
          style={{ width: 130, height: 44 }} resizeMode="contain" accessibilityLabel="Bisleri" />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <View style={{
          width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 18, padding: 28,
          borderWidth: 1, borderColor: '#E0E9E5',
          ...(Platform.OS === 'web' ? { boxShadow: '0px 12px 32px rgba(0,96,79,0.12)' } : { elevation: 6 }),
        }}>
          <View style={{
            width: 52, height: 52, borderRadius: 14, backgroundColor: '#E6F1EC',
            alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <MaterialIcons name="smartphone" size={28} color="#0F6B46" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#00604F' }}>
            Add your mobile number
          </Text>
          <Text style={{ fontSize: 14.5, color: '#5B6B75', marginTop: 6, lineHeight: 21 }}>
            {name ? `Hi ${name}, ` : ''}a mobile number is now required for every Ops Hub account.
            Please enter yours to continue.
          </Text>

          <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#12202A', marginTop: 20, marginBottom: 6 }}>
            Mobile number *
          </Text>
          <TextInput
            value={mobile}
            onChangeText={(v) => { setMobile(v.replace(/[^0-9]/g, '')); setError(''); }}
            placeholder="10-digit mobile number"
            placeholderTextColor="#8B99A3"
            keyboardType="number-pad"
            maxLength={10}
            autoFocus
            onSubmitEditing={save}
            returnKeyType="done"
            style={{
              borderWidth: 1.5, borderColor: error ? '#C62828' : '#CFDDD7', borderRadius: 10,
              paddingVertical: 13, paddingHorizontal: 14, fontSize: 17, letterSpacing: 1,
              color: '#12202A', backgroundColor: '#fff',
            }}
          />
          {error ? <Text style={{ color: '#C62828', fontSize: 12.5, marginTop: 6 }}>{error}</Text> : null}

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            accessibilityRole="button"
            style={{
              marginTop: 20, backgroundColor: saving ? '#9CB5AA' : '#0F6B46', borderRadius: 10,
              minHeight: 48, alignItems: 'center', justifyContent: 'center',
            }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Save and continue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={logout} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 14, padding: 6 }}>
            <Text style={{ color: '#5B6B75', fontSize: 13, textDecorationLine: 'underline' }}>Not you? Log out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
    </View>
  );
}
