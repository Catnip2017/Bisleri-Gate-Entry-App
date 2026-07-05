// app/security/components/Header.js
// Icons at 48dp touch targets; greeting shows who is logged in; Logout
// lives here beside Home (moved out of the sidebar per July 2026 review).
import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { authAPI } from '../../../services/api';
import { storage } from '../../../utils/storage';
import { confirmAction } from '../../../utils/customModal';
import styles from '../styles/dashboardStyles';

const Header = ({ onMenuPress, userData }) => {
  const router = useRouter();

  const handleHomePress = () => {
    // Navigate back to landing page
    router.push('/landing/');
  };

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

  const firstName = userData?.firstName || userData?.fullName?.split(' ')[0];

  return (
    <View style={styles.header}>
      {/* Menu - LEFT */}
      <TouchableOpacity
        style={styles.headerIconButton}
        onPress={onMenuPress}
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

      {/* Greeting + Home + Logout - RIGHT */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {firstName ? (
          <Text style={styles.headerGreeting} numberOfLines={1}>
            Hi, {firstName}
          </Text>
        ) : null}
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleHomePress}
          accessibilityRole="button"
          accessibilityLabel="Go to home"
        >
          <MaterialIcons name="home" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <MaterialIcons name="logout" size={22} color="#C62828" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Header;
