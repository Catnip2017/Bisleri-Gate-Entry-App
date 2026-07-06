// app/admin/AdminDashboard.js
// Admin Insights — wrapped in the shared AppShell (standard header, avatar,
// role-aware sidebar with pinned logout, standard blue back chip).
import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../../utils/jwtUtils';
import { showAlert } from '../../utils/customModal';

// Import admin screens
import AdminInsightsScreen from './screens/AdminInsightsScreen';

// Shared shell
import AppShell from '../../components/ui/AppShell';

// Import styles
import styles from './AdminDashboardStyles';

const AdminDashboard = () => {
  const router = useRouter();
  const [user, setUser] = useState(null);

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

  const roles = user?.roles || [];
  const isITAdmin = roles.includes('itadmin');
  const showLandingButton = roles.includes('securityguard');

  // IT Admins came from the Admin Hub; guard+admin combos came from Landing.
  const backLabel = isITAdmin ? 'Admin Hub' : (showLandingButton ? 'Home' : null);
  const backTarget = isITAdmin ? '/admin-hub' : '/landing/';

  return (
    <AppShell
      title="Admin Insights"
      backLabel={backLabel}
      onBack={() => router.push(backTarget)}
    >
      <View style={styles.mainContent}>
        <ScrollView style={styles.screenContainer}>
          <AdminInsightsScreen />
        </ScrollView>
      </View>
    </AppShell>
  );
};

export default AdminDashboard;
