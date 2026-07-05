// app/security/components/Header.js
// UI enhancement: MaterialIcons at 48dp touch targets instead of a text "☰"
// glyph and a small text "Home" chip. A greeting shows who is logged in.
import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import styles from '../styles/dashboardStyles';

const Header = ({ onMenuPress, userData }) => {
  const router = useRouter();

  const handleHomePress = () => {
    // Navigate back to landing page
    router.push('/landing/');
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

      {/* Greeting + Home - RIGHT */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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
      </View>
    </View>
  );
};

export default Header;
