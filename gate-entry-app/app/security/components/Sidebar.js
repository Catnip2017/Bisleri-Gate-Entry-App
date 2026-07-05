// app/security/components/Sidebar.js - Overlay drawer with user info.
// (Logout moved to the header beside Home, July 2026.)
import React from 'react';
import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import styles from '../styles/dashboardStyles';

const ROLE_LABELS = {
  itadmin: 'IT Admin',
  securityadmin: 'Security Admin',
  securityguard: 'Security Guard',
  copacker: 'Co-Packer',
};

const Sidebar = ({ isVisible, onClose, userData }) => {
  if (!isVisible) return null;

  const displayRoles = (userData?.roles || [])
    .map((r) => ROLE_LABELS[r] || r)
    .join(', ');

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
      </View>
    </View>
  );
};

export default Sidebar;
