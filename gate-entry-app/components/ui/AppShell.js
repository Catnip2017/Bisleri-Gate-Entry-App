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
import AppHeader from './AppHeader';
import BackChip from './BackChip';
import NavSidebar from './NavSidebar';

const AppShell = ({ children, title, backLabel, onBack }) => {
  const router = useRouter();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        setUserData(user);
      } catch (e) {
        console.log('AppShell: error loading user', e);
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
        <Text style={{ fontSize: 13, color: '#555', maxWidth: 90 }} numberOfLines={1}>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#EAF7EF' }}>
      {/* Standard header */}
      <AppHeader
        onMenuPress={() => setSidebarVisible(true)}
        rightSlot={avatarChip}
      />

      {/* Back chip row (home screens pass no backLabel and get no chip) */}
      {(backLabel || title) && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingHorizontal: 16, paddingVertical: 10,
        }}>
          {backLabel ? (
            <BackChip
              label={backLabel}
              onPress={onBack || (() => router.back())}
            />
          ) : null}
          {title ? (
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#007A3B' }}>
              {title}
            </Text>
          ) : null}
        </View>
      )}

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
