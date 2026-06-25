// app/admin-hub/index.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getCurrentUser } from '../../utils/jwtUtils';
import { storage } from '../../utils/storage';
import styles from './AdminHubStyles';

// ── Tile config ───────────────────────────────────────────────────────────────
// accentColor : top-border colour of the card
// icon        : MaterialIcons name
// route       : where to navigate (null = disabled)
//
// Note: "Gate Entry" and "User Management" routes/visibility depend on the
// user's roles, so they're computed in getTiles() below rather than hardcoded.
const getTiles = (roles = []) => {
  const hasSecurityGuard = roles.includes('securityguard');

  return [
    {
      key: 'gate-entry',
      label: 'Gate Entry',
      sublabel: 'Vehicle & load management',
      icon: 'meeting-room',
      accentColor: '#38a169',
      iconBg: '#f0fff4',
      // itadmin + securityguard → full landing (admin + guard cards)
      // itadmin only / itadmin + securityadmin → straight to Admin Insights
      route: hasSecurityGuard ? '/landing/' : '/admin/AdminDashboard',
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

  const handleLogout = async () => {
    await storage.removeItem('access_token');
    router.replace('/LoginScreen');
  };

  const handleTilePress = (tile) => {
    if (tile.disabled || !tile.route) return;
    router.push(tile.route);
  };

  const isITAdmin = (user?.roles || []).includes('itadmin');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/images/bisleri-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.headerRight}>
          {user?.fullName ? (
            <Text style={styles.welcomeText}>Welcome, {user.fullName}</Text>
          ) : (
            <Text style={styles.welcomeText}>Admin Hub</Text>
          )}
          {user?.roles?.length > 0 && (
            <Text style={styles.roleText}>
              {user.roles.map(r => r.replace(/([a-z])([A-Z])/g, '$1 $2')).join(' · ')}
            </Text>
          )}
        </View>
      </View>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <View style={styles.body}>
        {/* Top-right actions: User Management (IT Admin only) + Logout */}
        <View style={styles.topActionsRow}>
          {isITAdmin && (
            <Pressable
              onPress={() => router.push('/admin-hub/user-management')}
              style={({ pressed }) => [
                styles.userMgmtBtn,
                pressed && styles.userMgmtBtnPressed,
              ]}
            >
              <MaterialIcons name="manage-accounts" size={18} color="#d69e2e" />
              <Text style={styles.userMgmtBtnText}>User Management</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutBtn,
              pressed && styles.logoutBtnPressed,
            ]}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

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
  );
}
