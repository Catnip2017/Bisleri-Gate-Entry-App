// app/admin-hub/index.js
// Admin Hub home — wrapped in the shared AppShell (standard header, avatar,
// role-aware sidebar with pinned logout). The old custom header, top-right
// User Management button and Logout button are gone: navigation and logout
// now live in the one sidebar, same as every other page.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getCurrentUser } from '../../utils/jwtUtils';
import AppShell from '../../components/ui/AppShell';
import HubTile from '../../components/ui/HubTile';
import { useAdminHubStyles } from './AdminHubStyles';
import { useCopackerEnabled } from '../../hooks/useCopackerEnabled';

// ── Tile config ───────────────────────────────────────────────────────────────
// 'Dashboards' is itadmin-only — filtered out below for everyone else, and the
// backend enforces the same restriction on every /dashboard/* endpoint, so a
// non-itadmin can't reach the data even by guessing the route/URL directly.
const getTiles = (roles = [], copackerEnabled = true) => {
  const isItAdmin = roles.includes('itadmin');
  const isGatePassCreator = roles.includes('gatepasscreator');

  return [
    {
      key: 'gate-entry',
      label: 'Gate Entry',
      sublabel: 'Entries & insights',
      icon: 'meeting-room',
      accentColor: '#38a169',
      iconBg: '#f0fff4',
      // The ONE gate dashboard — admins land on Insights (view-only entry)
      route: '/security',
      disabled: false,
    },
    {
      key: 'dashboards',
      label: 'Dashboards',
      sublabel: 'Live analytics & reports',
      icon: 'bar-chart',
      accentColor: '#2b6cb0',
      iconBg: '#ebf8ff',
      route: '/admin-hub/dashboard',
      disabled: false,
      hidden: !isItAdmin,
    },
    {
      // Gate Pass (RGP / Non-RGP) — TEMP: itadmin stands in for the future
      // 'gatepassuser' role; the tile already lights up for both.
      key: 'gate-pass',
      label: 'Gate Pass',
      sublabel: 'Returnable & non-returnable',
      icon: 'assignment',
      accentColor: '#1E88E5',
      iconBg: '#E6F1FB',
      route: '/gate-pass',
      disabled: false,
      hidden: !isItAdmin && !isGatePassCreator,
    },
    {
      key: 'copacker',
      label: 'Co Packer',
      sublabel: 'Production line capture',
      icon: 'inventory-2',
      accentColor: '#dd6b20',
      iconBg: '#fffaf0',
      route: '/copacker',
      disabled: false,
      // Hidden when COPACKER_FEATURE_ENABLED=false in the backend .env
      // (and until that flag is known, so a disabled card never flashes up).
      hidden: copackerEnabled !== true,
    },
    // User Management card removed (30 Oct 2026) — it now lives as its own
    // flat link in the global hamburger menu, alongside the Applications
    // accordion, not duplicated here as a tile too.
    {
      key: 'rpa',
      label: 'RPA Processes',
      sublabel: 'Automation by domain',
      icon: 'precision-manufacturing',
      accentColor: '#6b46c1',
      iconBg: '#faf5ff',
      route: '/rpa',
      disabled: false,
    },
  ].filter((tile) => !tile.hidden);
};

export default function AdminHubScreen() {
  const styles = useAdminHubStyles();
  const copackerEnabled = useCopackerEnabled();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || '';

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const handleTilePress = (tile) => {
    if (tile.disabled || !tile.route) return;
    router.push(tile.route);
  };

  return (
    <AppShell>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {/* Welcome banner (25 Nov 2026 UI overhaul) */}
          <View style={[styles.banner, !wide && styles.bannerNarrow]}>
            <View style={{ flex: 1, zIndex: 1 }}>
              <Text style={styles.bannerTitle}>
                {firstName ? `Welcome, ${firstName}!` : 'Welcome!'}
              </Text>
              <Text style={styles.bannerSub}>
                Choose an application below to get started.
              </Text>
            </View>
            {wide ? (
              <Image
                source={require('../../assets/images/header-water.png')}
                style={styles.bannerWater}
                resizeMode="cover"
                pointerEvents="none"
              />
            ) : null}
            {wide ? <View style={styles.bannerFade} pointerEvents="none" /> : null}
          </View>

          <Text style={styles.heading}>Applications</Text>

          {/* Tile grid */}
          <View style={styles.grid}>
            {getTiles(user?.roles || [], copackerEnabled).map((tile) => (
              <HubTile
                key={tile.key}
                label={tile.label}
                sublabel={tile.sublabel}
                icon={tile.icon}
                accentColor={tile.accentColor}
                iconBg={tile.iconBg}
                disabled={tile.disabled}
                onPress={() => handleTilePress(tile)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}
