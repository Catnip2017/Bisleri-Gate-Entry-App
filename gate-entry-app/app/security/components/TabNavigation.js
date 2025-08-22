// app/security/components/TabNavigation.js - UPDATED with 4 tabs
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
        <Text style={styles.buttonText}>FG Gate Entry</Text>
      </TouchableOpacity>

      {/* Security Insights Tab */}
      <TouchableOpacity 
        style={activeTab === 'insights' ? styles.activeButton : styles.inactiveButton}
        onPress={() => onTabChange('insights')}
      >
        <Text style={styles.buttonText}>FG Insights</Text>
      </TouchableOpacity>

      {/* RM Entry Tab */}
      <TouchableOpacity 
        style={activeTab === 'rmentry' ? styles.activeButton : styles.inactiveButton}
        onPress={() => onTabChange('rmentry')}
      >
        <Text style={styles.buttonText}>RM Gate Entry</Text>
      </TouchableOpacity>

      {/* RM Insights Tab */}
      <TouchableOpacity 
        style={activeTab === 'rminsights' ? styles.activeButton : styles.inactiveButton}
        onPress={() => onTabChange('rminsights')}
      >
        <Text style={styles.buttonText}>RM Insights</Text>
      </TouchableOpacity>
    </View>
  );
};

export default TabNavigation;