// components/ui/AppShell.js - The ONE page chrome, for all pages and roles.
//
// Renders: standard header (menu + centered logo + avatar chip) → optional
// back-chip row with page title → the screen's content → the shared
// NavSidebar overlay. Screens declare only { title, backLabel, onBack } and
// their content — they build NO chrome of their own, so drift is impossible.
//
// Usage:
//   <AppShell title="User Management" backLabel="Admin Hub">
//     ...screen content...
//   </AppShell>
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../../utils/jwtUtils';
import { storage } from '../../utils/storage';
import AppHeader from './AppHeader';
import NavSidebar from './NavSidebar';
import { useTheme } from '../../contexts/ThemeContext';

const AppShell = ({ children, title, backLabel, onBack }) => {
  const router = useRouter();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userData, setUserData] = useState(null);
  const { colors } = useTheme();

  useEffect(() => {
    // ── AUTH GUARD ──────────────────────────────────────────────────────────
    // Every screen wraps itself in AppShell, so this one check covers every
    // direct URL. getCurrentUser() returns null when there is no token OR the
    // token is expired (it also clears the expired token) — in either case
    // bounce to the login screen instead of rendering a ghost "?" session.
    // (Previously only API 401s redirected; pages that make no API calls
    // rendered with a null user.)
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          try {
            await storage.setItem('session_expired', 'true');
          } catch (se) {
            // best-effort flag — never block the redirect on it
          }
          router.replace('/');
          return;
        }
        setUserData(user);
      } catch (e) {
        console.log('AppShell: error loading user', e);
        router.replace('/');
      }
    })();
  }, []);

  const firstName = userData?.firstName || userData?.fullName?.split(' ')[0];
  const initials = (userData?.fullName || userData?.username || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Avatar chip on the right — tapping it opens the same sidebar as ☰
  const avatarChip = (
    <TouchableOpacity
      onPress={() => setSidebarVisible(true)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        minHeight: 48, paddingHorizontal: 4, justifyContent: 'flex-end',
      }}
      accessibilityRole="button"
      accessibilityLabel="Open user menu"
    >
      {firstName ? (
        <Text style={{ fontSize: 13, color: '#FFFFFF', maxWidth: 90 }} numberOfLines={1}>
          {firstName}
        </Text>
      ) : null}
      <View style={{
        width: 32, height: 32, borderRadius: 16, backgroundColor: '#D5EEDF',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#064D28' }}>
          {initials}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* One merged header — navy band with logo, back-chip/title and avatar */}
      <AppHeader
        rightSlot={avatarChip}
        backLabel={backLabel}
        title={title}
        onBack={onBack || (() => router.back())}
      />

      {/* Screen content */}
      <View style={{ flex: 1 }}>{children}</View>

      {/* The one sidebar */}
      <NavSidebar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        userData={userData}
      />
    </SafeAreaView>
  );
};

export default AppShell;
