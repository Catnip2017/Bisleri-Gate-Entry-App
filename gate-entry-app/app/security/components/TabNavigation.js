// app/security/components/TabNavigation.js
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import styles from '../styles/dashboardStyles';

const TabNavigation = ({ activeTab, onTabChange }) => {
  return (
    <View style={styles.buttonRow}>
      {/* Gate Entry Tab */}
      <TouchableOpacity 
        style={activeTab === 'gateentry' ? styles.activeButton : styles.inactiveButton}
        onPress={() => onTabChange('gateentry')}
      >
        <Text style={styles.buttonText}>Gate Entry</Text>
      </TouchableOpacity>

      {/* Security Insights Tab */}
      <TouchableOpacity 
        style={activeTab === 'insights' ? styles.activeButton : styles.inactiveButton}
        onPress={() => onTabChange('insights')}
      >
        <Text style={styles.buttonText}>Security Insights</Text>
      </TouchableOpacity>
    </View>
  );
};

export default TabNavigation;