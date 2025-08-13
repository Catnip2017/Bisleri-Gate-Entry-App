// app/security/components/Sidebar.js
import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/dashboardStyles';

const Sidebar = ({ isVisible, userData }) => {
  if (!isVisible) return null;

  return (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>User Info</Text>
      
      {userData ? (
        <>
          <Text style={styles.sidebarItem}>Username: {userData.username}</Text>
          <Text style={styles.sidebarItem}>Name: {userData.fullName}</Text>
          <Text style={styles.sidebarItem}>Role: {userData.role}</Text>
          <Text style={styles.sidebarItem}>WH Code: {userData.warehouseCode || 'N/A'}</Text>
          <Text style={styles.sidebarItem}>Site Code: {userData.siteCode || 'N/A'}</Text>
        </>
      ) : (
        <>
          <Text style={styles.sidebarItem}>Username: Loading...</Text>
          <Text style={styles.sidebarItem}>WH Name: Loading...</Text>
          <Text style={styles.sidebarItem}>WH Code: Loading...</Text>
          <Text style={styles.sidebarItem}>Site Code: Loading...</Text>
        </>
      )}
    </View>
  );
};

export default Sidebar;