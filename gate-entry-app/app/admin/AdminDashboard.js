// AdminDashboard.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../../utils/jwtUtils';
import { authAPI } from '../../services/api';
import * as SecureStore from 'expo-secure-store';

// Import admin screens
import AdminInsightsScreen from './screens/AdminInsightsScreen';
import RegisterScreen from './screens/RegisterScreen';
import ModifyUserScreen from './screens/ModifyUserScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';

// Import styles (separated)
import styles from './AdminDashboardStyles';

const AdminDashboard = () => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('Admin Insights');
  const [availableTabs, setAvailableTabs] = useState(['Admin Insights']);

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

      setUser(userData);

      // âœ… Role-based tabs
      if (userData.role === 'admin') {
        setAvailableTabs(['Admin Insights']);
      } else if (userData.role === 'itadmin') {
        setAvailableTabs([
          'Admin Insights',
          'Register Users',
          'Modify Users',
          'Reset Password'
        ]);
      } else {
        Alert.alert('Access Denied', 'You do not have access to this page.');
        router.replace('/landing/');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      router.replace('/LoginScreen');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout Confirmation",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: performLogout }
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

  // âœ… Role-protected render function
  const renderActiveScreen = () => {
    const userRole = user?.role?.toLowerCase();

    switch (activeTab) {
      case 'Admin Insights':
        return <AdminInsightsScreen />;

      case 'Register Users':
        if (userRole === 'itadmin') return <RegisterScreen />;
        Alert.alert("Access Denied", "Only IT Admin can register users.");
        setActiveTab('Admin Insights');
        return null;

      case 'Modify Users':
        if (userRole === 'itadmin') return <ModifyUserScreen />;
        Alert.alert("Access Denied", "Only IT Admin can modify users.");
        setActiveTab('Admin Insights');
        return null;

      case 'Reset Password':
        if (userRole === 'itadmin') return <ResetPasswordScreen />;
        Alert.alert("Access Denied", "Only IT Admin can modify users.");
        setActiveTab('Admin Insights');
        return null;

      default:
        return <AdminInsightsScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setIsSidebarVisible(!isSidebarVisible)}>
          <Text style={styles.menuButton}>â˜°</Text>
        </TouchableOpacity>

        <Image
          source={require('../../assets/images/bisleri-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.homeButton} onPress={handleBackToLanding}>
            <Text style={styles.homeButtonText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
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
                <Text style={styles.sidebarItem}>Role: {user.role}</Text>
                {user.warehouse_code && (
                  <Text style={styles.sidebarItem}>WH Code: {user.warehouse_code}</Text>
                )}
                {user.site_code && (
                  <Text style={styles.sidebarItem}>Site Code: {user.site_code}</Text>
                )}
              </>
            )}
          </View>
        )}

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Tabs */}
          <View style={styles.tabContainer}>
            {availableTabs.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && styles.activeTab
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText
                ]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          <ScrollView style={styles.screenContainer}>
            {renderActiveScreen()}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AdminDashboard;