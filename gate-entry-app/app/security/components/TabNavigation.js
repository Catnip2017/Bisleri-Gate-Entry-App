// app/security/components/TabNavigation.js - 2-tab hierarchy
// Gate Entry (FG/RM toggle inside) | Insights (FG/RM toggle inside)
// Replaces the old 3-tab layout where entry types were combined but insights
// were split — an inconsistent hierarchy. Also fixes the old style bug where
// the active tab only rounded its LEFT corners and inactive only its RIGHT.
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import styles from '../styles/dashboardStyles';

const TABS = [
  { key: 'entry', label: 'Gate Entry' },
  { key: 'insights', label: 'Insights' },
];

const TabNavigation = ({ activeTab, onTabChange }) => {
  return (
    <View style={styles.buttonRow} accessibilityRole="tablist">
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={activeTab === tab.key ? styles.activeButton : styles.inactiveButton}
          onPress={() => onTabChange(tab.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === tab.key }}
        >
          <Text
            style={
              activeTab === tab.key ? styles.activeButtonText : styles.buttonText
            }
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default TabNavigation;
