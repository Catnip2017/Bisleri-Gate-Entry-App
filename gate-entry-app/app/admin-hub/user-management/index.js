// app/admin-hub/user-management/index.js
// IT Admin only. Houses Register Users / Modify Users / Reset Password —
// moved out of /admin/AdminDashboard, which now only shows Admin Insights.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getCurrentUser } from '../../../utils/jwtUtils';
import { showAlert } from '../../../utils/customModal';
import AppShell from '../../../components/ui/AppShell';

// Re-use the existing screens from app/admin/screens — relative imports
// inside those files are resolved relative to their own location, so no
// changes needed there.
import RegisterScreen from '../../admin/screens/RegisterScreen';
import ModifyUserScreen from '../../admin/screens/ModifyUserScreen';
import ResetPasswordScreen from '../../admin/screens/ResetPasswordScreen';

import styles from './UserManagementStyles';

const TABS = ['Register Users', 'Modify Users', 'Reset Password'];

export default function UserManagementScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    (async () => {
      const userData = await getCurrentUser();
      if (!userData) {
        router.replace('/LoginScreen');
        return;
      }

      const roles = userData.roles || [];
      if (!roles.includes('itadmin')) {
        showAlert('Access Denied', 'Only IT Admin can access User Management.');
        router.replace('/admin-hub');
        return;
      }

      setAllowed(true);
      setChecking(false);
    })();
  }, []);

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'Register Users':
        return <RegisterScreen />;
      case 'Modify Users':
        return <ModifyUserScreen />;
      case 'Reset Password':
        return <ResetPasswordScreen />;
      default:
        return null;
    }
  };

  if (checking || !allowed) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <AppShell title="User Management" backLabel="Admin Hub">
    <View style={styles.container}>
      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <View style={styles.tabContainer}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <ScrollView style={styles.screenContainer}>
        {renderActiveScreen()}
      </ScrollView>
    </View>
    </AppShell>
  );
}
