// components/ui/SessionLayer.js - App-wide session helpers (27 Nov 2026),
// mounted once in app/_layout.tsx:
//
//   NavRecorder      remembers the pages visited in this session, for the
//                    hybrid "← Back" button (utils/navHistory.js)
//   TabSessionWatch  the browser keeps ONE login for all tabs. When another
//                    tab signs in as someone else (or signs out), this tab
//                    says so and moves to that user's own start page instead
//                    of showing a page that belonged to the previous user.
//   ViewAsBanner     while an IT Admin is in "View as user", a bar on top of
//                    every page: "Viewing as … — read only" + Exit preview.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { recordPath, clearHistory } from '../../utils/navHistory';
import { decodeJWT, getCurrentUser, goToMyHome } from '../../utils/jwtUtils';
import { storage } from '../../utils/storage';
import { showAlert } from '../../utils/customModal';
import { securityAPI, VIEW_AS_ADMIN_TOKEN, VIEW_AS_INFO } from '../../services/api';

const SIGNED_OUT_ROUTES = ['/', '/index', '/LoginScreen'];

export function NavRecorder() {
  const pathname = usePathname();
  useEffect(() => { recordPath(pathname); }, [pathname]);
  return null;
}

export function TabSessionWatch() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onStorage = (e) => {
      if (e.key !== 'access_token' || e.oldValue === e.newValue) return;
      if (SIGNED_OUT_ROUTES.includes(window.location.pathname)) return;   // this tab is on the login page
      const before = e.oldValue ? decodeJWT(e.oldValue) : null;
      const after = e.newValue ? decodeJWT(e.newValue) : null;
      if (!after) {
        clearHistory();
        showAlert('Signed out', 'You signed out in another tab.');
        router.replace('/LoginScreen');
        return;
      }
      if (before && before.sub === after.sub && !!before.va === !!after.va) return;   // same person, e.g. new password
      const name = `${after.first_name || ''} ${after.last_name || ''}`.trim() || after.sub;
      clearHistory();
      // Move first, then tell the user (pages of the old account may still
      // show their own messages while unmounting — this one comes last).
      goToMyHome(router);
      setTimeout(() => showAlert(
        'Signed in elsewhere',
        after.va
          ? `A "View as user" preview of ${name} was started in another tab. This tab now shows that preview.`
          : `You signed in as ${name} in another tab. This tab now shows that account's start page.`,
      ), 800);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [router, pathname]);
  return null;
}

export function ViewAsBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState(null);   // { name, username, exp }
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await getCurrentUser();
      if (cancelled) return;
      setView(u?.viewAsBy ? { name: u.fullName || u.username, username: u.username, exp: u.exp, by: u.viewAsBy } : null);
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => {
    if (!view) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [view]);

  if (!view) return null;
  const minsLeft = view.exp ? Math.min(30, Math.max(0, Math.ceil((view.exp * 1000 - now) / 60000))) : null;

  const exit = async () => {
    setEnding(true);
    try { await securityAPI.endViewAs(); } catch (e) { /* the preview may already have expired */ }
    try {
      const adminToken = await storage.getItem(VIEW_AS_ADMIN_TOKEN);
      if (adminToken) await storage.setItem('access_token', adminToken);
      else await storage.removeItem('access_token');
      await storage.removeItem(VIEW_AS_ADMIN_TOKEN);
      await storage.removeItem(VIEW_AS_INFO);
    } finally {
      clearHistory();
      setView(null);
      setEnding(false);
      router.replace('/admin-hub/user-management');
    }
  };

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#7A4B00',
    }} accessibilityRole="alert">
      <MaterialIcons name="visibility" size={18} color="#FFE7B3" />
      <Text style={{ color: '#FFF4DD', fontSize: 13.5, flex: 1, minWidth: 220 }}>
        <Text style={{ fontWeight: '800' }}>Viewing as {view.name} ({view.username})</Text>
        {' '}— read only. Nothing can be saved or changed.
        {minsLeft !== null ? ` Ends in ${minsLeft} min.` : ''}
      </Text>
      <TouchableOpacity onPress={exit} disabled={ending} accessibilityRole="button" accessibilityLabel="Exit preview"
        style={{ backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
          ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}) }}>
        <Text style={{ color: '#7A4B00', fontWeight: '800', fontSize: 13 }}>{ending ? 'Exiting…' : 'Exit preview'}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Start a preview (Assign Access → "View as"). Keeps the IT Admin's own token aside. */
export async function startViewAs(router, username) {
  const res = await securityAPI.startViewAs(username);
  const adminToken = await storage.getItem('access_token');
  await storage.setItem(VIEW_AS_ADMIN_TOKEN, adminToken);
  await storage.setItem(VIEW_AS_INFO, JSON.stringify({ username: res.username, name: res.name, started: Date.now() }));
  await storage.setItem('access_token', res.access_token);
  clearHistory();
  await goToMyHome(router);
}
