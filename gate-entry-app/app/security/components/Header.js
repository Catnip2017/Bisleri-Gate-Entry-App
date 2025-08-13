// app/security/components/Header.js
import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import styles from '../styles/dashboardStyles';

const Header = ({ onMenuPress, userData }) => {
  const router = useRouter();

  const handleHomePress = () => {
    // Navigate back to landing page
    router.push('/landing/');
  };

  return (
    <View style={styles.header}>
      {/* ☰ Menu Icon - LEFT */}
      <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
        <Text style={styles.menuText}>☰</Text>
      </TouchableOpacity>

      {/* LOGO - CENTER */}
      <Image 
        source={require("../../../assets/images/bisleri-logo.png")} 
        style={styles.logo} 
        resizeMode="contain" 
      />

      {/* Home - RIGHT */}
      <TouchableOpacity style={styles.homeButton} onPress={handleHomePress}>
        <Text style={styles.homeText}>Home</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Header;