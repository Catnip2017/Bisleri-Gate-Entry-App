// components/ui/AppHeader.js - Standard app header.
// EXACT match of the Admin Insights reference header: white bar, hairline
// bottom border, Bisleri logo centered, optional ☰ menu button on the left.
// Every screen renders this so the header is literally identical app-wide.
// Back navigation does NOT live here — it goes in a BackChip row below.
import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const AppHeader = ({ onMenuPress, rightSlot }) => (
  <View style={styles.header}>
    {onMenuPress ? (
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onMenuPress}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
      >
        <MaterialIcons name="menu" size={26} color="#333" />
      </TouchableOpacity>
    ) : (
      <View style={styles.iconButton} />
    )}

    <Image
      source={require('../../assets/images/bisleri-logo.png')}
      style={styles.logo}
      resizeMode="contain"
    />

    {rightSlot || <View style={styles.iconButton} />}
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 40,
  },
});

export default AppHeader;
