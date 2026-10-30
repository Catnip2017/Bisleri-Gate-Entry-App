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
import AccountDetailsPopover from './AccountDetailsPopover';
import { useTheme } from '../../contexts/ThemeContext';

const AppShell = ({ children, title, backLabel, onBack }) => {
  const router = useRouter();

  // Default back handler: router.back() silently does nothing when this
  // screen was reached with no navigation history behind it (a direct URL,
  // a refresh on web, or a deep link) — that's the "back button does
  // nothing" bug. Fall back to the hub, a safe landing page for any
  // screen that lives behind AppShell, when there's nowhere to pop back to.
  const defaultOnBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin-hub');
    }
  };
  const [sidebarVisible, setSidebarVisible] = useState(false);
  // Avatar chip opens this small popup instead of the full hamburger menu
  // (30 Oct 2026) — the hamburger menu's "Account Details" row opens the
  // same popup too, so the two stay a single component, never two copies.
  const [accountPopoverVisible, setAccountPopoverVisible] = useState(false);
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

  // Avatar chip on the right — tapping it opens the small Account Details
  // popup (30 Oct 2026; was the full hamburger menu before). ☰ opens the
  // hamburger menu.
  const avatarChip = (
    <TouchableOpacity
      onPress={() => setAccountPopoverVisible(true)}
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
        onBack={onBack || defaultOnBack}
        onMenuPress={() => setSidebarVisible(true)}
      />

      {/* Screen content */}
      <View style={{ flex: 1 }}>{children}</View>

      {/* The one sidebar */}
      <NavSidebar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        onOpenAccountDetails={() => setAccountPopoverVisible(true)}
        userData={userData}
      />

      {/* Account Details — opened by the avatar chip or the hamburger
          menu's "Account Details" row (30 Oct 2026) */}
      <AccountDetailsPopover
        isVisible={accountPopoverVisible}
        onClose={() => setAccountPopoverVisible(false)}
        userData={userData}
      />
    </SafeAreaView>
  );
};

export default AppShell;
