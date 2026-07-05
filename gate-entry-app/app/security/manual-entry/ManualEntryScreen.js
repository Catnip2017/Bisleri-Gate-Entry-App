// app/security/manual-entry/ManualEntryScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../../../utils/jwtUtils';
import ManualEntryForm from './ManualEntryForm';
import styles from './ManualEntryStyles';

const ManualEntryScreen = () => {
  const router = useRouter();
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [userData, setUserData] = useState(null);

  // Load user data when component mounts
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await getCurrentUser();
      setUserData(user);
    } catch (error) {
      console.log('Error loading user data:', error);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  const handleHomePress = () => {
    // Navigate back to security dashboard
    router.push('/security/');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* ✅ Top Navbar */}
      <View style={styles.header}>
        {/* Menu - LEFT */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={toggleSidebar}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <MaterialIcons name="menu" size={26} color="#333" />
        </TouchableOpacity>

        {/* LOGO - CENTER */}
        <Image 
          source={require("../../../assets/images/bisleri-logo.png")} 
          style={styles.logo} 
          resizeMode="contain" 
        />

        {/* Back - RIGHT */}
        <TouchableOpacity
          style={styles.homeButton}
          onPress={handleHomePress}
          accessibilityRole="button"
          accessibilityLabel="Back to gate entry"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="arrow-back" size={18} color="#333" />
            <Text style={styles.homeText}>Back</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ✅ Sidebar + Content in Row */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* 🧊 Sidebar */}
        {isSidebarVisible && (
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
        )}

        {/* 🌐 Main Content */}
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container}>
            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={styles.pageTitle}>Manual Gate Entry</Text>
            </View>

            {/* Manual Entry Form */}
            <ManualEntryForm userData={userData} />
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ManualEntryScreen;