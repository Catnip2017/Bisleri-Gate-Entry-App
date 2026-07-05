// components/ui/BackChip.js - Standard back-navigation chip.
// EXACT match of the Admin Insights reference chip: light-blue background
// (#e3f2fd), blue 600-weight text (#1976d2), radius 6. Used on every screen
// so the back button is literally identical app-wide.
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const BackChip = ({ label, onPress }) => (
  <TouchableOpacity
    style={styles.chip}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`Back to ${label}`}
  >
    <Text style={styles.text}>← {label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  chip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    minHeight: 40,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    color: '#1976d2',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default BackChip;
