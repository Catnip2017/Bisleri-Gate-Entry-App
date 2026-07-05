// app/security/components/Sidebar.js - Overlay drawer with logout.
// Was: a static panel that pushed the whole dashboard sideways, with no way
// to close it except the menu button, no logout anywhere on the security
// dashboard, and the raw role string displayed.
import React from 'react';
import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { authAPI } from '../../../services/api';
import { storage } from '../../../utils/storage';
import { confirmAction } from '../../../utils/customModal';
import styles from '../styles/dashboardStyles';

const ROLE_LABELS = {
  itadmin: 'IT Admin',
  securityadmin: 'Security Admin',
  securityguard: 'Security Guard',
  copacker: 'Co-Packer',
};

const Sidebar = ({ isVisible, onClose, userData }) => {
  const router = useRouter();

  if (!isVisible) return null;

  const displayRoles = (userData?.roles || [])
    .map((r) => ROLE_LABELS[r] || r)
    .join(', ');

  const handleLogout = () => {
    confirmAction({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmText: 'Logout',
      destructive: true,
      onConfirm: async () => {
        try {
          await authAPI.logout();
        } catch (e) {
          console.log('Logout API error:', e);
        } finally {
          await storage.removeItem('access_token');
          router.replace('/LoginScreen');
        }
      },
    });
  };

  return (
    <View style={styles.sidebarOverlay}>
      {/* Tap outside to close */}
      <Pressable style={styles.sidebarBackdrop} onPress={onClose} />

      <View style={styles.sidebarPanel}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>User Info</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.sidebarCloseButton}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          >
            <MaterialIcons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {userData ? (
          <>
            <Text style={styles.sidebarItem}>Username: {userData.username}</Text>
            <Text style={styles.sidebarItem}>Name: {userData.fullName}</Text>
            <Text style={styles.sidebarItem}>Role: {displayRoles || userData.role}</Text>
            <Text style={styles.sidebarItem}>WH Code: {userData.warehouseCode || 'N/A'}</Text>
            <Text style={styles.sidebarItem}>Site Code: {userData.siteCode || 'N/A'}</Text>
          </>
        ) : (
          <Text style={styles.sidebarItem}>Loading user info…</Text>
        )}

        <TouchableOpacity
          style={styles.sidebarLogoutButton}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <MaterialIcons name="logout" size={18} color="#fff" />
          <Text style={styles.sidebarLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Sidebar;
