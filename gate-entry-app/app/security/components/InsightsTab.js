// app/security/components/InsightsTab.js
// Wraps FG Insights and RM Insights behind ONE top-level "Insights" tab with
// an FG/RM toggle — mirroring the FG/RM toggle already inside Gate Entry, so
// the tab hierarchy is consistent (2 top tabs, each with the same toggle).
//
// Sub-views are lazy-mounted: RM Insights doesn't fetch anything until the
// guard actually opens it, then stays mounted to preserve filters/scroll.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import SecurityInsightsTab from './SecurityInsightsTab';
import RMInsightsTab from './RMInsightsTab';
import { colors, radius, spacing, TOUCH_TARGET } from '../../../utils/theme';

const InsightsTab = () => {
  const [insightType, setInsightType] = useState('FG');
  const [visited, setVisited] = useState({ FG: true, RM: false });

  const handleToggle = (type) => {
    setInsightType(type);
    setVisited((prev) => ({ ...prev, [type]: true }));
  };

  return (
    <View style={{ flex: 1 }}>
      {/* FG / RM toggle — same pattern as the Gate Entry tab */}
      <View style={localStyles.toggleContainer}>
        {['FG', 'RM'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              localStyles.toggleButton,
              insightType === type && localStyles.toggleButtonActive,
            ]}
            onPress={() => handleToggle(type)}
            accessibilityRole="tab"
            accessibilityState={{ selected: insightType === type }}
          >
            <Text
              style={[
                localStyles.toggleText,
                insightType === type && localStyles.toggleTextActive,
              ]}
            >
              {type} Insights
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lazy mount + keep mounted after first visit */}
      {visited.FG && (
        <View style={insightType === 'FG' ? null : localStyles.hidden}>
          <SecurityInsightsTab />
        </View>
      )}
      {visited.RM && (
        <View style={insightType === 'RM' ? null : localStyles.hidden}>
          <RMInsightsTab />
        </View>
      )}
    </View>
  );
};

const localStyles = StyleSheet.create({
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  toggleButton: {
    minHeight: TOUCH_TARGET,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  toggleButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  toggleTextActive: {
    color: colors.textInverse,
  },
  hidden: {
    display: 'none',
  },
});

export default InsightsTab;
