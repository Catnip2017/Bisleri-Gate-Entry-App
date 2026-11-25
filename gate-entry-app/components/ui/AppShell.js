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
import { View, Text, TouchableOpacity, SafeAreaView, Platform, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../../utils/jwtUtils';
import { storage } from '../../utils/storage';
import AppHeader, { WIDE_BREAKPOINT } from './AppHeader';
import NavSidebar from './NavSidebar';
import FixedSidebar from './FixedSidebar';
import AccountDetailsPopover from './AccountDetailsPopover';
import { useTheme, brand } from '../../contexts/ThemeContext';

const AppShell = ({ children, title, backLabel, onBack, appNav }) => {
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
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  // Always-open sidebar on desktop web (25 Nov 2026); phones/native keep ☰.
  const fixedNav = wide && Platform.OS === 'web';

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
  // 25 Nov 2026 UI overhaul: wide screens get a white "account pill"
  // (avatar + first name + chevron) like the wireframe; phones keep a
  // compact avatar circle. Same tap target and behaviour as before.
  const avatarChip = wide ? (
    <TouchableOpacity
      onPress={() => setAccountPopoverVisible(true)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        minHeight: 46, paddingLeft: 6, paddingRight: 14, borderRadius: 23,
        backgroundColor: '#FFFFFF',
        ...(Platform.OS === 'web' ? { boxShadow: '0px 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer' } : {}),
      }}
      accessibilityRole="button"
      accessibilityLabel="Open user menu"
    >
      <View style={{
        width: 34, height: 34, borderRadius: 17, backgroundColor: brand.navy,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' }}>{initials}</Text>
      </View>
      {firstName ? (
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#12202A', maxWidth: 140 }} numberOfLines={1}>
          {firstName}
        </Text>
      ) : null}
      <MaterialIcons name="expand-more" size={20} color="#5B6B75" />
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      onPress={() => setAccountPopoverVisible(true)}
      style={{ minHeight: 48, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel="Open user menu"
    >
      <View style={{
        width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 13, fontWeight: 'bold', color: brand.navy }}>{initials}</Text>
      </View>
    </TouchableOpacity>
  );

  const header = (
    <AppHeader
      rightSlot={avatarChip}
      backLabel={backLabel}
      title={title}
      onBack={onBack || defaultOnBack}
      onMenuPress={fixedNav ? undefined : () => setSidebarVisible(true)}
      hideBrand={fixedNav}
    />
  );

  const accountPopover = (
    // Account Details — opened by the avatar chip or the menu's
    // "Account Details" row (30 Oct 2026)
    <AccountDetailsPopover
      isVisible={accountPopoverVisible}
      onClose={() => setAccountPopoverVisible(false)}
      userData={userData}
    />
  );

  if (fixedNav) {
    // Desktop web: [ fixed teal sidebar | header + page ]
    return (
      <SafeAreaView style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
        <FixedSidebar
          userData={userData}
          appNav={appNav}
          onOpenAccountDetails={() => setAccountPopoverVisible(true)}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          {header}
          <View style={{ flex: 1 }}>{children}</View>
        </View>
        {accountPopover}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* One merged header — teal band with logo, back-chip/title and avatar */}
      {header}

      {/* Screen content */}
      <View style={{ flex: 1 }}>{children}</View>

      {/* The slide-in sidebar (phones, narrow windows, native apps) */}
      <NavSidebar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        onOpenAccountDetails={() => setAccountPopoverVisible(true)}
        userData={userData}
      />

      {accountPopover}
    </SafeAreaView>
  );
};

export default AppShell;
