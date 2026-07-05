// components/ui/BackChip.js - Standard back-navigation chip.
// The grey chip style from the Admin Insights screen ("← Admin Hub") is the
// app-wide standard; every screen's back button uses this component so the
// look and position never drift again.
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
    backgroundColor: '#eee',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minHeight: 40,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 14,
  },
});

export default BackChip;
