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

// Import styles
import styles from './AdminDashboardStyles';

const roleLabels = {
  itadmin: "IT Admin",
  securityadmin: "Security Admin",
  securityguard: "Security Guard",
};

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setIsSidebarVisible(!isSidebarVisible)}>
          <Text style={styles.menuButton}>☰</Text>
        </TouchableOpacity>

        <Image
          source={require('../../assets/images/bisleri-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={{ width: 24 }} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        {/* Top-left back navigation */}
        {(isITAdmin || showLandingButton) && (
          <View style={styles.topLeftRow}>
            {/* IT Admins came from Admin Hub — give them a way back */}
            {isITAdmin && (
              <TouchableOpacity style={styles.homeButton} onPress={handleBackToAdminHub}>
                <Text style={styles.homeButtonText}>← Admin Hub</Text>
              </TouchableOpacity>
            )}

            {/* Security Guard + Security Admin combo came from /landing */}
            {showLandingButton && (
              <TouchableOpacity style={styles.homeButton} onPress={handleBackToLanding}>
                <Text style={styles.homeButtonText}>← Home</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.bodyRow}>
          {/* Sidebar */}
          {isSidebarVisible && (
            <View style={styles.sidebar}>
              <Text style={styles.sidebarTitle}>User Info</Text>
              {user && (
                <>
                  <Text style={styles.sidebarItem}>Username: {user.username}</Text>
                  <Text style={styles.sidebarItem}>
                    Name: {user.firstName} {user.lastName}
                  </Text>
                  <Text style={styles.sidebarItem}>
                    Role: {user.roles
                      .map(role => roleLabels[role] || (role.charAt(0).toUpperCase() + role.slice(1)))
                      .join(', ')}
                  </Text>
                  {user.warehouseCode && (
                    <Text style={styles.sidebarItem}>WH Code: {user.warehouseCode}</Text>
                  )}
                  {user.siteCode && (
                    <Text style={styles.sidebarItem}>Site Code: {user.siteCode}</Text>
                  )}
                </>
              )}
            </View>
          )}

          {/* Main Content — Admin Insights only */}
          <View style={styles.mainContent}>
            <ScrollView style={styles.screenContainer}>
              <AdminInsightsScreen />
            </ScrollView>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AdminDashboard;
