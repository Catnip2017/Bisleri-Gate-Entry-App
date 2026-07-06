// app/security/components/TabNavigation.js - 2-tab hierarchy
// Gate Entry (FG/RM toggle inside) | Insights (FG/RM toggle inside)
// viewOnlyEntry adds a small "View only" pill to the Gate Entry tab so
// admins know their access level BEFORE tapping.
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import styles from '../styles/dashboardStyles';

const TABS = [
  { key: 'entry', label: 'Gate Entry' },
  { key: 'insights', label: 'Insights' },
];

const TabNavigation = ({ activeTab, onTabChange, viewOnlyEntry = false }) => {
  return (
    <View style={styles.buttonRow} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        const showPill = tab.key === 'entry' && viewOnlyEntry;
        return (
          <TouchableOpacity
            key={tab.key}
            style={active ? styles.activeButton : styles.inactiveButton}
            onPress={() => onTabChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={active ? styles.activeButtonText : styles.buttonText}>
                {tab.label}
              </Text>
              {showPill && (
                <View style={{
                  backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#F1EFE8',
                  borderRadius: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}>
                  <Text style={{
                    fontSize: 10,
                    fontWeight: 'bold',
                    color: active ? '#ffffff' : '#5F5E5A',
                  }}>
                    View only
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default TabNavigation;
