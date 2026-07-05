// app/admin/AdminDashboard.js
// Simplified: this screen now ONLY shows Admin Insights.
// Register Users / Modify Users / Reset Password have moved to
// app/admin-hub/user-management (IT Admin only, accessed from Admin Hub).

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../../utils/jwtUtils';
import { authAPI } from '../../services/api';
import * as SecureStore from 'expo-secure-store';
import { showAlert } from '../../utils/customModal';

// Import admin screens
import AdminInsightsScreen from './screens/AdminInsightsScreen';

// Shared UI (standard header, back chip, overlay sidebar)
import AppHeader from '../../components/ui/AppHeader';
import BackChip from '../../components/ui/BackChip';
import Sidebar from '../security/components/Sidebar';

// Import styles
import styles from './AdminDashboardStyles';

const AdminDashboard = () => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await getCurrentUser();
      if (!userData) {
        router.replace('/LoginScreen');
        return;
      }

      // Normalize roles array (multi-role support)
      const rolesArray = userData.roles && Array.isArray(userData.roles)
        ? userData.roles.map(r => r.trim().toLowerCase().replace(/\s+/g, ''))
        : userData.role
          ? userData.role.split(',').map(r => r.trim().toLowerCase().replace(/\s+/g, ''))
          : [];

      userData.roles = rolesArray;
      setUser(userData);

      // Access check: only itadmin / securityadmin (alone or combined) may view
      const allowed =
        rolesArray.includes('itadmin') ||
        rolesArray.includes('securityadmin');

      if (!allowed) {
        showAlert('Access Denied', 'You do not have access to this page.');
        router.replace('/landing/');
        return;
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      router.replace('/LoginScreen');
    }
  };

  const handleLogout = () => {
    showAlert(
      'Logout Confirmation',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: performLogout }
      ]
    );
  };

  const performLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await SecureStore.deleteItemAsync('access_token');
      router.replace('/LoginScreen');
    }
  };

  const handleBackToLanding = () => {
    router.push('/landing/');
  };

  const handleBackToAdminHub = () => {
    router.push('/admin-hub');
  };

  const roles = user?.roles || [];
  const isITAdmin = roles.includes('itadmin');
  // securityguard + securityadmin combo also passes through /landing
  const showLandingButton = roles.includes('securityguard');

  return (
    <SafeAreaView style={styles.container}>
      {/* Standard header */}
      <AppHeader onMenuPress={() => setIsSidebarVisible(!isSidebarVisible)} />

      {/* Body */}
      <View style={styles.body}>
        {/* Top-left back navigation — standard blue chip */}
        {(isITAdmin || showLandingButton) && (
          <View style={styles.topLeftRow}>
            {isITAdmin && (
              <BackChip label="Admin Hub" onPress={handleBackToAdminHub} />
            )}
            {showLandingButton && (
              <BackChip label="Home" onPress={handleBackToLanding} />
            )}
          </View>
        )}

        <View style={styles.bodyRow}>
          {/* Main Content — Admin Insights only */}
          <View style={styles.mainContent}>
            <ScrollView style={styles.screenContainer}>
              <AdminInsightsScreen />
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Standard overlay sidebar (same component as the security dashboard) */}
      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
        userData={user}
      />
    </SafeAreaView>
  );
};

export default AdminDashboard;
