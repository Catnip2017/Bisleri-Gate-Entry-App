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
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getCurrentUser } from '../../utils/jwtUtils';
import AppShell from '../../components/ui/AppShell';
import styles from './AdminHubStyles';

// ── Tile config ───────────────────────────────────────────────────────────────
const getTiles = (roles = []) => {
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
    },
    {
      key: 'user-management',
      label: 'User Management',
      sublabel: 'Register, modify, reset',
      icon: 'manage-accounts',
      accentColor: '#d69e2e',
      iconBg: '#fffff0',
      route: '/admin-hub/user-management',
      disabled: false,
    },
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
  ];
};

export default function AdminHubScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);

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
          <Text style={styles.heading}>Select an Application</Text>

          {/* Tile grid */}
          <View style={styles.grid}>
            {getTiles(user?.roles || []).map((tile) => (
              <Pressable
                key={tile.key}
                onPress={() => handleTilePress(tile)}
                disabled={tile.disabled}
                style={({ pressed }) => [
                  styles.tile,
                  { borderTopWidth: 4, borderTopColor: tile.accentColor },
                  tile.disabled && styles.tileDisabled,
                  pressed && !tile.disabled && styles.tilePressed,
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: tile.iconBg }]}>
                  <MaterialIcons
                    name={tile.icon}
                    size={34}
                    color={tile.accentColor}
                  />
                </View>
                <Text style={styles.tileLabel}>{tile.label}</Text>
                <Text style={styles.tileSublabel}>{tile.sublabel}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}
