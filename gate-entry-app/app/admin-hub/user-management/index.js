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
import { getCurrentUser, goToMyHome } from '../../../utils/jwtUtils';
import { showAlert } from '../../../utils/customModal';
import AppShell from '../../../components/ui/AppShell';

// Re-use the existing screens from app/admin/screens — relative imports
// inside those files are resolved relative to their own location, so no
// changes needed there.
import AssignAccessScreen from '../../admin/screens/AssignAccessScreen';
import RegisterScreen from '../../admin/screens/RegisterScreen';
import ResetPasswordScreen from '../../admin/screens/ResetPasswordScreen';
import UsersListScreen from '../../admin/screens/UsersListScreen';
import SecurityScreen from '../../admin/screens/SecurityScreen';
import { adminAPI, securityAPI } from '../../../services/api';

import styles from './UserManagementStyles';

// Tab structure post-AD integration:
// • Assign Access   — find AD user by email, assign role + scope (replaces Register + Modify)
// • Register User   — create local/contractor accounts with username + password
// • Reset Password  — local users only; AD users see an informational block
// 25 Nov 2026: 'Users' (full list with filters) added first; clicking a
// row opens that user in Assign Access.
// 26 Nov 2026: 'Security' — dormant-account alerts, audit trail, settings.
const TABS = ['Users', 'Assign Access', 'Register User', 'Reset Password', 'Security'];

export default function UserManagementScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Users');
  const [openUser, setOpenUser] = useState(null);   // user picked in the Users tab
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [alertCount, setAlertCount] = useState(0);   // open dormant-account alerts (badge)

  // Badge on the Security tab — only when in-app alerts are switched on
  useEffect(() => {
    if (!allowed) return;
    securityAPI.getAlerts('open')
      .then((d) => setAlertCount(d.ready && d.inapp !== false ? d.open_count || 0 : 0))
      .catch(() => {});
  }, [allowed]);

  // Security → Alerts "Open user": load the full row, then show it in Assign Access
  const openByUsername = async (username) => {
    try {
      const list = await adminAPI.getUsersOverview();
      const u = (list || []).find((x) => x.username === username);
      if (u) { setOpenUser(u); setActiveTab('Assign Access'); }
    } catch (e) { /* stay on Security */ }
  };

  useEffect(() => {
    (async () => {
      try {
        const userData = await getCurrentUser();
        if (!userData) {
          router.replace('/LoginScreen');
          return;
        }

        const roles = userData.roles || [];
        if (!roles.includes('itadmin')) {
          showAlert('Access Denied', 'Only IT Admin can access User Management.');
          goToMyHome(router);   // own start page (27 Nov 2026)
          return;
        }

        setAllowed(true);
      } catch (e) {
        console.error('UserManagement auth check failed:', e);
        // Don't leave the user stuck — send them to their own start page
        goToMyHome(router);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'Users':
        return (
          <UsersListScreen
            onOpenUser={(u) => { setOpenUser(u); setActiveTab('Assign Access'); }}
            onRegister={() => setActiveTab('Register User')}
          />
        );
      case 'Assign Access':
        return <AssignAccessScreen initialUser={openUser} />;
      case 'Register User':
        return <RegisterScreen />;
      case 'Reset Password':
        return <ResetPasswordScreen />;
      case 'Security':
        return <SecurityScreen onOpenUser={openByUsername} onAlertCount={setAlertCount} />;
      default:
        return null;
    }
  };

  return (
    <AppShell title="User Management" backLabel="Admin Hub">
    <View style={styles.container}>

      {/* Show spinner inside the shell so the back chip is always reachable */}
      {(checking || !allowed) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0F6B46" />
        </View>
      )}

      {!checking && allowed && (<>
      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <View style={styles.tabContainer}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => { if (tab === 'Assign Access' && activeTab !== 'Assign Access') setOpenUser(null); setActiveTab(tab); }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
            {tab === 'Security' && alertCount > 0 ? (
              <View style={{ marginLeft: 6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#C62828', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}
                accessibilityLabel={`${alertCount} open alerts`}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{alertCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {/* Assign Access is a fixed-height two-pane screen: its own search list
          and detail panel scroll internally, so it must NOT sit inside a
          page-level ScrollView (that gave the list unbounded height and made
          the whole page grow/scroll — 30 Oct 2026). Other tabs are plain
          forms and keep page scrolling. */}
      {activeTab === 'Assign Access' || activeTab === 'Users' || activeTab === 'Security' ? (
        <View style={styles.screenContainer}>
          {renderActiveScreen()}
        </View>
      ) : (
        <ScrollView style={styles.screenContainer}>
          {renderActiveScreen()}
        </ScrollView>
      )}
      </>)}
    </View>
    </AppShell>
  );
}
